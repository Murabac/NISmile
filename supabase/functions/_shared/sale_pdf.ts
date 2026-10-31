/**
 * English A4 sale PDF for WhatsApp document attachment (pdf-lib).
 */
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { NISMILE_LOGO_JPEG_BASE64 } from './nismile_logo_b64.ts'

export const CLINIC_LEGAL_NAME = 'N.I SMILE Oral care & Teeth whitening'
export const CLINIC_ADDRESS = '26 June Road 1, Hargeisa, Somaliland'
export const CLINIC_PHONE = '+252 63 4749276'
export const CLINIC_TAX_ID = '11114'
export const CLINIC_ZAAD = '484594'
export const CLINIC_EDAHAB = '764043'
export const CLINIC_MYCASH = 'Pending'

const TENDER_LABELS: Record<string, string> = {
  cash: 'Cash',
  zaad: 'Zaad',
  edahab: 'eDahab',
  mycash: 'MyCash',
}

export type SalePdfInput = {
  receipt_number: string
  price_list: string
  status: string
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_total: number
  due_date: string | null
  created_at: string
  customer_name: string
  lines: Array<{
    sku_or_code: string
    name: string
    qty: number
    unit_price: number
    tax_amount: number
    line_gross: number
  }>
  payments: Array<{
    tender: string
    amount: number
    reference: string | null
  }>
}

export function invoiceNumberFromReceipt(receiptNumber: string) {
  return receiptNumber.replace(/^RCP/i, 'INV')
}

export function salePdfFilename(input: {
  receipt_number: string
  price_list: string
}): string {
  if (input.price_list === 'wholesale') {
    return `${invoiceNumberFromReceipt(input.receipt_number)}.pdf`
  }
  return `${input.receipt_number}.pdf`
}

export function salePdfStoragePath(input: {
  branch_id: string
  sale_id: string
  receipt_number: string
  price_list: string
}): string {
  return `${input.branch_id}/${input.sale_id}/${salePdfFilename(input)}`
}

