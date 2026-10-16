/**
 * WhatsApp Cloud API send worker (test number now; swap secrets for production later).
 *
 * Secrets (Edge Function secrets — do not invent):
 * - WHATSAPP_ACCESS_TOKEN   — Meta user/system token with messaging permission
 * - WHATSAPP_PHONE_NUMBER_ID — Cloud API phone number id (test or production)
 * - WHATSAPP_GRAPH_VERSION  — optional, default v21.0
 * - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — platform
 *
 * POST JSON (optional):
 *   { "limit": 10, "queue_id": "<uuid>" }
 * Claims due queue rows (or one id), sends rendered body_text as a Cloud API
 * text message (sandbox / allowlisted recipients). Approved Meta template names
 * in message_templates.whatsapp_template_id use the template API instead.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type ClaimedRow = {
  queue_id: string
  branch_id: string
  phone: string
  language: string
  kind: string
  params: Record<string, unknown>
  body_text: string
  whatsapp_template_id: string | null
  template_status: string
  template_name: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function renderBody(body: string, params: Record<string, unknown>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, num: string) => {
    const v = params[num]
    return v != null ? String(v) : `{{${num}}}`
  })
}

function digitsOnlyPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

async function sendCloudMessage(input: {
  token: string
  phoneNumberId: string
  graphVersion: string
  to: string
  bodyText: string
  templateName: string | null
  language: string
  params: Record<string, unknown>
}): Promise<{ id: string; raw: unknown }> {
  const url =
    `https://graph.facebook.com/${input.graphVersion}/` +
    `${input.phoneNumberId}/messages`

  let payload: Record<string, unknown>

  // Approved / fallback Meta template → template send.
  // Free-form text only works inside the 24h customer-care window (#131047 otherwise).
  if (input.templateName) {
    const keys = Object.keys(input.params)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
    const parameters = keys.map((k) => ({
      type: 'text',
      text: String(input.params[k] ?? ''),
    }))
    // Clinic WhatsApp is English-only; Meta English templates use en_US.
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: 'en_US' },
        components:
          parameters.length > 0 && input.templateName !== 'hello_world'
            ? [{ type: 'body', parameters }]
            : undefined,
      },
    }
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'text',
      text: { preview_url: false, body: input.bodyText.slice(0, 4096) },
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Meta HTTP ${res.status}`
    throw new Error(err)
  }

  const id =
    (raw as { messages?: { id?: string }[] })?.messages?.[0]?.id || ''
  if (!id) throw new Error('Meta response missing message id')
  return { id, raw }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v21.0'

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Supabase env not configured' }, 500)
  }
  if (!accessToken || !phoneNumberId) {
    return json(
      {
        error:
          'WhatsApp send secrets missing. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID (test number id is fine until production).',
      },
      503,
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Authorization required' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json({ error: 'Invalid session' }, 401)
  }

  const dental = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'dental' },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileErr } = await dental
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileErr) {
    return json({ error: profileErr.message }, 500)
  }
  const role = (profile as { role?: string } | null)?.role
  if (!role || !['owner', 'branch_manager', 'receptionist'].includes(role)) {
    return json({ error: 'Not allowed to send WhatsApp' }, 403)
  }

  let limit = 10
  let queueId: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (body && typeof body === 'object') {
      if (typeof (body as { limit?: unknown }).limit === 'number') {
        limit = (body as { limit: number }).limit
      }
      if (typeof (body as { queue_id?: unknown }).queue_id === 'string') {
        queueId = (body as { queue_id: string }).queue_id
      }
    }
  } catch {
    /* empty body ok */
  }

  const { data: claimed, error: claimErr } = await dental.rpc(
    'claim_due_notifications',
    {
      p_limit: limit,
      p_queue_id: queueId,
    },
  )
  if (claimErr) {
    return json({ error: claimErr.message }, 500)
  }

  const rows = (claimed ?? []) as ClaimedRow[]
  if (rows.length === 0) {
    return json({ ok: true, processed: 0, results: [] })
  }

  const results: unknown[] = []

  for (const row of rows) {
    const to = digitsOnlyPhone(row.phone)
    const bodyText = renderBody(row.body_text, row.params ?? {})
    // Approved Meta template name when set. Otherwise try draft body as free-form
    // text (works inside the 24h window). If Meta rejects (#131047), fall back to
    // hello_world so cold / out-of-window sends still deliver on the test number.
    const approvedName =
      row.template_status === 'approved' &&
      row.whatsapp_template_id &&
      row.whatsapp_template_id.trim().length > 0
        ? row.whatsapp_template_id.trim()
        : null
    const fallbackTemplate =
      Deno.env.get('WHATSAPP_TEST_FALLBACK_TEMPLATE') || 'hello_world'

    try {
      if (!to) throw new Error('Recipient phone is empty')

      let mode = approvedName ? 'template' : 'text'
      let templateName: string | null = approvedName
      let sent: { id: string; raw: unknown }

      try {
        sent = await sendCloudMessage({
          token: accessToken,
          phoneNumberId,
          graphVersion,
          to,
          bodyText,
          templateName: approvedName,
          language: row.language,
          params: row.params ?? {},
        })
      } catch (textErr) {
        if (approvedName) throw textErr
        const msg = textErr instanceof Error ? textErr.message : String(textErr)
        // Outside care window or other free-form block → Meta sample template.
        sent = await sendCloudMessage({
          token: accessToken,
          phoneNumberId,
          graphVersion,
          to,
          bodyText,
          templateName: fallbackTemplate,
          language: 'en',
          params: {},
        })
        mode = 'template_fallback'
        templateName = fallbackTemplate
        console.warn('send-whatsapp text failed, used fallback:', msg)
      }

      const { error: markErr } = await dental.rpc('mark_notification_sent', {
        p_queue_id: row.queue_id,
        p_provider_message_id: sent.id,
        p_body_preview: bodyText.slice(0, 280),
        p_payload: {
          source: 'send-whatsapp',
          mode,
          template_name: templateName,
          meta: sent.raw,
        },
      })
      if (markErr) throw new Error(markErr.message)

      results.push({
        queue_id: row.queue_id,
        ok: true,
        provider_message_id: sent.id,
        mode,
        template_name: templateName,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await dental.rpc('mark_notification_failed', {
        p_queue_id: row.queue_id,
        p_error_message: message,
      })
      results.push({ queue_id: row.queue_id, ok: false, error: message })
    }
  }

  return json({
    ok: true,
    processed: results.length,
    results,
  })
})
