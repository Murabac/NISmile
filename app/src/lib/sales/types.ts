import type { PriceList } from '../database.types.ts'

export type PaymentTender = 'cash' | 'zaad' | 'edahab' | 'mycash'

export type SaleStatus = 'partial' | 'paid' | 'void'

export type SaleLineType = 'item' | 'service'

export type CheckoutLineInput = {
  line_type: SaleLineType
  item_id?: string | null
  service_id?: string | null
  qty: number
}

export type CheckoutPaymentInput = {
  tender: PaymentTender
  amount: number
  reference?: string | null
}

export type CheckoutInput = {
  branchId: string
  customerId: string | null
  lines: CheckoutLineInput[]
  payments: CheckoutPaymentInput[]
  notes?: string | null
  dueDate?: string | null
}

export type SalePayment = {
  id: string
  sale_id: string
  tender: PaymentTender
  amount: number
  reference: string | null
  created_at: string
}

export type SaleLine = {
  id: string
  sale_id: string
  line_type: SaleLineType
  item_id: string | null
  service_id: string | null
  sku_or_code: string
  name: string
  qty: number
  unit_price: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  line_net: number
  line_gross: number
  sort_order: number
}

export type Sale = {
  id: string
  branch_id: string
  customer_id: string | null
  status: SaleStatus
  price_list: PriceList
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_total: number
  receipt_number: string
  notes: string | null
  due_date: string | null
  created_at: string
  sale_lines: SaleLine[]
  payments: SalePayment[]
  customer_name?: string | null
  customer_type?: 'retail' | 'wholesale' | null
}

export type PosCustomer = {
  id: string
  name: string
  phone: string | null
  customer_type: 'retail' | 'wholesale'
  credit_limit: number | null
  subtype: string | null
}

export type StatementLine = {
  id: string
  kind: 'invoice' | 'payment'
  date: string
  label: string
  debit: number
  credit: number
  balance_after?: number
  sale_id: string
  receipt_number?: string
  due_date?: string | null
  status?: SaleStatus
}

export type ReturnLineInput = {
  sale_line_id: string
  qty: number
}

export type ProcessReturnInput = {
  branchId: string
  saleId: string
  lines: ReturnLineInput[]
  refunds: CheckoutPaymentInput[]
  restock: boolean
  reason?: string | null
  notes?: string | null
}

export type SaleReturn = {
  id: string
  sale_id: string
  return_number: string
  restock: boolean
  subtotal: number
  tax_total: number
  total: number
  refund_total: number
  reason: string | null
  notes: string | null
  created_at: string
}

export const TENDER_LABELS: Record<PaymentTender, string> = {
  cash: 'Cash',
  zaad: 'Zaad',
  edahab: 'eDahab',
  mycash: 'MyCash',
}
