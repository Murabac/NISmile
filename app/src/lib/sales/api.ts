import { supabase } from '../supabase.ts'
import type { PriceList } from '../database.types.ts'
import type {
  CheckoutInput,
  CheckoutPaymentInput,
  PosCustomer,
  ProcessReturnInput,
  Sale,
  SaleLine,
  SalePayment,
  SaleReturn,
  StatementLine,
} from './types.ts'

const saleSelect = `
  id, branch_id, customer_id, status, price_list, subtotal, discount_total,
  tax_total, total, paid_total, receipt_number, notes, due_date, created_at,
  customers ( name, customer_type ),
  sale_lines (
    id, sale_id, line_type, item_id, service_id, sku_or_code, name,
    qty, unit_price, discount_amount, tax_rate, tax_amount, line_net, line_gross, sort_order
  ),
  payments ( id, sale_id, tender, amount, reference, created_at )
`

export async function fetchBranchCustomers(branchId: string): Promise<PosCustomer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, customer_type, credit_limit, subtype')
    .eq('branch_id', branchId)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    credit_limit: row.credit_limit == null ? null : Number(row.credit_limit),
  })) as PosCustomer[]
}

export async function checkoutSale(input: CheckoutInput): Promise<string> {
  const { data, error } = await supabase.rpc('checkout_sale', {
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_lines: input.lines,
    p_payments: input.payments,
    p_notes: input.notes ?? null,
    p_due_date: input.dueDate ?? null,
  })
  if (error) throw error
  return data as string
}

export async function applyCustomerPayment(input: {
  branchId: string
  customerId: string
  payments: CheckoutPaymentInput[]
  saleId?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('apply_customer_payment', {
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_payments: input.payments,
    p_sale_id: input.saleId ?? null,
  })
  if (error) throw error
  return data as string
}

export async function processReturn(input: ProcessReturnInput): Promise<string> {
  const { data, error } = await supabase.rpc('process_return', {
    p_branch_id: input.branchId,
    p_sale_id: input.saleId,
    p_lines: input.lines,
    p_refunds: input.refunds,
    p_restock: input.restock,
    p_reason: input.reason ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as string
}

/** Qty already returned per sale_line_id. */
export async function fetchReturnedQtyByLine(
  saleId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('returns')
    .select('id, return_lines ( sale_line_id, qty )')
    .eq('sale_id', saleId)
  if (error) throw error

  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const lines = (row.return_lines as { sale_line_id: string; qty: number }[] | null) ?? []
    for (const line of lines) {
      map[line.sale_line_id] = round2((map[line.sale_line_id] ?? 0) + Number(line.qty))
    }
  }
  return map
}

export async function fetchSaleReturns(saleId: string): Promise<SaleReturn[]> {
  const { data, error } = await supabase
    .from('returns')
    .select(
      'id, sale_id, return_number, restock, subtotal, tax_total, total, refund_total, reason, notes, created_at',
    )
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    subtotal: Number(row.subtotal),
    tax_total: Number(row.tax_total),
    total: Number(row.total),
    refund_total: Number(row.refund_total),
  })) as SaleReturn[]
}

export function previewReturnAmounts(
  sale: Sale,
  lines: { sale_line_id: string; qty: number }[],
): { subtotal: number; taxTotal: number; total: number; unpaid: number; refundDue: number } {
  let subtotal = 0
  let taxTotal = 0
  for (const input of lines) {
    if (input.qty <= 0) continue
    const saleLine = sale.sale_lines.find((l) => l.id === input.sale_line_id)
    if (!saleLine) continue
    const ratio = input.qty / saleLine.qty
    subtotal = round2(subtotal + saleLine.line_net * ratio)
    taxTotal = round2(taxTotal + saleLine.tax_amount * ratio)
  }
  const total = round2(subtotal + taxTotal)
  const unpaid = round2(Math.max(sale.total - sale.paid_total, 0))
  const refundDue = round2(Math.max(total - unpaid, 0))
  return { subtotal, taxTotal, total, unpaid, refundDue }
}

