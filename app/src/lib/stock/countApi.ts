import { supabase } from '../supabase.ts'

export type StockCountStatus = 'draft' | 'completed' | 'cancelled'

export type StockCountLine = {
  id: string
  stock_count_id: string
  item_id: string
  system_qty: number
  counted_qty: number | null
  items: { id: string; sku: string; name: string; unit: string } | null
}

export type StockCount = {
  id: string
  branch_id: string
  status: StockCountStatus
  notes: string | null
  created_at: string
  completed_at: string | null
  stock_count_lines: StockCountLine[]
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchStockCounts(branchId: string) {
  const { data, error } = await supabase
    .from('stock_counts')
    .select(
      `
      id, branch_id, status, notes, created_at, completed_at,
      stock_count_lines (
        id, stock_count_id, item_id, system_qty, counted_qty,
        items ( id, sku, name, unit )
      )
    `,
    )
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    stock_count_lines: (row.stock_count_lines ?? []).map((line) => ({
      ...line,
      items: asOne(
        line.items as
          | { id: string; sku: string; name: string; unit: string }
          | { id: string; sku: string; name: string; unit: string }[]
          | null,
      ),
    })),
  })) as StockCount[]
}

export async function createStockCount(branchId: string, notes?: string | null) {
  const { data, error } = await supabase.rpc('create_stock_count', {
    p_branch_id: branchId,
    p_notes: notes?.trim() || null,
  })
  if (error) throw error
  return data as string
}

export async function saveStockCountLines(
  countId: string,
  lines: { lineId: string; countedQty: number | null }[],
) {
  const { error } = await supabase.rpc('save_stock_count_lines', {
    p_stock_count_id: countId,
    p_lines: lines.map((line) => ({
      line_id: line.lineId,
      counted_qty: line.countedQty,
    })),
  })
  if (error) throw error
}

export async function completeStockCount(countId: string) {
  const { error } = await supabase.rpc('complete_stock_count', {
    p_stock_count_id: countId,
  })
  if (error) throw error
}

export async function cancelStockCount(countId: string) {
  const { error } = await supabase.rpc('cancel_stock_count', {
    p_stock_count_id: countId,
  })
  if (error) throw error
}

export function countStatusLabel(status: StockCountStatus): string {
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return 'In progress'
}
