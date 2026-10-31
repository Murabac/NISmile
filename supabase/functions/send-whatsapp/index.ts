/**
 * WhatsApp Cloud API send worker (Meta Graph API — two-number production path).
 *
 * Secrets (Edge Function secrets — do not invent):
 * - WHATSAPP_ACCESS_TOKEN   — Meta user/system token with messaging permission
 * - WHATSAPP_PHONE_NUMBER_ID — Cloud API phone number id (API number, not chat SIM)
 * - WHATSAPP_GRAPH_VERSION  — optional, default v21.0
 * - WHATSAPP_TEST_FALLBACK_TEMPLATE — optional, default hello_world
 * - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — platform
 *
 * POST JSON (optional): { "limit": 10, "queue_id": "<uuid>" }
 * Approved Meta template names in message_templates.whatsapp_template_id use
 * the template API (en_US). Otherwise free-form text (24h customer window).
 * Sale receipt/invoice notices also attach an English A4 PDF document.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { appendCareFooter } from '../_shared/whatsapp_care_footer.ts'
import {
  buildSalePdf,
  loadSalePdfInput,
  readClinicLogoBytes,
  salePdfFilename,
  salePdfStoragePath,
} from '../_shared/sale_pdf.ts'

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
  related_type: string | null
  related_id: string | null
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

  if (input.templateName) {
    const keys = Object.keys(input.params)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
    const parameters = keys.map((k) => ({
      type: 'text',
      text: String(input.params[k] ?? ''),
    }))
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

async function uploadMetaMedia(input: {
  token: string
  phoneNumberId: string
  graphVersion: string
  filename: string
  bytes: Uint8Array
}): Promise<string> {
  const url =
    `https://graph.facebook.com/${input.graphVersion}/` +
    `${input.phoneNumberId}/media`
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append(
    'file',
    new Blob([input.bytes], { type: 'application/pdf' }),
    input.filename,
  )
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.token}` },
    body: form,
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Meta media HTTP ${res.status}`
    throw new Error(err)
  }
  const id = (raw as { id?: string }).id || ''
  if (!id) throw new Error('Meta media response missing id')
  return id
}

async function sendDocumentMessage(input: {
  token: string
  phoneNumberId: string
  graphVersion: string
  to: string
  mediaId: string
  filename: string
  caption?: string
}): Promise<{ id: string; raw: unknown }> {
  const url =
    `https://graph.facebook.com/${input.graphVersion}/` +
    `${input.phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'document',
      document: {
        id: input.mediaId,
        filename: input.filename,
        ...(input.caption ? { caption: input.caption.slice(0, 1024) } : {}),
      },
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Meta document HTTP ${res.status}`
    throw new Error(err)
  }
  const id =
    (raw as { messages?: { id?: string }[] })?.messages?.[0]?.id || ''
  if (!id) throw new Error('Meta document response missing message id')
  return { id, raw }
}

async function ensureSalePdfBytes(input: {
  // deno-lint-ignore no-explicit-any
  dental: any
  // deno-lint-ignore no-explicit-any
  storage: any
  branchId: string
  saleId: string
}): Promise<{
  bytes: Uint8Array
  filename: string
  storagePath: string
  reused: boolean
} | null> {
  const sale = await loadSalePdfInput(input.dental, input.saleId)
  if (!sale) return null
  const filename = salePdfFilename(sale)
  const storagePath = salePdfStoragePath({
    branch_id: input.branchId,
    sale_id: input.saleId,
    receipt_number: sale.receipt_number,
    price_list: sale.price_list,
  })

  const existing = await input.storage
    .from('sale-documents')
    .download(storagePath)
  if (!existing.error && existing.data) {
    const bytes = new Uint8Array(await existing.data.arrayBuffer())
    if (bytes.length > 0) {
      return { bytes, filename, storagePath, reused: true }
    }
  }

  const logo = readClinicLogoBytes()
  const bytes = await buildSalePdf(sale, logo)
  const uploaded = await input.storage
    .from('sale-documents')
    .upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploaded.error) {
    console.warn('sale-documents upload failed:', uploaded.error.message)
  }
  return { bytes, filename, storagePath, reused: false }
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
          'WhatsApp send secrets missing. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
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
  const storageClient = createClient(supabaseUrl, serviceKey, {
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
    const bodyText = appendCareFooter(
      renderBody(row.body_text, row.params ?? {}),
    )
    const approvedName =
      row.template_status === 'approved' &&
      row.whatsapp_template_id &&
      row.whatsapp_template_id.trim().length > 0 &&
      !/^HX[0-9a-fA-F]+$/i.test(row.whatsapp_template_id.trim())
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

      let pdfPayload: Record<string, unknown> | null = null
      const wantsPdf =
        mode === 'text' &&
        row.related_type === 'sale' &&
        !!row.related_id &&
        (row.kind === 'receipt_notice' || row.kind === 'invoice_notice')

      if (wantsPdf) {
        try {
          const pdf = await ensureSalePdfBytes({
            dental,
            storage: storageClient.storage,
            branchId: row.branch_id,
            saleId: row.related_id!,
          })
          if (!pdf) throw new Error('Sale not found for PDF')
          const mediaId = await uploadMetaMedia({
            token: accessToken,
            phoneNumberId,
            graphVersion,
            filename: pdf.filename,
            bytes: pdf.bytes,
          })
          const docSent = await sendDocumentMessage({
            token: accessToken,
            phoneNumberId,
            graphVersion,
            to,
            mediaId,
            filename: pdf.filename,
            caption:
              row.kind === 'invoice_notice'
                ? 'Your N.I SMILE tax invoice (PDF)'
                : 'Your N.I SMILE receipt (PDF)',
          })
          pdfPayload = {
            media_id: mediaId,
            document_message_id: docSent.id,
            filename: pdf.filename,
            storage_path: pdf.storagePath,
            reused: pdf.reused,
            meta: docSent.raw,
          }
        } catch (pdfErr) {
          const message =
            pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
          console.warn('sale PDF WhatsApp failed:', message)
          pdfPayload = { error: message }
        }
      }

      const { error: markErr } = await dental.rpc('mark_notification_sent', {
        p_queue_id: row.queue_id,
        p_provider_message_id: sent.id,
        p_body_preview: bodyText.slice(0, 280),
        p_payload: {
          source: 'send-whatsapp',
          provider: 'meta_cloud_api',
          mode,
          template_name: templateName,
          meta: sent.raw,
          ...(pdfPayload
            ? {
                pdf: pdfPayload.error
                  ? { error: pdfPayload.error }
                  : pdfPayload,
                pdf_error: pdfPayload.error ?? null,
              }
            : {}),
        },
      })
      if (markErr) throw new Error(markErr.message)

      results.push({
        queue_id: row.queue_id,
        ok: true,
        provider_message_id: sent.id,
        mode,
        template_name: templateName,
        pdf: pdfPayload
          ? pdfPayload.error
            ? { ok: false, error: pdfPayload.error }
            : {
                ok: true,
                filename: pdfPayload.filename,
                document_message_id: pdfPayload.document_message_id,
              }
          : null,
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
