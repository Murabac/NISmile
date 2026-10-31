/**
 * WhatsApp Cloud API webhook (Meta — two-number production path).
 *
 * Secrets (Edge Function secrets — do not invent):
 * - WHATSAPP_VERIFY_TOKEN  — Meta webhook verify token
 * - WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID — send reply acks
 * - WHATSAPP_GRAPH_VERSION — optional, default v21.0
 * - WHATSAPP_APP_SECRET    — optional, for X-Hub-Signature-256 (future)
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — platform
 *
 * GET  — Meta subscription verification
 * POST — delivery statuses + inbound (1 confirm / 2 cancel / opt-out)
 *         After 1/2, queues + sends an ack of their choice when secrets exist.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { appendCareFooter } from '../_shared/whatsapp_care_footer.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function sendAckQueueRow(
  // deno-lint-ignore no-explicit-any
  dental: any,
  queueId: string,
): Promise<{ ok: boolean; error?: string; provider_message_id?: string }> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v21.0'
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp send secrets missing for ack' }
  }

  const { data: claimed, error: claimErr } = await dental.rpc(
    'claim_due_notifications',
    { p_limit: 1, p_queue_id: queueId },
  )
  if (claimErr) return { ok: false, error: claimErr.message }
  const row = (claimed ?? [])[0] as
    | {
        queue_id: string
        phone: string
        body_text: string
        params: Record<string, unknown>
      }
    | undefined
  if (!row) return { ok: false, error: 'Ack queue row not claimable' }

  const to = String(row.phone || '').replace(/[^\d]/g, '')
  const bodyText = appendCareFooter(
    renderBody(row.body_text, row.params ?? {}),
  )
  const url =
    `https://graph.facebook.com/${graphVersion}/` +
    `${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: bodyText.slice(0, 4096) },
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Meta HTTP ${res.status}`
    await dental.rpc('mark_notification_failed', {
      p_queue_id: row.queue_id,
      p_error_message: message,
    })
    return { ok: false, error: message }
  }
  const id =
    (raw as { messages?: { id?: string }[] })?.messages?.[0]?.id || ''
  await dental.rpc('mark_notification_sent', {
    p_queue_id: row.queue_id,
    p_provider_message_id: id,
    p_body_preview: bodyText.slice(0, 280),
    p_payload: {
      source: 'whatsapp-webhook-ack',
      provider: 'meta_cloud_api',
      mode: 'text',
      meta: raw,
    },
  })
  return { ok: true, provider_message_id: id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase env not configured' }, 500)
  }

  const dental = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'dental' },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Meta webhook verification handshake.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

    if (!verifyToken) {
      return json(
        {
          error:
            'WHATSAPP_VERIFY_TOKEN secret not set. Add it after Meta Business verification (step 6).',
        },
        503,
      )
    }

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: cors })
    }
    return json({ error: 'Verification failed' }, 403)
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const results: unknown[] = []
  const entries = (payload.entry as unknown[]) ?? []

  for (const entry of entries) {
    const changes = ((entry as { changes?: unknown[] }).changes ?? []) as {
      value?: {
        statuses?: {
          id?: string
          status?: string
          errors?: { title?: string; message?: string }[]
        }[]
        messages?: {
          id?: string
          from?: string
          type?: string
          text?: { body?: string }
          button?: { text?: string; payload?: string }
        }[]
      }
    }[]

    for (const change of changes) {
      const value = change.value ?? {}

      for (const st of value.statuses ?? []) {
        if (!st.id || !st.status) continue
        const errMsg =
          st.errors?.[0]?.title || st.errors?.[0]?.message || null
        const { data, error } = await dental.rpc('apply_whatsapp_delivery_status', {
          p_provider_message_id: st.id,
          p_status: st.status,
          p_error_message: errMsg,
          p_raw: st,
        })
        results.push({ type: 'status', id: st.id, data, error: error?.message })
      }

      for (const msg of value.messages ?? []) {
        const from = msg.from ? (msg.from.startsWith('+') ? msg.from : `+${msg.from}`) : null
        const body =
          msg.text?.body ??
          msg.button?.payload ??
          msg.button?.text ??
          ''
        if (!from || !body) continue
        const { data, error } = await dental.rpc('apply_whatsapp_inbound', {
          p_phone: from,
          p_body: body,
          p_provider_message_id: msg.id ?? null,
          p_raw: msg,
        })
        const inbound: Record<string, unknown> = {
          type: 'inbound',
          from,
          data,
          error: error?.message,
        }
        const ackQueueId =
          data && typeof data === 'object'
            ? (data as { ack_queue_id?: string | null }).ack_queue_id
            : null
        if (ackQueueId) {
          const ack = await sendAckQueueRow(dental, ackQueueId)
          inbound.ack = ack
        }
        results.push(inbound)
      }
    }
  }

  // Always 200 to Meta once parsed — retries on 5xx only.
  return json({ ok: true, results })
})
