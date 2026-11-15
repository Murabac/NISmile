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
 * Sale receipt/invoice: when the Meta name is nis_receipt_notice_v3c or
 * nis_invoice_notice_v3c, the A4 PDF rides in the template document header.
 * Live *_en templates still get the care line on the last fill-in. *_v3b
 * templates use Meta's static footer + Contact care URL button
 * (docs/WhatsApp-Templates-v3.md).
 *
 * Logo image header for names ending _v2 or _v3b (except receipt/invoice).
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
 * so those messages still show how to reach Customer Care. *_v3b templates skip
 * this — contact is the Meta footer + tappable Contact care button.
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
  // Meta footer + Contact care button cover care contact.
  if (/_v3[bc]?$/i.test(templateName)) return false
  return true
}

const DEFAULT_HEADER_IMAGE_URL = 'https://nismile.m2btek.com/whatsapp-header.jpg'

const DOCUMENT_HEADER_TEMPLATES = new Set([
  'nis_receipt_notice_v3c',
  'nis_invoice_notice_v3c',
  'nis_receipt_notice_v3b',
  'nis_invoice_notice_v3b',
  'nis_receipt_notice_v3',
  'nis_invoice_notice_v3',
  // Legacy experiment; keep until the v3 receipt is approved and switched on.
  'nis_receipt_file_en',
])

function isDocumentHeaderTemplate(templateName: string | null): boolean {
  return !!templateName && DOCUMENT_HEADER_TEMPLATES.has(templateName)
}

