export type ReportType =
  | 'sales'
  | 'profit'
  | 'valuation'
  | 'expiry'
  | 'debts'
  | 'vat'
  | 'promos'
  | 'balance_sheet'
  | 'expenses'
  | 'pnl'

export type ReportPeriod = 'today' | '7d' | '30d' | 'mtd' | 'ytd' | 'custom'

export type ReportResult = {
  report: ReportType | string
  period?: string
  starts_at?: string
  ends_at?: string
  totals?: Record<string, number | string | null>
  by_branch?: Record<string, unknown>[]
  rows?: Record<string, unknown>[]
  note?: string
}

export type DashboardSummary = {
  sales_today: { count: number; total: number; paid: number }
  appointments_today: {
    count: number
    scheduled: number
    confirmed: number
    completed: number
    cancelled: number
  }
  appointments_list: Array<{
    id: string
    start_at: string
    status: string
    customer_name: string
    service_name: string | null
  }>
  debts: { open_invoices: number; ar_balance: number; overdue: number }
  debt_rows: Array<{
    receipt_number: string
    customer_name: string | null
    balance: number
    due_date: string | null
  }>
}

export type GoLiveStatus = {
  checklist: {
    backup_confirmed?: boolean
    roles_trained?: boolean
    templates_reviewed?: boolean
    quality_rating_watched?: boolean
    seed_marker?: string
    [key: string]: unknown
  }
  gaps: {
    vat_percent_blank: boolean
    loyalty_earn_blank: boolean
    loyalty_redeem_blank: boolean
    mycash_pending: boolean
  }
  templates: {
    utility_draft: number
    utility_approved: number
    marketing_draft: number
    marketing_approved: number
    by_language: { en: number }
  }
  updated_at: string
}

export const REPORT_LABELS: Record<ReportType, string> = {
  sales: 'Sales by branch',
  profit: 'Profit & margins',
  valuation: 'Stock valuation',
  expiry: 'Expiry risk',
  debts: 'Wholesale receivables',
  vat: 'VAT ledger',
  promos: 'Promotion results',
  balance_sheet: 'Balance Sheet',
  expenses: 'Expenses',
  pnl: 'Profit & loss',
}

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: 'Today',
  '7d': '7d',
  '30d': '30d',
  mtd: 'MTD',
  ytd: 'YTD',
  custom: 'Custom',
}
