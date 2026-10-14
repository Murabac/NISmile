import { formatMoney } from '../money.ts'
import { PERIOD_LABELS, REPORT_LABELS, type ReportPeriod, type ReportType } from './types.ts'

const MONEY_KEYS = new Set([
  'total',
  'paid_total',
  'paid',
  'revenue_ex_vat',
  'estimated_cogs',
  'gross_profit',
  'value_usd',
  'ar_balance',
  'overdue',
  'tax_total',
  'taxable_net',
  'discount_given',
  'balance',
  'amount',
  'subtotal',
  'unit_cost',
  'line_total',
  'discount',
  'net',
  'gross',
])

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isMoneyKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (MONEY_KEYS.has(lower)) return true
  return /(?:amount|total|balance|price|cost|value|discount|revenue|cogs|profit|paid|tax|vat|usd)$/i.test(
    lower,
  )
}

export function formatReportCell(key: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (isMoneyKey(key) || (!Number.isInteger(value) && Math.abs(value) >= 0.01)) {
      return formatMoney(value)
    }
    return String(value)
  }
  return String(value)
}

export function reportTitle(type: ReportType): string {
  return REPORT_LABELS[type]
}

export function reportSubtitle(input: {
  type: ReportType
  period: ReportPeriod
  branchLabel: string
  startsAt?: string
  endsAt?: string
}): string {
  const period = PERIOD_LABELS[input.period]
  const range =
    input.startsAt && input.endsAt
      ? `${new Date(input.startsAt).toLocaleDateString('en-US')} – ${new Date(input.endsAt).toLocaleDateString('en-US')}`
      : period
  return `${input.branchLabel} · ${period} · ${range} · USD`
}

export function generatedAtLabel(): string {
  return new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
