import type { PaymentTender } from '../database.types.ts'

export type ExpenseStatus = 'posted' | 'void'

export type ExpenseCategory = {
  id: string
  code: string
  name: string
  active: boolean
  sort_order: number
}

export type Expense = {
  id: string
  branch_id: string
  category_id: string
  expense_number: string
  expense_date: string
  amount: number
  tender: PaymentTender
  payee: string | null
  reference: string | null
  notes: string | null
  status: ExpenseStatus
  created_at: string
  category_name?: string
  category_code?: string
}

export type CreateExpenseInput = {
  category_id: string
  amount: number
  tender: PaymentTender
  expense_date: string
  payee?: string | null
  reference?: string | null
  notes?: string | null
}

export const TENDER_LABELS: Record<PaymentTender, string> = {
  cash: 'Cash',
  zaad: 'Zaad',
  edahab: 'eDahab',
  mycash: 'MyCash',
}