/** Logo image for _v2 / _v3b templates that are not the receipt/invoice PDF header. */
function headerImageFor(templateName: string | null): string | null {
  if (!templateName) return null
  if (isDocumentHeaderTemplate(templateName)) return null
  if (!/_v(?:2|3[bc]?)$/i.test(templateName)) return null
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

const V3_FOOTER = 'Questions? Contact +252 63 4548732'
/** Opens the human care WhatsApp (not the Cloud API number). */
const V3_CARE_BUTTON_TEXT = 'Contact care'
/** Meta rejects wa.me on URL buttons; this public page links to care WhatsApp. */
const V3_CARE_BUTTON_URL =
  'https://iwnswhnoxbvgyqljfvel.supabase.co/functions/v1/care-whatsapp'

type V3TemplateSpec = {
  name: string
  category: 'UTILITY' | 'MARKETING'
  header: 'IMAGE' | 'DOCUMENT'
  body: string
  examples: string[]
}

/** Bodies match docs/WhatsApp-Templates-v3.md. Footer + tappable Contact care button. */
const V3_TEMPLATES: V3TemplateSpec[] = [
  {
    name: 'nis_appointment_confirmation_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nYour appointment at N.I SMILE is booked.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    examples: ['Maryam', 'Friday, 13 November', '12:00 PM', 'Dr. Hodan Ali'],
  },
  {
    name: 'nis_appointment_reminder_24h_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nReminder: your appointment at N.I SMILE is {{2}}.\n\n*Date:* {{3}}\n*Time:* {{4}}\n*Dentist:* {{5}}\n\nReply *1* to confirm or *2* to cancel.',
    examples: ['Maryam', 'tomorrow', 'Friday, 13 November', '12:00 PM', 'Dr. Hodan Ali'],
  },
  {
    name: 'nis_appointment_reminder_2h_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nYour appointment at N.I SMILE is in about 2 hours.\n\n*Date:* {{2}}\n*Time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    examples: ['Maryam', 'Friday, 13 November', '12:00 PM', 'Dr. Hodan Ali'],
  },
  {
    name: 'nis_appointment_reschedule_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nYour appointment at N.I SMILE has been rescheduled.\n\n*New date:* {{2}}\n*New time:* {{3}}\n*Dentist:* {{4}}\n\nReply *1* to confirm or *2* to cancel.',
    examples: ['Maryam', 'Saturday, 14 November', '10:30 AM', 'Dr. Hodan Ali'],
  },
  {
    name: 'nis_appointment_cancel_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nYour appointment at N.I SMILE on {{2}} at {{3}} has been cancelled. We can book a new time for you.',
    examples: ['Maryam', 'Friday, 13 November', '12:00 PM'],
  },
  {
    name: 'nis_appointment_reply_confirmed_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Thank you {{1}}! Your appointment is confirmed.\n\n*Date:* {{2}}\n*Time:* {{3}}\n\nWe look forward to seeing you at N.I SMILE.',
    examples: ['Maryam', 'Friday, 13 November', '12:00 PM'],
  },
  {
    name: 'nis_appointment_reply_cancelled_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Thank you {{1}}. Your appointment on {{2}} at {{3}} has been cancelled.\n\nTo book a new time, just message us.',
    examples: ['Maryam', 'Friday, 13 November', '12:00 PM'],
  },
  {
    name: 'nis_receipt_notice_v3c',
    category: 'UTILITY',
    header: 'DOCUMENT',
    body:
      'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your receipt summary.\n\n*Receipt:* {{2}}\n*Total:* USD {{3}}\n*Paid:* USD {{4}}\n*Open balance:* USD {{5}}\n*Due date:* {{6}}.\n\nWe appreciate your visit.',
    examples: ['Ali', 'RCP-20261113-001', '85.00', '85.00', '0.00', '13 November 2026'],
  },
  {
    name: 'nis_invoice_notice_v3c',
    category: 'UTILITY',
    header: 'DOCUMENT',
    body:
      'Hello {{1}},\n\nThank you for choosing N.I SMILE. Here is your invoice summary.\n\n*Invoice:* {{2}}\n*Total:* USD {{3}}\n*Paid:* USD {{4}}\n*Open balance:* USD {{5}}\n*Due date:* {{6}}.\n\nWe appreciate your business.',
    examples: ['Ali', 'INV-20261113-001', '340.00', '100.00', '240.00', '20 November 2026'],
  },
  {
    name: 'nis_payment_due_reminder_v3c',
    category: 'UTILITY',
    header: 'IMAGE',
    body:
      'Hello {{1}},\n\nThis is a payment reminder from N.I SMILE.\n\n*Open balance:* USD {{2}}\n*Due date:* {{3}}\n\nPlease pay it on time.',
    examples: ['Ali', '240.00', '20 November 2026'],
  },
  {
    name: 'nis_promotion_announcement_v3c',
    category: 'MARKETING',
    header: 'IMAGE',
    body: 'Hello,\n\n{{1}}\n\nReply STOP to opt out.',
    examples: ['10% off teeth whitening until 30 November'],
  },
  {
    name: 'nis_promotion_ending_soon_v3c',
    category: 'MARKETING',
    header: 'IMAGE',
    body: 'Hello,\n\nEnding soon: {{1}}\n\nReply STOP to opt out.',
    examples: ['10% off teeth whitening, last day is 30 November'],
  },
]

async function uploadAppMediaHandle(input: {
  token: string
  graphVersion: string
  appId: string
  filename: string
  mime: string
  bytes: Uint8Array
}): Promise<string> {
  const session = await graphJson(
    input.token,
    input.graphVersion,
    `${input.appId}/uploads?file_name=${encodeURIComponent(input.filename)}&file_length=${input.bytes.byteLength}&file_type=${encodeURIComponent(input.mime)}`,
    { method: 'POST' },
  )
  const sessionId = String(session.raw.id ?? '')
  if (!session.ok || !sessionId) {
    throw new Error(graphError(session.raw, `Upload session failed for ${input.filename}`))
  }
  const uploadRes = await fetch(
    `https://graph.facebook.com/${input.graphVersion}/${sessionId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${input.token}`,
        file_offset: '0',
        'Content-Type': input.mime,
      },
      body: input.bytes,
    },
  )
  const uploadRaw = (await uploadRes.json().catch(() => ({}))) as {
    h?: string
    error?: { message?: string }
  }
  const handle = uploadRaw.h ?? ''
  if (!uploadRes.ok || !handle) {
    throw new Error(uploadRaw.error?.message || `Upload failed for ${input.filename}`)
  }
  return handle
}

