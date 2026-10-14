import { supabase } from '../supabase.ts'

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled'

export type TransferLine = {
  id: string
  transfer_id: string
  item_id: string
  qty_requested: number
  qty_received: number | null
  items: { id: string; sku: string; name: string; unit: string } | null
}

export type StockTransfer = {
  id: string
  transfer_number: string
  from_branch_id: string
  to_branch_id: string
  status: TransferStatus
  notes: string | null
  created_at: string
  sent_at: string | null
  received_at: string | null
  from_branch: { id: string; name: string } | null
  to_branch: { id: string; name: string } | null
  stock_transfer_lines: TransferLine[]
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

const transferSelect = `
  id, transfer_number, from_branch_id, to_branch_id, status, notes, created_at, sent_at, received_at,
  from_branch:branches!from_branch_id ( id, name ),
  to_branch:branches!to_branch_id ( id, name ),
  stock_transfer_lines (
    id, transfer_id, item_id, qty_requested, qty_received,
    items ( id, sku, name, unit )
  )
`

function mapTransfer(row: Record<string, unknown>): StockTransfer {
  return {
    ...(row as Omit<StockTransfer, 'from_branch' | 'to_branch' | 'stock_transfer_lines'>),
    from_branch: asOne(row.from_branch as { id: string; name: string } | { id: string; name: string }[] | null),
    to_branch: asOne(row.to_branch as { id: string; name: string } | { id: string; name: string }[] | null),
    stock_transfer_lines: ((row.stock_transfer_lines as TransferLine[] | null) ?? []).map((line) => ({
      ...line,
      items: asOne(
        line.items as
          | { id: string; sku: string; name: string; unit: string }
          | { id: string; sku: string; name: string; unit: string }[]
          | null,
      ),
    })),
  }
}

/** Transfers involving the branch (as source or destination). */
export async function fetchTransfers(branchId: string | 'all') {
  let query = supabase
    .from('stock_transfers')
    .select(transferSelect)
    .order('created_at', { ascending: false })

  if (branchId !== 'all') {
    query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapTransfer(row as Record<string, unknown>))
}

export async function createTransfer(input: {
  fromBranchId: string
  toBranchId: string
  notes?: string | null
  lines: { itemId: string; qty: number }[]
}) {
  if (input.lines.length === 0) throw new Error('Add at least one line.')
  const { data, error } = await supabase.rpc('create_stock_transfer', {
    p_from_branch_id: input.fromBranchId,
    p_to_branch_id: input.toBranchId,
    p_notes: input.notes?.trim() || null,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      qty: line.qty,
    })),
  })
  if (error) throw error
  return data as string
}

export async function sendTransfer(transferId: string) {
  const { error } = await supabase.rpc('send_stock_transfer', {
    p_transfer_id: transferId,
  })
  if (error) throw error
}

export async function receiveTransfer(
  transferId: string,
  lines: { transferLineId: string; qtyReceived: number }[],
) {
  const { error } = await supabase.rpc('receive_stock_transfer', {
    p_transfer_id: transferId,
    p_lines: lines.map((line) => ({
      transfer_line_id: line.transferLineId,
      qty_received: line.qtyReceived,
    })),
  })
  if (error) throw error
}

export async function cancelTransfer(transferId: string) {
  const { error } = await supabase.rpc('cancel_stock_transfer', {
    p_transfer_id: transferId,
  })
  if (error) throw error
}

export function statusLabel(status: TransferStatus): string {
  if (status === 'in_transit') return 'In transit'
  if (status === 'received') return 'Received'
  if (status === 'cancelled') return 'Cancelled'
  return 'Draft'
}

export function statusClass(status: TransferStatus): string {
  if (status === 'in_transit') return 'bg-status-amber/15 text-status-amber'
  if (status === 'received') return 'bg-status-green/15 text-status-green'
  if (status === 'cancelled') return 'bg-subtle text-muted'
  return 'bg-flow-teal/15 text-flow-teal'
}
