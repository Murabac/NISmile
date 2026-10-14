export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'buy_x_get_y'
  | 'bundle'
  | 'spend_threshold'

export type PromotionAudience =
  | 'all'
  | 'retail'
  | 'wholesale'
  | 'wholesale_subtype'
  | 'named_customers'

export type PromotionScope = 'invoice' | 'items' | 'services' | 'categories'

export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended'

export type PromotionTargetKind = 'item' | 'service' | 'category' | 'customer'

export type PromotionTarget = {
  id: string
  promotion_id: string
  target_kind: PromotionTargetKind
  item_id: string | null
  service_id: string | null
  category_id: string | null
  customer_id: string | null
}

export type Promotion = {
  id: string
  code: string
  name: string
  description: string | null
  promo_type: PromotionType
  audience: PromotionAudience
  wholesale_subtype: string | null
  scope: PromotionScope
  percent_off: number | null
  amount_off: number | null
  buy_qty: number | null
  get_qty: number | null
  bundle_price: number | null
  spend_min: number | null
  min_qty: number | null
  max_redemptions_total: number | null
  max_redemptions_per_customer: number | null
  starts_at: string
  ends_at: string
  status: PromotionStatus
  notify_whatsapp: boolean
  whatsapp_message_en: string | null
  whatsapp_message_so: string | null
  whatsapp_message_ar: string | null
  published_at: string | null
  created_at: string
  branch_ids: string[]
  targets: PromotionTarget[]
  redemptions: number
  revenue_generated: number
  estimated_recipients: number
}

export type CreatePromotionInput = {
  name: string
  description?: string | null
  promo_type: PromotionType
  audience: PromotionAudience
  wholesale_subtype?: string | null
  scope: PromotionScope
  percent_off?: number | null
  amount_off?: number | null
  buy_qty?: number | null
  get_qty?: number | null
  bundle_price?: number | null
  spend_min?: number | null
  min_qty?: number | null
  max_redemptions_total?: number | null
  max_redemptions_per_customer?: number | null
  starts_at: string
  ends_at: string
  notify_whatsapp: boolean
  whatsapp_message_en?: string | null
  whatsapp_message_so?: string | null
  whatsapp_message_ar?: string | null
  branch_ids: string[]
  item_ids?: string[]
  service_ids?: string[]
  category_ids?: string[]
  customer_ids?: string[]
  publish?: boolean
}

export type PromoPreview = {
  promotion_id: string | null
  code: string | null
  name: string | null
  discount_total: number
  subtotal: number
  tax_total: number
  total: number
}

export const PROMO_TYPE_LABELS: Record<PromotionType, string> = {
  percentage: 'Percentage discount',
  fixed_amount: 'Fixed amount ($)',
  buy_x_get_y: 'Buy X get Y free',
  bundle: 'Bundle price',
  spend_threshold: 'Spend threshold',
}

export const AUDIENCE_LABELS: Record<PromotionAudience, string> = {
  all: 'Everyone',
  retail: 'Retail patients',
  wholesale: 'Wholesale accounts',
  wholesale_subtype: 'Wholesale subtype',
  named_customers: 'Named customers',
}
