import { supabase } from '../supabase.ts'
import type {
  CreatePromotionInput,
  PromoPreview,
  Promotion,
  PromotionStatus,
  PromotionTarget,
} from './types.ts'

type PromoRow = Omit<Promotion, 'branch_ids' | 'targets' | 'redemptions' | 'revenue_generated' | 'estimated_recipients'> & {
  promotion_branches?: { branch_id: string }[] | null
  promotion_targets?: PromotionTarget[] | null
  promotion_redemptions?: { discount_amount: number }[] | null
}

const promoSelect = `
  id, code, name, description, promo_type, audience, wholesale_subtype, scope,
  percent_off, amount_off, buy_qty, get_qty, bundle_price, spend_min, min_qty,
  max_redemptions_total, max_redemptions_per_customer,
  starts_at, ends_at, status, notify_whatsapp,
  whatsapp_message_en, whatsapp_message_so, whatsapp_message_ar,
  published_at, created_at,
  promotion_branches ( branch_id ),
  promotion_targets (
    id, promotion_id, target_kind, item_id, service_id, category_id, customer_id
  ),
  promotion_redemptions ( discount_amount )
`

function mapPromo(row: PromoRow, recipients = 0): Promotion {
  const redemptions = row.promotion_redemptions ?? []
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    promo_type: row.promo_type,
    audience: row.audience,
    wholesale_subtype: row.wholesale_subtype,
    scope: row.scope,
    percent_off: row.percent_off == null ? null : Number(row.percent_off),
    amount_off: row.amount_off == null ? null : Number(row.amount_off),
    buy_qty: row.buy_qty == null ? null : Number(row.buy_qty),
    get_qty: row.get_qty == null ? null : Number(row.get_qty),
    bundle_price: row.bundle_price == null ? null : Number(row.bundle_price),
    spend_min: row.spend_min == null ? null : Number(row.spend_min),
    min_qty: row.min_qty == null ? null : Number(row.min_qty),
    max_redemptions_total: row.max_redemptions_total,
    max_redemptions_per_customer: row.max_redemptions_per_customer,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: displayStatus(row.status, row.starts_at, row.ends_at),
    notify_whatsapp: row.notify_whatsapp,
    whatsapp_message_en: row.whatsapp_message_en,
    whatsapp_message_so: row.whatsapp_message_so,
    whatsapp_message_ar: row.whatsapp_message_ar,
    published_at: row.published_at,
    created_at: row.created_at,
    branch_ids: (row.promotion_branches ?? []).map((b) => b.branch_id),
    targets: row.promotion_targets ?? [],
    redemptions: redemptions.length,
    revenue_generated: redemptions.reduce((sum, r) => sum + Number(r.discount_amount), 0),
    estimated_recipients: recipients,
  }
}

function displayStatus(
  status: PromotionStatus,
  startsAt: string,
  endsAt: string,
): PromotionStatus {
  const now = Date.now()
  if (status === 'ended' || status === 'paused' || status === 'draft') return status
  if (new Date(endsAt).getTime() < now) return 'ended'
  if (status === 'scheduled' || (status === 'active' && new Date(startsAt).getTime() > now)) {
    return 'scheduled'
  }
  return status
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select(promoSelect)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as PromoRow[]
  const withRecipients = await Promise.all(
    rows.map(async (row) => {
      let recipients = 0
      if (row.notify_whatsapp) {
        const { data: count } = await supabase.rpc('count_promotion_audience', {
          p_promotion_id: row.id,
        })
        recipients = Number(count ?? 0)
      }
      return mapPromo(row, recipients)
    }),
  )
  return withRecipients
}

