import { supabase } from '../supabase.ts'
import type {
  ClinicSettings,
  LoyaltyRedeemPreview,
  LoyaltyTransaction,
  UpdateClinicSettingsInput,
} from './types.ts'

export async function fetchClinicSettings(): Promise<ClinicSettings | null> {
  const { data, error } = await supabase.rpc('get_clinic_settings')
  if (error) throw error
  if (!data) return null
  const row = data as ClinicSettings
  return {
    ...row,
    vat_percent: row.vat_percent == null ? null : Number(row.vat_percent),
    loyalty_earn_per_usd: row.loyalty_earn_per_usd == null ? null : Number(row.loyalty_earn_per_usd),
    loyalty_usd_per_point:
      row.loyalty_usd_per_point == null ? null : Number(row.loyalty_usd_per_point),
    loyalty_min_redeem_points:
      row.loyalty_min_redeem_points == null ? null : Number(row.loyalty_min_redeem_points),
  }
}

export async function updateClinicSettings(
  input: UpdateClinicSettingsInput,
): Promise<ClinicSettings> {
  const { data, error } = await supabase.rpc('update_clinic_settings', {
    p_vat_percent: input.vat_percent ?? null,
    p_loyalty_earn_per_usd: input.loyalty_earn_per_usd ?? null,
    p_loyalty_usd_per_point: input.loyalty_usd_per_point ?? null,
    p_loyalty_min_redeem_points: input.loyalty_min_redeem_points ?? null,
    p_loyalty_expire_days: input.loyalty_expire_days ?? null,
    p_clear_vat: input.clear_vat ?? false,
    p_clear_loyalty_earn: input.clear_loyalty_earn ?? false,
    p_clear_loyalty_redeem: input.clear_loyalty_redeem ?? false,
    p_clear_loyalty_min: input.clear_loyalty_min ?? false,
    p_clear_loyalty_expire: input.clear_loyalty_expire ?? false,
  })
  if (error) throw error
  return data as ClinicSettings
}

export async function fetchLoyaltyTransactions(customerId: string): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select(
      'id, customer_id, tx_type, points, balance_after, sale_id, return_id, notes, expires_at, created_at',
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    points: Number(row.points),
    balance_after: Number(row.balance_after),
  })) as LoyaltyTransaction[]
}

export async function previewLoyaltyRedeem(input: {
  customerId: string
  redeemPoints: number
  remainingNet: number
}): Promise<LoyaltyRedeemPreview> {
  const { data, error } = await supabase.rpc('preview_loyalty_redeem', {
    p_customer_id: input.customerId,
    p_redeem_points: input.redeemPoints,
    p_remaining_net: input.remainingNet,
  })
  if (error) throw error
  const row = data as LoyaltyRedeemPreview
  return {
    points: Number(row.points ?? 0),
    discount: Number(row.discount ?? 0),
    ok: Boolean(row.ok),
    reason: row.reason,
    balance: row.balance == null ? undefined : Number(row.balance),
    usd_per_point: row.usd_per_point == null ? undefined : Number(row.usd_per_point),
    min_points: row.min_points == null ? undefined : Number(row.min_points),
  }
}

export async function adjustLoyaltyPoints(
  customerId: string,
  points: number,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc('adjust_loyalty_points', {
    p_customer_id: customerId,
    p_points: points,
    p_notes: notes ?? null,
  })
  if (error) throw error
}
