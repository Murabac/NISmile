import type { StockMovementType } from '../database.types.ts'

export type StockBatch = {
  id: string
  branch_id: string
  item_id: string
  batch_no: string
  expiry_date: string
  qty_remaining: number
  unit_cost: number
  created_at: string
}

export type StockMovement = {
  id: string
  branch_id: string
  item_id: string
  batch_id: string | null
  movement_type: StockMovementType
  qty: number
  ref_type: string | null
  ref_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type BranchStockSummary = {
  item_id: string
  qty_on_hand: number
  nearest_expiry: string | null
  batch_count: number
  /** True if any batch row exists for this item at the branch (including zero qty). */
  ever_stocked: boolean
}

export type AdjustReason =
  | 'Count reconciliation'
  | 'Damage'
  | 'Expired batch'
  | 'Returned to vendor'