export async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  const { data: code, error: codeErr } = await supabase.rpc('next_promotion_code')
  if (codeErr) throw codeErr

  const { data: promo, error } = await supabase
    .from('promotions')
    .insert({
      code: code as string,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      promo_type: input.promo_type,
      audience: input.audience,
      wholesale_subtype: input.audience === 'wholesale_subtype' ? input.wholesale_subtype : null,
      scope: input.scope,
      percent_off: input.percent_off ?? null,
      amount_off: input.amount_off ?? null,
      buy_qty: input.buy_qty ?? null,
      get_qty: input.get_qty ?? null,
      bundle_price: input.bundle_price ?? null,
      spend_min: input.spend_min ?? null,
      min_qty: input.min_qty ?? null,
      max_redemptions_total: input.max_redemptions_total ?? null,
      max_redemptions_per_customer: input.max_redemptions_per_customer ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: 'draft',
      notify_whatsapp: input.notify_whatsapp,
      whatsapp_message_en: input.whatsapp_message_en?.trim() || null,
      whatsapp_message_so: input.whatsapp_message_so?.trim() || null,
      whatsapp_message_ar: input.whatsapp_message_ar?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw error

  const promotionId = promo.id as string

  if (input.branch_ids.length > 0) {
    const { error: bErr } = await supabase.from('promotion_branches').insert(
      input.branch_ids.map((branch_id) => ({ promotion_id: promotionId, branch_id })),
    )
    if (bErr) throw bErr
  }

  const targets: {
    promotion_id: string
    target_kind: 'item' | 'service' | 'category' | 'customer'
    item_id?: string
    service_id?: string
    category_id?: string
    customer_id?: string
  }[] = []
  for (const item_id of input.item_ids ?? []) {
    targets.push({ promotion_id: promotionId, target_kind: 'item', item_id })
  }
  for (const service_id of input.service_ids ?? []) {
    targets.push({ promotion_id: promotionId, target_kind: 'service', service_id })
  }
  for (const category_id of input.category_ids ?? []) {
    targets.push({ promotion_id: promotionId, target_kind: 'category', category_id })
  }
  for (const customer_id of input.customer_ids ?? []) {
    targets.push({ promotion_id: promotionId, target_kind: 'customer', customer_id })
  }
  if (targets.length) {
    const { error: tErr } = await supabase.from('promotion_targets').insert(targets)
    if (tErr) throw tErr
  }

  if (input.publish) {
    const { error: pErr } = await supabase.rpc('publish_promotion', {
      p_promotion_id: promotionId,
    })
    if (pErr) throw pErr
  }

  const list = await fetchPromotions()
  const created = list.find((p) => p.id === promotionId)
  if (!created) throw new Error('Promotion created but could not be reloaded.')
  return created
}

export async function publishPromotion(id: string): Promise<void> {
  const { error } = await supabase.rpc('publish_promotion', { p_promotion_id: id })
  if (error) throw error
}

export async function setPromotionStatus(id: string, status: PromotionStatus): Promise<void> {
  const { error } = await supabase.rpc('set_promotion_status', {
    p_promotion_id: id,
    p_status: status,
  })
  if (error) throw error
}

export async function evaluateCartPromotion(input: {
  branchId: string
  customerId: string | null
  lines: { line_type: string; item_id?: string | null; service_id?: string | null; qty: number }[]
}): Promise<PromoPreview> {
  const { data, error } = await supabase.rpc('evaluate_best_promotion', {
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_lines: input.lines,
  })
  if (error) throw error
  const row = data as {
    promotion_id?: string | null
    code?: string | null
    name?: string | null
    discount_total?: number
    priced_lines?: {
      line_net?: number
      tax_rate?: number
      sort?: number
    }[]
    line_discounts?: { sort?: number; discount_amount?: number }[]
  } | null

  const discMap = new Map<number, number>()
  for (const entry of row?.line_discounts ?? []) {
    discMap.set(Number(entry.sort), Number(entry.discount_amount ?? 0))
  }

  let subtotal = 0
  let taxTotal = 0
  for (const line of row?.priced_lines ?? []) {
    const sort = Number(line.sort)
    const pre = Number(line.line_net ?? 0)
    const disc = discMap.get(sort) ?? 0
    const net = Math.max(0, round2(pre - disc))
    const rate = Number(line.tax_rate ?? 0)
    subtotal += pre
    taxTotal += round2(net * rate)
  }
  const discountTotal = Number(row?.discount_total ?? 0)

  return {
    promotion_id: row?.promotion_id ?? null,
    code: row?.code ?? null,
    name: row?.name ?? null,
    discount_total: discountTotal,
    subtotal: round2(subtotal),
    tax_total: round2(taxTotal),
    total: round2(subtotal - discountTotal + taxTotal),
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