function money(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`
}

function truncate(s: string, max: number): string {
  const t = (s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Build A4 portrait PDF bytes. Optional JPEG/PNG logo bytes. */
export async function buildSalePdf(
  sale: SalePdfInput,
  logoBytes?: Uint8Array | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.06, 0.15, 0.18)
  const muted = rgb(0.33, 0.43, 0.46)
  const accent = rgb(0.05, 0.23, 0.29)

  let y = 800
  const left = 48
  const right = 547

  if (logoBytes && logoBytes.length > 0) {
    try {
      const isPng =
        logoBytes[0] === 0x89 &&
        logoBytes[1] === 0x50 &&
        logoBytes[2] === 0x4e &&
        logoBytes[3] === 0x47
      const img = isPng
        ? await doc.embedPng(logoBytes)
        : await doc.embedJpg(logoBytes)
      const w = 64
      const h = (img.height / img.width) * w
      page.drawImage(img, { x: left, y: y - h, width: w, height: h })
    } catch {
      /* logo optional */
    }
  }

  const isWholesale = sale.price_list === 'wholesale'
  const title = isWholesale ? 'TAX INVOICE' : 'RECEIPT'
  const docNo = isWholesale
    ? invoiceNumberFromReceipt(sale.receipt_number)
    : sale.receipt_number

  page.drawText(title, {
    x: right - fontBold.widthOfTextAtSize(title, 18),
    y: y - 18,
    size: 18,
    font: fontBold,
    color: accent,
  })
  page.drawText(`#${docNo}`, {
    x: right - fontBold.widthOfTextAtSize(`#${docNo}`, 10),
    y: y - 36,
    size: 10,
    font: fontBold,
    color: rgb(0.07, 0.65, 0.63),
  })

  y -= 78
  page.drawText(CLINIC_LEGAL_NAME, {
    x: left,
    y,
    size: 11,
    font: fontBold,
    color: ink,
  })
  y -= 14
  for (const line of [
    CLINIC_ADDRESS,
    `Tel: ${CLINIC_PHONE}`,
    `Tax ID: ${CLINIC_TAX_ID}`,
  ]) {
    page.drawText(line, { x: left, y, size: 9, font, color: muted })
    y -= 12
  }

  y -= 8
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.87, 0.91, 0.9),
  })
  y -= 22

  const dateLabel = new Date(sale.created_at).toLocaleDateString('en-GB')
  page.drawText('Bill to', { x: left, y, size: 9, font: fontBold, color: accent })
  page.drawText('Payment status', {
    x: 340,
    y,
    size: 9,
    font: fontBold,
    color: accent,
  })
  y -= 14
  page.drawText(truncate(sale.customer_name || 'Customer', 42), {
    x: left,
    y,
    size: 10,
    font: fontBold,
    color: ink,
  })
  page.drawText(sale.status, {
    x: 340,
    y,
    size: 10,
    font: fontBold,
    color: ink,
  })
  y -= 13
  page.drawText(
    isWholesale ? 'Wholesale account' : 'Retail / walk-in',
    { x: left, y, size: 9, font, color: muted },
  )
  page.drawText(`Paid ${money(sale.paid_total)} of ${money(sale.total)}`, {
    x: 340,
    y,
    size: 9,
    font,
    color: muted,
  })
  y -= 13
  page.drawText(`Date: ${dateLabel}`, {
    x: left,
    y,
    size: 9,
    font,
    color: muted,
  })
  if (sale.due_date) {
    page.drawText(`Due: ${sale.due_date}`, {
      x: 340,
      y,
      size: 9,
      font,
      color: muted,
    })
  }
  y -= 13
  page.drawText(`Receipt: ${sale.receipt_number}`, {
    x: left,
    y,
    size: 9,
    font,
    color: muted,
  })

  y -= 20
  const cols = [
    { label: 'Code', x: left, w: 70 },
    { label: 'Description', x: left + 72, w: 180 },
    { label: 'Qty', x: left + 260, w: 36 },
    { label: 'Unit', x: left + 300, w: 60 },
    { label: 'VAT', x: left + 365, w: 55 },
    { label: 'Gross', x: left + 425, w: 70 },
  ]
  for (const c of cols) {
    page.drawText(c.label, {
      x: c.x,
      y,
      size: 8,
      font: fontBold,
      color: muted,
    })
  }
  y -= 6
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.8,
    color: rgb(0.87, 0.91, 0.9),
  })
  y -= 14

  for (const line of sale.lines) {
    if (y < 120) break
    page.drawText(truncate(line.sku_or_code, 12), {
      x: cols[0].x,
      y,
      size: 8,
      font,
      color: ink,
    })
    page.drawText(truncate(line.name, 34), {
      x: cols[1].x,
      y,
      size: 8,
      font,
      color: ink,
    })
    const qty = String(line.qty)
    const unit = money(line.unit_price)
    const vat = money(line.tax_amount)
    const gross = money(line.line_gross)
    page.drawText(qty, {
      x: cols[2].x + cols[2].w - font.widthOfTextAtSize(qty, 8),
      y,
      size: 8,
      font,
      color: ink,
    })
    page.drawText(unit, {
      x: cols[3].x + cols[3].w - font.widthOfTextAtSize(unit, 8),
      y,
      size: 8,
      font,
      color: ink,
    })
    page.drawText(vat, {
      x: cols[4].x + cols[4].w - font.widthOfTextAtSize(vat, 8),
      y,
      size: 8,
      font,
      color: ink,
    })
    page.drawText(gross, {
      x: cols[5].x + cols[5].w - fontBold.widthOfTextAtSize(gross, 8),
      y,
      size: 8,
      font: fontBold,
      color: ink,
    })
    y -= 13
  }

  y -= 10
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 0.8,
    color: rgb(0.87, 0.91, 0.9),
  })
  y -= 18

  const totals: Array<[string, string, boolean]> = [
    ['Subtotal (ex-VAT)', money(sale.subtotal), false],
  ]
  if (sale.discount_total > 0.009) {
    totals.push(['Discount', `-${money(sale.discount_total)}`, false])
  }
  totals.push(['VAT', money(sale.tax_total), false])
  totals.push(['Total', money(sale.total), true])
  totals.push(['Paid', money(sale.paid_total), false])
  const balance = sale.total - sale.paid_total
  if (balance > 0.009) {
    totals.push(['Balance due', money(balance), true])
  }

  for (const [label, value, bold] of totals) {
    const f = bold ? fontBold : font
    page.drawText(label, { x: 340, y, size: 9, font: f, color: muted })
    page.drawText(value, {
      x: right - f.widthOfTextAtSize(value, 9),
      y,
      size: 9,
      font: f,
      color: ink,
    })
    y -= 14
  }

  if (sale.payments.length > 0) {
    y -= 4
    page.drawText('Payments', {
      x: 340,
      y,
      size: 9,
      font: fontBold,
      color: accent,
    })
    y -= 12
    for (const pay of sale.payments) {
      const label =
        `${TENDER_LABELS[pay.tender] ?? pay.tender}` +
        (pay.reference ? ` · ${pay.reference}` : '')
      page.drawText(truncate(label, 28), {
        x: 340,
        y,
        size: 8,
        font,
        color: muted,
      })
      const amt = money(pay.amount)
      page.drawText(amt, {
        x: right - font.widthOfTextAtSize(amt, 8),
        y,
        size: 8,
        font,
        color: ink,
      })
      y -= 11
    }
  }

  y = Math.min(y, 90)
  page.drawLine({
    start: { x: left, y: 78 },
    end: { x: right, y: 78 },
    thickness: 0.8,
    color: rgb(0.87, 0.91, 0.9),
  })
  page.drawText(
    `Payment accounts — Zaad: ${CLINIC_ZAAD} · eDahab: ${CLINIC_EDAHAB} · MyCash (Amal Bank): ${CLINIC_MYCASH}`,
    { x: left, y: 58, size: 8, font, color: muted },
  )
  page.drawText('Prices exclude VAT unless noted. Amounts in USD.', {
    x: left,
    y: 44,
    size: 8,
    font,
    color: muted,
  })

  return doc.save()
}