/** Create every v3 template on the phone's WABA (idempotent). */
async function submitV3Templates(input: {
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
  if (!wabaId || !appId) {
    return { ok: false, error: 'WhatsApp account id was not on the phone' }
  }

  const imageRes = await fetch(
    Deno.env.get('WHATSAPP_HEADER_IMAGE_URL') || DEFAULT_HEADER_IMAGE_URL,
  )
  if (!imageRes.ok) {
    return { ok: false, error: `Logo image fetch failed HTTP ${imageRes.status}` }
  }
  const imageBytes = new Uint8Array(await imageRes.arrayBuffer())
  let imageHandle: string
  try {
    imageHandle = await uploadAppMediaHandle({
      token: input.token,
      graphVersion: input.graphVersion,
      appId,
      filename: 'whatsapp-header.jpg',
      mime: 'image/jpeg',
      bytes: imageBytes,
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const pdf = await ensureSalePdfBytes({
    dental: input.dental,
    storage: input.storage,
    branchId: 'a3c9a3e2-bfbb-4305-9613-91d3c9eeac12',
    saleId: '53d89361-1d5b-4a50-9f3b-00d20c731608',
  })
  if (!pdf) return { ok: false, error: 'Sample receipt PDF was not found' }
  let documentHandle: string
  try {
    documentHandle = await uploadAppMediaHandle({
      token: input.token,
      graphVersion: input.graphVersion,
      appId,
      filename: pdf.filename,
      mime: 'application/pdf',
      bytes: pdf.bytes,
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  const results: Record<string, unknown>[] = []
  let deletedAny = false
  const skipCreate = new Set<string>()

  for (const spec of V3_TEMPLATES) {
    const existing = await graphJson(
      input.token,
      input.graphVersion,
      `${wabaId}/message_templates?name=${encodeURIComponent(spec.name)}&limit=5`,
    )
    const existingRows =
      (existing.raw.data as { name?: string; status?: string; id?: string }[] | undefined) ?? []
    const already = existingRows.find((row) => row.name === spec.name)
    if (!already) continue
    const status = (already.status || '').toUpperCase()
    if (status === 'PENDING' || status === 'REJECTED') {
      const deleted = await graphJson(
        input.token,
        input.graphVersion,
        `${wabaId}/message_templates?name=${encodeURIComponent(spec.name)}`,
        { method: 'DELETE' },
      )
      if (!deleted.ok) {
        results.push({
          name: spec.name,
          created: false,
          ok: false,
          error: graphError(deleted.raw, `Could not replace ${status} template`),
        })
        skipCreate.add(spec.name)
        continue
      }
      deletedAny = true
      continue
    }
    results.push({
      name: spec.name,
      created: false,
      id: already.id ?? null,
      status: already.status ?? null,
    })
    skipCreate.add(spec.name)
  }

  // Meta keeps the language locked briefly after DELETE; wait once before recreates.
  if (deletedAny) {
    await new Promise((resolve) => setTimeout(resolve, 90_000))
  }

  for (const spec of V3_TEMPLATES) {
    if (skipCreate.has(spec.name)) continue

    const headerHandle = spec.header === 'DOCUMENT' ? documentHandle : imageHandle
    const created = await graphJson(
      input.token,
      input.graphVersion,
      `${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: spec.name,
          language: 'en',
          category: spec.category,
          components: [
            {
              type: 'HEADER',
              format: spec.header,
              example: { header_handle: [headerHandle] },
            },
            {
              type: 'BODY',
              text: spec.body,
              example: { body_text: [spec.examples] },
            },
            { type: 'FOOTER', text: V3_FOOTER },
            {
              type: 'BUTTONS',
              buttons: [
                {
                  type: 'URL',
                  text: V3_CARE_BUTTON_TEXT,
                  url: V3_CARE_BUTTON_URL,
                },
              ],
            },
          ],
        }),
      },
    )
    if (!created.ok) {
      const detail =
        (created.raw.error as { error_user_msg?: string; message?: string } | undefined)
          ?.error_user_msg ||
        graphError(created.raw, 'Template create failed')
      results.push({
        name: spec.name,
        created: false,
        ok: false,
        error: detail,
      })
      continue
    }
    results.push({
      name: spec.name,
      created: true,
      ok: true,
      id: created.raw.id ?? null,
      status: created.raw.status ?? 'PENDING',
    })
  }

  const failed = results.filter((row) => row.ok === false)
  return {
    ok: failed.length === 0,
    waba_id: wabaId,
    templates: results,
    failed: failed.length,
  }
}

/** Keep only nis_*_v3c; delete older nis_* Meta templates (_en, _v2, _v3, _v3b, …). */
function isRetiredNisTemplate(name: string): boolean {
  if (!/^nis_/i.test(name)) return false
  if (/_v3c$/i.test(name)) return false
  return true
}

async function cleanupOldMetaTemplates(input: {
  token: string
  phoneNumberId: string
  graphVersion: string
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
  if (!wabaId) {
    return { ok: false, error: 'WhatsApp account id was not on the phone' }
  }

  const listed: { name?: string; status?: string; id?: string }[] = []
  let after: string | undefined
  for (let page = 0; page < 20; page += 1) {
    const path =
      `${wabaId}/message_templates?limit=100&fields=name,status,id` +
      (after ? `&after=${encodeURIComponent(after)}` : '')
    const pageRes = await graphJson(input.token, input.graphVersion, path)
    if (!pageRes.ok) {
      return { ok: false, error: graphError(pageRes.raw, 'Template list failed'), waba_id: wabaId }
    }
    const rows =
      (pageRes.raw.data as { name?: string; status?: string; id?: string }[] | undefined) ?? []
    listed.push(...rows)
    after = (pageRes.raw.paging as { cursors?: { after?: string } } | undefined)?.cursors?.after
    if (!after || rows.length === 0) break
  }

  const keep = listed.filter((row) => row.name && !isRetiredNisTemplate(row.name))
  const retire = listed.filter((row) => row.name && isRetiredNisTemplate(row.name))
  const results: Record<string, unknown>[] = []

  for (const row of retire) {
    const name = row.name!
    const deleted = await graphJson(
      input.token,
      input.graphVersion,
      `${wabaId}/message_templates?name=${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    )
    results.push({
      name,
      id: row.id ?? null,
      status: row.status ?? null,
      ok: deleted.ok,
      error: deleted.ok ? null : graphError(deleted.raw, 'Delete failed'),
    })
  }

  const failed = results.filter((row) => row.ok === false)
  return {
    ok: failed.length === 0,
    waba_id: wabaId,
    kept: keep.map((row) => ({ name: row.name, status: row.status, id: row.id })),
    deleted: results,
    failed: failed.length,
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
  let cleanupOldTemplates = false
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
      cleanupOldTemplates =
        (body as { cleanup_old_templates?: unknown }).cleanup_old_templates === true
    }
  } catch {
    /* empty body ok */
  }

  if (cleanupOldTemplates && role === 'owner') {
    return json(
      await cleanupOldMetaTemplates({
        token: accessToken,
        phoneNumberId,
        graphVersion,
      }),
    )
  }

  if (findAccount && role === 'owner') {
    return json(
      await submitV3Templates({
        token: accessToken,
        phoneNumberId,
        graphVersion,
        dental,
        storage: storageClient.storage,
      }),
    )
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
