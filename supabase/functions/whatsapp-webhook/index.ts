/**
 * WhatsApp Cloud API webhook (step 22).
 *
 * Secrets (set in Supabase Edge Function secrets — do not invent values):
 * - WHATSAPP_VERIFY_TOKEN  — Meta webhook verify token
 * - WHATSAPP_APP_SECRET    — optional, for X-Hub-Signature-256 (future)
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — provided by the platform
 *
 * GET  — Meta subscription verification
 * POST — delivery statuses + inbound messages (1 confirm / 2 cancel / opt-out)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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
        results.push({ type: 'inbound', from, data, error: error?.message })
      }
    }
  }

  // Always 200 to Meta once parsed — retries on 5xx only.
  return json({ ok: true, results })
})
