import { supabase } from '../supabase.ts'

export type Supplier = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  active: boolean
}

export type PurchaseStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

export type PurchaseOrderLine = {
  id: string
  purchase_order_id: string
  item_id: string
  qty_ordered: number
  unit_cost: number
  qty_received: number
  items: { id: string; sku: string; name: string; unit: string } | null
}

export type PurchaseOrder = {
  id: string
  branch_id: string
  supplier_id: string
  po_number: string
  status: PurchaseStatus
  order_date: string
  expected_date: string | null
  notes: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
  purchase_order_lines: PurchaseOrderLine[]
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchSuppliers(includeInactive = false) {
  let query = supabase.from('suppliers').select('id, name, phone, email, notes, active').order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function createSupplier(input: {
  name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
}) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      active: true,
    })
    .select('id, name, phone, email, notes, active')
    .single()
  if (error) throw error
  return data as Supplier
}

export async function fetchPurchaseOrders(branchId: string) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(
      `
      id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes, created_at,
      suppliers ( id, name ),
      purchase_order_lines (
        id, purchase_order_id, item_id, qty_ordered, unit_cost, qty_received,
        items ( id, sku, name, unit )
      )
    `,
    )
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    suppliers: asOne(row.suppliers as { id: string; name: string } | { id: string; name: string }[] | null),
    purchase_order_lines: (row.purchase_order_lines ?? []).map((line) => ({
      ...line,
      items: asOne(
        line.items as
          | { id: string; sku: string; name: string; unit: string }
          | { id: string; sku: string; name: string; unit: string }[]
          | null,
      ),
    })),
  })) as PurchaseOrder[]
}

export async function createPurchaseOrder(input: {
  branchId: string
  supplierId: string
  expectedDate?: string | null
  notes?: string | null
  lines: { itemId: string; qtyOrdered: number; unitCost: number }[]
}) {
  if (input.lines.length === 0) throw new Error('Add at least one line.')

  const { data: poNumber, error: numberError } = await supabase.rpc('next_po_number')
  if (numberError) throw numberError

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({
      branch_id: input.branchId,
      supplier_id: input.supplierId,
      po_number: poNumber as string,
      status: 'ordered',
      expected_date: input.expectedDate || null,
      notes: input.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: linesError } = await supabase.from('purchase_order_lines').insert(
    input.lines.map((line) => ({
      purchase_order_id: po.id,
      item_id: line.itemId,
      qty_ordered: line.qtyOrdered,
      unit_cost: line.unitCost,
    })),
  )
  if (linesError) throw linesError
  return po.id as string
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string
  notes?: string | null
  lines: {
    purchaseOrderLineId: string
    qty: number
    batchNo: string
    expiryDate: string
    unitCost: number
  }[]
}) {
  const { data, error } = await supabase.rpc('receive_purchase_order', {
    p_purchase_order_id: input.purchaseOrderId,
    p_lines: input.lines.map((line) => ({
      purchase_order_line_id: line.purchaseOrderLineId,
      qty: line.qty,
      batch_no: line.batchNo,
      expiry_date: line.expiryDate,
      unit_cost: line.unitCost,
    })),
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export function poTotal(order: PurchaseOrder) {
  return order.purchase_order_lines.reduce(
    (sum, line) => sum + Number(line.qty_ordered) * Number(line.unit_cost),
    0,
  )
}

export function statusLabel(status: PurchaseStatus) {
  const labels: Record<PurchaseStatus, string> = {
    draft: 'Draft',
    ordered: 'Ordered',
    partial: 'Partial',
    received: 'Received',
    cancelled: 'Cancelled',
  }
  return labels[status]
}
