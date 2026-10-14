import { supabase } from '../supabase.ts'
import type { AdjustReason, BranchStockSummary, StockBatch, StockMovement } from './types.ts'

export async function fetchBranchStockSummaries(
  branchId: string | 'all',
): Promise<BranchStockSummary[]> {
  let query = supabase.from('stock_batches').select('item_id, qty_remaining, expiry_date')
  if (branchId !== 'all') query = query.eq('branch_id', branchId)

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, BranchStockSummary>()
  for (const row of data ?? []) {
    const qty = Number(row.qty_remaining)
    const existing = map.get(row.item_id)
    if (!existing) {
      map.set(row.item_id, {
        item_id: row.item_id,
        qty_on_hand: qty > 0 ? qty : 0,
        nearest_expiry: qty > 0 ? row.expiry_date : null,
        batch_count: qty > 0 ? 1 : 0,
        ever_stocked: true,
      })
      continue
    }
    existing.ever_stocked = true
    if (qty <= 0) continue
    existing.qty_on_hand += qty
    existing.batch_count += 1
    if (!existing.nearest_expiry || row.expiry_date < existing.nearest_expiry) {
      existing.nearest_expiry = row.expiry_date
    }
  }
  return [...map.values()]
}

export async function fetchOpenBatches(branchId: string | 'all'): Promise<StockBatch[]> {
  let query = supabase
    .from('stock_batches')
    .select('*')
    .gt('qty_remaining', 0)
    .order('expiry_date', { ascending: true })
  if (branchId !== 'all') query = query.eq('branch_id', branchId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StockBatch[]
}

export async function fetchItemBatches(branchId: string, itemId: string): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('branch_id', branchId)
    .eq('item_id', itemId)
    .order('expiry_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as StockBatch[]
}

export async function fetchItemMovements(
  branchId: string,
  itemId: string,
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('branch_id', branchId)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []) as StockMovement[]
}

export async function adjustStock(input: {
  branchId: string
  itemId: string
  qtyDelta: number
  reason: AdjustReason
  notes?: string
  batchId?: string | null
}) {
  const { error } = await supabase.rpc('adjust_stock', {
    p_branch_id: input.branchId,
    p_item_id: input.itemId,
    p_qty_delta: input.qtyDelta,
    p_reason: input.reason,
    p_notes: input.notes?.trim() || null,
    p_batch_id: input.batchId ?? null,
  })
  if (error) throw error
}

export function movementLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

export function stockStatus(
  qty: number,
  reorderLevel: number,
): 'out-of-stock' | 'low-stock' | 'in-stock' {
  if (qty <= 0) return 'out-of-stock'
  if (qty <= reorderLevel) return 'low-stock'
  return 'in-stock'
}

export function statusLabel(status: ReturnType<typeof stockStatus>): string {
  if (status === 'out-of-stock') return 'Out of stock'
  if (status === 'low-stock') return 'Low stock'
  return 'In stock'
}

export function statusClass(status: ReturnType<typeof stockStatus>): string {
  if (status === 'out-of-stock') return 'bg-status-red/15 text-status-red'
  if (status === 'low-stock') return 'bg-status-amber/15 text-status-amber'
  return 'bg-status-green/15 text-status-green'
}
