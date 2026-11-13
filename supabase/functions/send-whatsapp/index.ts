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
 * the template API (language from WHATSAPP_TEMPLATE_LANGUAGE, default en).
 * Otherwise free-form text (24h customer window).
 * Sale receipt/invoice: when the Meta name is nis_receipt_notice_v3 or
 * nis_invoice_notice_v3, the A4 PDF rides in the template document header.
 * Live *_en templates still get the care line on the last fill-in. *_v3
 * templates use Meta's static footer instead (docs/WhatsApp-Templates-v3.md).
 *
 * Logo image header for names ending _v2 or _v3 (except receipt/invoice _v3).
 * Image URL: WHATSAPP_HEADER_IMAGE_URL or https://nismile.m2btek.com/whatsapp-header.jpg.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  appendCareFooter,
  CARE_LINE,
  CARE_WA_ME,
} from '../_shared/whatsapp_care_footer.ts'
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

/**
 * Live *_en templates have no Meta footer. Put the care line on the last fill-in
 * so those messages still show how to reach Customer Care. *_v3 templates skip
 * this — contact is the Meta footer "Questions? Contact +252 63 4548732".
 */
function paramsWithCareFooter(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(params)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
  const last = keys[keys.length - 1]
  if (!last) return { '1': CARE_LINE }
  const current = String(params[last] ?? '').trim()
  if (current.includes(CARE_WA_ME)) return params
  const next = current ? `${current}. ${CARE_LINE}` : CARE_LINE
  return { ...params, [last]: next }
}

function shouldInjectCareIntoParams(templateName: string | null): boolean {
  if (!templateName) return false
  if (/_v3$/i.test(templateName)) return false
  return true
}

const DEFAULT_HEADER_IMAGE_URL = 'https://nismile.m2btek.com/whatsapp-header.jpg'

const DOCUMENT_HEADER_TEMPLATES = new Set([
  'nis_receipt_notice_v3',
  'nis_invoice_notice_v3',
  // Legacy experiment; keep until the v3 receipt is approved and switched on.
  'nis_receipt_file_en',
])

function isDocumentHeaderTemplate(templateName: string | null): boolean {
  return !!templateName && DOCUMENT_HEADER_TEMPLATES.has(templateName)
}

/** Logo image for _v2 / _v3 templates that are not the receipt/invoice PDF header. */
function headerImageFor(templateName: string | null): string | null {
  if (!templateName) return null
  if (isDocumentHeaderTemplate(templateName)) return null
  if (!/_v[23]$/i.test(templateName)) return null
  return Deno.env.get('WHATSAPP_HEADER_IMAGE_URL') || DEFAULT_HEADER_IMAGE_URL
}

/** Meta rejects empty values, newlines, tabs and runs of 4+ spaces inside a template value. */
function cleanTemplateParam(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim()
  return text || '-'
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
  headerImageUrl?: string | null
  headerDocument?: { id: string; filename: string } | null
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
      text: cleanTemplateParam(input.params[k]),
    }))
    const components: Record<string, unknown>[] = []
    if (input.headerDocument) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              id: input.headerDocument.id,
              filename: input.headerDocument.filename,
            },
          },
        ],
      })
    } else if (input.headerImageUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: input.headerImageUrl } }],
      })
    }
    if (parameters.length > 0 && input.templateName !== 'hello_world') {
      components.push({ type: 'body', parameters })
    }
    payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: input.templateName,
        // This WABA's approved templates use language code "en" (not en_US).
        language: {
          code: Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || 'en',
        },
        components: components.length > 0 ? components : undefined,
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

async function graphJson(
  token: string,
  graphVersion: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; raw: Record<string, unknown> }> {
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, raw }
}

function graphError(raw: Record<string, unknown>, fallback: string): string {
  const message = (raw.error as { message?: string } | undefined)?.message
  return message || fallback
}

