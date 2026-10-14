export type ClinicSettings = {
  id: string
  vat_percent: number | null
  loyalty_earn_per_usd: number | null
  loyalty_usd_per_point: number | null
  loyalty_min_redeem_points: number | null
  loyalty_expire_days: number | null
  updated_at: string
}

export type LoyaltyTxType = 'earn' | 'redeem' | 'reverse' | 'adjust'

export type LoyaltyTransaction = {
  id: string
  customer_id: string
  tx_type: LoyaltyTxType
  points: number
  balance_after: number
  sale_id: string | null
  return_id: string | null
  notes: string | null
  expires_at: string | null
  created_at: string
}

export type LoyaltyRedeemPreview = {
  points: number
  discount: number
  ok: boolean
  reason?: string
  balance?: number
  usd_per_point?: number
  min_points?: number
}

export type UpdateClinicSettingsInput = {
  vat_percent?: number | null
  loyalty_earn_per_usd?: number | null
  loyalty_usd_per_point?: number | null
  loyalty_min_redeem_points?: number | null
  loyalty_expire_days?: number | null
  clear_vat?: boolean
  clear_loyalty_earn?: boolean
  clear_loyalty_redeem?: boolean
  clear_loyalty_min?: boolean
  clear_loyalty_expire?: boolean
}