export async function fetchSale(saleId: string): Promise<Sale | null> {
  const { data, error } = await supabase
    .from('sales')
    .select(saleSelect)
    .eq('id', saleId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return normalizeSale(data as Record<string, unknown>)
}

export async function fetchCustomerSales(customerId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(saleSelect)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => normalizeSale(row as Record<string, unknown>))
}

export async function fetchCustomerStatement(customerId: string): Promise<{
  lines: StatementLine[]
  outstanding: number
}> {
  const sales = await fetchCustomerSales(customerId)
  const lines: StatementLine[] = []

  for (const sale of sales) {
    lines.push({
      id: `inv-${sale.id}`,
      kind: 'invoice',
      date: sale.created_at,
      label: `Invoice ${sale.receipt_number}`,
      debit: sale.total,
      credit: 0,
      sale_id: sale.id,
      receipt_number: sale.receipt_number,
      due_date: sale.due_date,
      status: sale.status,
    })
    for (const pay of sale.payments) {
      lines.push({
        id: pay.id,
        kind: 'payment',
        date: pay.created_at,
        label: `Payment · ${pay.tender}${pay.reference ? ` · ${pay.reference}` : ''}`,
        debit: 0,
        credit: pay.amount,
        sale_id: sale.id,
        receipt_number: sale.receipt_number,
      })
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date))
  let running = 0
  for (const line of lines) {
    running = round2(running + line.debit - line.credit)
    line.balance_after = running
  }

  const outstanding = round2(
    sales
      .filter((sale) => sale.status === 'partial')
      .reduce((sum, sale) => sum + (sale.total - sale.paid_total), 0),
  )

  return { lines, outstanding }
}

export async function fetchRecentSales(branchId: string, limit = 10): Promise<Sale[]> {
  return fetchBranchSales(branchId, { limit })
}

export async function fetchBranchSales(
  branchId: string,
  options?: { limit?: number; status?: Sale['status'] | 'all' },
): Promise<Sale[]> {
  let query = supabase
    .from('sales')
    .select(saleSelect)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100)

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => normalizeSale(row as Record<string, unknown>))
}

function normalizeSale(row: Record<string, unknown>): Sale {
  const lines = ((row.sale_lines as SaleLine[] | null) ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
  const payments = (row.payments as SalePayment[] | null) ?? []
  const customer = row.customers as
    | { name: string; customer_type: 'retail' | 'wholesale' }
    | null
    | undefined
  return {
    id: row.id as string,
    branch_id: row.branch_id as string,
    customer_id: (row.customer_id as string | null) ?? null,
    status: row.status as Sale['status'],
    price_list: row.price_list as PriceList,
    subtotal: Number(row.subtotal),
    discount_total: Number(row.discount_total),
    tax_total: Number(row.tax_total),
    total: Number(row.total),
    paid_total: Number(row.paid_total),
    receipt_number: row.receipt_number as string,
    notes: (row.notes as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    created_at: row.created_at as string,
    customer_name: customer?.name ?? null,
    customer_type: customer?.customer_type ?? null,
    sale_lines: lines.map((line) => ({
      ...line,
      qty: Number(line.qty),
      unit_price: Number(line.unit_price),
      discount_amount: Number(line.discount_amount),
      tax_rate: Number(line.tax_rate),
      tax_amount: Number(line.tax_amount),
      line_net: Number(line.line_net),
      line_gross: Number(line.line_gross),
    })),
    payments: payments.map((pay) => ({
      ...pay,
      amount: Number(pay.amount),
    })),
  }
}

/** Client-side preview of unit price (mirrors resolve_unit_price). */
export function resolveDisplayPrice(
  prices: { price_list: string; min_qty: number; price: number }[],
  priceList: PriceList,
  qty: number,
  options?: { retailOnly?: boolean },
): number | null {
  const list = options?.retailOnly ? 'retail' : priceList
  const match = prices
    .filter((row) => row.price_list === list && Number(row.min_qty) <= qty)
    .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0]
  if (match) return Number(match.price)
  if (list === 'wholesale') {
    const retail = prices
      .filter((row) => row.price_list === 'retail' && Number(row.min_qty) <= qty)
      .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0]
    return retail ? Number(retail.price) : null
  }
  return null
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