/** Create the receipt template whose header is the PDF file, if it is not there yet. */
async function prepareReceiptFileTemplate(input: {
  token: string
  phoneNumberId: string
  graphVersion: string
  // deno-lint-ignore no-explicit-any
  dental: any
  // deno-lint-ignore no-explicit-any
  storage: any
}): Promise<Record<string, unknown>> {
  const phone = await graphJson(
    input.token,
    input.graphVersion,
    `${input.phoneNumberId}?fields=health_status`,
  )
  if (!phone.ok) {
    return { ok: false, error: graphError(phone.raw, 'Phone lookup failed') }
  }
  const entities = (
    (phone.raw.health_status as { entities?: { entity_type?: string; id?: string }[] } | undefined)
      ?.entities ?? []
  )
  const wabaId = entities.find((entity) => entity.entity_type === 'WABA')?.id ?? ''
  const appId = entities.find((entity) => entity.entity_type === 'APP')?.id ?? ''
  if (!wabaId || !appId) return { ok: false, error: 'WhatsApp account id was not on the phone' }

  const existing = await graphJson(
    input.token,
    input.graphVersion,
    `${wabaId}/message_templates?name=nis_receipt_file_en&limit=5`,
  )
  const existingRows = (existing.raw.data as { name?: string; status?: string; id?: string }[] | undefined) ?? []
  const already = existingRows.find((row) => row.name === 'nis_receipt_file_en')
  if (already) {
    return { ok: true, created: false, id: already.id ?? null, status: already.status ?? null }
  }

  const current = await graphJson(
    input.token,
    input.graphVersion,
    `${wabaId}/message_templates?name=nis_receipt_notice_en&limit=5`,
  )
  const currentRows = (current.raw.data as {
    name?: string
    components?: { type?: string; text?: string; example?: unknown }[]
  }[] | undefined) ?? []
  const source = currentRows.find((row) => row.name === 'nis_receipt_notice_en')
  const body = source?.components?.find((component) => (component.type || '').toUpperCase() === 'BODY')
  const footer = source?.components?.find((component) => (component.type || '').toUpperCase() === 'FOOTER')
  if (!body?.text) {
    return { ok: false, error: graphError(current.raw, 'Current receipt template was not found') }
  }

  const pdf = await ensureSalePdfBytes({
    dental: input.dental,
    storage: input.storage,
    branchId: 'a3c9a3e2-bfbb-4305-9613-91d3c9eeac12',
    saleId: '53d89361-1d5b-4a50-9f3b-00d20c731608',
  })
  if (!pdf) return { ok: false, error: 'Sample receipt PDF was not found' }

  const session = await graphJson(
    input.token,
    input.graphVersion,
    `${appId}/uploads?file_name=${encodeURIComponent(pdf.filename)}&file_length=${pdf.bytes.byteLength}&file_type=application/pdf`,
    { method: 'POST' },
  )
  const sessionId = String(session.raw.id ?? '')
  if (!session.ok || !sessionId) {
    return { ok: false, error: graphError(session.raw, 'PDF sample upload did not start') }
  }

  const uploadRes = await fetch(`https://graph.facebook.com/${input.graphVersion}/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${input.token}`,
      file_offset: '0',
      'Content-Type': 'application/pdf',
    },
    body: pdf.bytes,
  })
  const uploadRaw = (await uploadRes.json().catch(() => ({}))) as { h?: string; error?: { message?: string } }
  const handle = uploadRaw.h ?? ''
  if (!uploadRes.ok || !handle) {
    return { ok: false, error: uploadRaw.error?.message || 'PDF sample upload failed' }
  }

  const created = await graphJson(
    input.token,
    input.graphVersion,
    `${wabaId}/message_templates`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'nis_receipt_file_en',
        language: 'en',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'DOCUMENT',
            example: { header_handle: [handle] },
          },
          {
            type: 'BODY',
            text: body.text,
            ...(body.example ? { example: body.example } : {}),
          },
          ...(footer?.text ? [{ type: 'FOOTER', text: footer.text }] : []),
        ],
      }),
    },
  )
  if (!created.ok) {
    return { ok: false, error: graphError(created.raw, 'Receipt file template was not created') }
  }
  return {
    ok: true,
    created: true,
    id: created.raw.id ?? null,
    status: created.raw.status ?? 'PENDING',
  }
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
  let findAccount = false
  try {
    const body = await req.json().catch(() => ({}))
    if (body && typeof body === 'object') {
      if (typeof (body as { limit?: unknown }).limit === 'number') {
        limit = (body as { limit: number }).limit
      }
      if (typeof (body as { queue_id?: unknown }).queue_id === 'string') {
        queueId = (body as { queue_id: string }).queue_id
      }
      findAccount = (body as { find_account?: unknown }).find_account === true
    }
  } catch {
    /* empty body ok */
  }

  if (findAccount && role === 'owner') {
    return json(await prepareReceiptFileTemplate({
      token: accessToken,
      phoneNumberId,
      graphVersion,
      dental,
      storage: storageClient.storage,
    }))
    const auth = { Authorization: `Bearer ${accessToken}` }
    const get = async (path: string) => {
      const res = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
        headers: auth,
      })
      const raw = await res.json().catch(() => ({}))
      return { status: res.status, raw }
    }
    const debug = await get(
      `debug_token?input_token=${encodeURIComponent(accessToken)}`,
    )
    const debugData = (debug.raw as { data?: { app_id?: string; user_id?: string } }).data
    const probes = [
      `${phoneNumberId}?metadata=1`,
      `${phoneNumberId}?fields=health_status,account_mode,status,is_official_business_account`,
      '1810714253642075/whatsapp_business_accounts?fields=id,name&limit=20',
      '122106001251441947/businesses?fields=id,name&limit=20',
      '122106001251441947?fields=id,name',
    ]
    const results = []
    for (const path of probes) {
      const hit = await get(path)
      const err = (hit.raw as { error?: { message?: string } }).error?.message ?? null
      const data = (hit.raw as { data?: { id?: string; name?: string; display_phone_number?: string }[] }).data
      const fieldNames = (
        (hit.raw as { metadata?: { fields?: { name?: string }[] } }).metadata?.fields ?? []
      ).map((field) => field.name ?? '').filter(Boolean)
      results.push({
        path: path.split('?')[0],
        status: hit.status,
        error: err,
        id: (hit.raw as { id?: string }).id ?? null,
        name: (hit.raw as { verified_name?: string; name?: string }).verified_name
          ?? (hit.raw as { name?: string }).name
          ?? null,
        phone: (hit.raw as { display_phone_number?: string }).display_phone_number ?? null,
        keys: Object.keys(hit.raw as object),
        entities: (
          (hit.raw as {
            health_status?: { entities?: { entity_type?: string; id?: string }[] }
          }).health_status?.entities ?? []
        ).map((entity) => ({
          type: entity.entity_type ?? '',
          id: entity.id ?? '',
        })),
        accounts: Array.isArray(data)
          ? data.map((row) => ({
              id: row.id ?? '',
              name: row.name ?? row.display_phone_number ?? '',
            }))
          : [],
      })
    }
    const wabaIds = [
      '971929712636928',
      '3511786538980918',
      '1760730258560715',
      '1425008463157224',
      ...results.flatMap((row) => row.accounts.map((account) => account.id)),
    ]
    const accounts = []
    for (const wabaId of [...new Set(wabaIds)]) {
      const phones = await get(`${wabaId}/phone_numbers?fields=id,display_phone_number&limit=20`)
      const templates = await get(
        `${wabaId}/message_templates?name=nis_receipt_notice_en&limit=5`,
      )
      const phoneRows = (phones.raw as { data?: { id?: string; display_phone_number?: string }[] }).data ?? []
      const templateRows = (templates.raw as { data?: { name?: string; status?: string }[] }).data ?? []
      accounts.push({
        wabaId,
        phoneStatus: phones.status,
        phoneError: (phones.raw as { error?: { message?: string } }).error?.message ?? null,
        phones: phoneRows.map((row) => ({
          id: row.id ?? '',
          display: row.display_phone_number ?? '',
        })),
        templateStatus: templates.status,
        templateError: (templates.raw as { error?: { message?: string } }).error?.message ?? null,
        templates: templateRows.map((row) => ({
          name: row.name ?? '',
          status: row.status ?? '',
        })),
      })
    }
    return json({
      ok: true,
      app_id: debugData?.app_id ?? null,
      probes: results,
      accounts,
    })
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
      let pdfPayload: Record<string, unknown> | null = null
      const wantsPdf =
        row.related_type === 'sale' &&
        !!row.related_id &&
        (row.kind === 'receipt_notice' || row.kind === 'invoice_notice')

      let headerDocument: { id: string; filename: string } | null = null
      if (wantsPdf && isDocumentHeaderTemplate(approvedName)) {
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
        headerDocument = { id: mediaId, filename: pdf.filename }
        pdfPayload = {
          media_id: mediaId,
          filename: pdf.filename,
          storage_path: pdf.storagePath,
          reused: pdf.reused,
          attached: 'template_header',
        }
      }

      const templateParams =
        approvedName && shouldInjectCareIntoParams(approvedName)
          ? paramsWithCareFooter(row.params ?? {})
          : (row.params ?? {})

      try {
        sent = await sendCloudMessage({
          token: accessToken,
          phoneNumberId,
          graphVersion,
          to,
          bodyText,
          templateName: approvedName,
          language: row.language,
          params: templateParams,
          headerImageUrl: headerDocument ? null : headerImageFor(approvedName),
          headerDocument,
        })
        if (headerDocument && pdfPayload) {
          pdfPayload.document_message_id = sent.id
        }
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