/** Load sale rows for PDF via dental-schema service client. */
export async function loadSalePdfInput(
  // deno-lint-ignore no-explicit-any
  dental: any,
  saleId: string,
): Promise<SalePdfInput | null> {
  const { data: sale, error } = await dental
    .from('sales')
    .select(
      'id, receipt_number, price_list, status, subtotal, discount_total, tax_total, total, paid_total, due_date, created_at, customer_id',
    )
    .eq('id', saleId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!sale) return null

  let customerName = 'Customer'
  if (sale.customer_id) {
    const { data: cust } = await dental
      .from('customers')
      .select('name')
      .eq('id', sale.customer_id)
      .maybeSingle()
    if (cust?.name) customerName = String(cust.name)
  }

  const { data: lines, error: lineErr } = await dental
    .from('sale_lines')
    .select('sku_or_code, name, qty, unit_price, tax_amount, line_gross, sort_order')
    .eq('sale_id', saleId)
    .order('sort_order', { ascending: true })
  if (lineErr) throw new Error(lineErr.message)

  const { data: payments, error: payErr } = await dental
    .from('payments')
    .select('tender, amount, reference')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })
  if (payErr) throw new Error(payErr.message)

  return {
    receipt_number: String(sale.receipt_number),
    price_list: String(sale.price_list),
    status: String(sale.status),
    subtotal: Number(sale.subtotal),
    discount_total: Number(sale.discount_total),
    tax_total: Number(sale.tax_total),
    total: Number(sale.total),
    paid_total: Number(sale.paid_total),
    due_date: sale.due_date ? String(sale.due_date) : null,
    created_at: String(sale.created_at),
    customer_name: customerName,
    lines: (lines ?? []).map(
      (l: {
        sku_or_code: string
        name: string
        qty: number
        unit_price: number
        tax_amount: number
        line_gross: number
      }) => ({
        sku_or_code: String(l.sku_or_code),
        name: String(l.name),
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        tax_amount: Number(l.tax_amount),
        line_gross: Number(l.line_gross),
      }),
    ),
    payments: (payments ?? []).map(
      (p: { tender: string; amount: number; reference: string | null }) => ({
        tender: String(p.tender),
        amount: Number(p.amount),
        reference: p.reference ? String(p.reference) : null,
      }),
    ),
  }
}

export function readClinicLogoBytes(): Uint8Array | null {
  try {
    const bin = atob(NISMILE_LOGO_JPEG_BASE64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}
