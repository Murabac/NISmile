/** Near-expiry windows from the product plan (days). */
export const EXPIRY_WINDOWS = [30, 60, 90] as const
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number]

export type AlertStockStatus = 'out-of-stock' | 'low-stock' | 'near-expiry' | 'in-stock'

export type StockAlertCounts = {
  lowStock: number
  outOfStock: number
  nearExpiry30: number
  nearExpiry60: number
  nearExpiry90: number
  /** Distinct items with any batch expiring within 90 days. */
  nearExpiryItems: number
}

export type AlertLine = {
  id: string
  kind: 'low-stock' | 'out-of-stock' | 'near-expiry'
  itemId: string
  title: string
  detail: string
  daysLeft?: number
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days from today until expiry (negative if already expired). */
export function daysUntilExpiry(expiryDate: string, today = startOfToday()): number {
  const expiry = new Date(`${expiryDate}T00:00:00`)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
}

export function isWithinExpiryWindow(
  expiryDate: string | null | undefined,
  windowDays: ExpiryWindow,
  today = startOfToday(),
): boolean {
  if (!expiryDate) return false
  const days = daysUntilExpiry(expiryDate, today)
  return days <= windowDays
}

/** Tightest band that still contains this expiry: 30, 60, 90, or null if outside. */
export function expiryBand(
  expiryDate: string | null | undefined,
  today = startOfToday(),
): ExpiryWindow | null {
  if (!expiryDate) return null
  const days = daysUntilExpiry(expiryDate, today)
  if (days > 90) return null
  if (days <= 30) return 30
  if (days <= 60) return 60
  return 90
}

export function alertStockStatus(
  qty: number,
  reorderLevel: number,
  nearestExpiry: string | null | undefined,
  today = startOfToday(),
): AlertStockStatus {
  if (qty <= 0) return 'out-of-stock'
  if (nearestExpiry && daysUntilExpiry(nearestExpiry, today) <= 90) return 'near-expiry'
  if (qty <= reorderLevel) return 'low-stock'
  return 'in-stock'
}

export function alertStatusLabel(status: AlertStockStatus, daysLeft?: number): string {
  if (status === 'out-of-stock') return 'Out of stock'
  if (status === 'low-stock') return 'Low stock'
  if (status === 'near-expiry') {
    if (daysLeft == null) return 'Near expiry'
    if (daysLeft < 0) return 'Expired'
    return `Expires in ${daysLeft}d`
  }
  return 'In stock'
}

export function alertStatusClass(status: AlertStockStatus): string {
  if (status === 'out-of-stock') return 'bg-status-red/15 text-status-red'
  if (status === 'near-expiry') return 'bg-status-amber/15 text-status-amber'
  if (status === 'low-stock') return 'bg-status-amber/15 text-status-amber'
  return 'bg-status-green/15 text-status-green'
}

type ItemRef = {
  id: string
  name: string
  sku: string
  reorder_level: number
  active: boolean
}

type SummaryRef = {
  item_id: string
  qty_on_hand: number
  nearest_expiry: string | null
  batch_count: number
  /** True if this branch has ever held a batch for the item. */
  ever_stocked: boolean
}

type BatchRef = {
  id: string
  item_id: string
  batch_no: string
  expiry_date: string
  qty_remaining: number
}

export function buildAlertCounts(
  items: ItemRef[],
  summaries: SummaryRef[],
  today = startOfToday(),
): StockAlertCounts {
  const map = new Map(summaries.map((row) => [row.item_id, row]))
  let lowStock = 0
  let outOfStock = 0
  const near30 = new Set<string>()
  const near60 = new Set<string>()
  const near90 = new Set<string>()

  for (const item of items) {
    if (!item.active) continue
    const stock = map.get(item.id)
    const qty = stock?.qty_on_hand ?? 0
    const ever = stock?.ever_stocked ?? false

    if (qty <= 0) {
      if (ever) outOfStock += 1
      continue
    }
    if (qty <= Number(item.reorder_level)) lowStock += 1

    const expiry = stock?.nearest_expiry
    if (!expiry) continue
    const days = daysUntilExpiry(expiry, today)
    if (days <= 30) near30.add(item.id)
    if (days <= 60) near60.add(item.id)
    if (days <= 90) near90.add(item.id)
  }

  return {
    lowStock,
    outOfStock,
    nearExpiry30: near30.size,
    nearExpiry60: near60.size,
    nearExpiry90: near90.size,
    nearExpiryItems: near90.size,
  }
}

export function buildAttentionLines(
  items: ItemRef[],
  summaries: SummaryRef[],
  batches: BatchRef[],
  today = startOfToday(),
  limit = 8,
): AlertLine[] {
  const itemMap = new Map(items.map((item) => [item.id, item]))
  const summaryMap = new Map(summaries.map((row) => [row.item_id, row]))
  const lines: AlertLine[] = []

  for (const item of items) {
    if (!item.active) continue
    const stock = summaryMap.get(item.id)
    const qty = stock?.qty_on_hand ?? 0
    if (qty <= 0 && stock?.ever_stocked) {
      lines.push({
        id: `out-${item.id}`,
        kind: 'out-of-stock',
        itemId: item.id,
        title: item.name,
        detail: `${item.sku} · 0 on hand (was stocked at this branch)`,
      })
    } else if (qty > 0 && qty <= Number(item.reorder_level)) {
      lines.push({
        id: `low-${item.id}`,
        kind: 'low-stock',
        itemId: item.id,
        title: item.name,
        detail: `${item.sku} · ${qty} on hand (reorder ${item.reorder_level})`,
      })
    }
  }

  const expiring = [...batches]
    .filter((batch) => Number(batch.qty_remaining) > 0)
    .map((batch) => ({ batch, days: daysUntilExpiry(batch.expiry_date, today) }))
    .filter((row) => row.days <= 90)
    .sort((a, b) => a.days - b.days)

  for (const { batch, days } of expiring) {
    const item = itemMap.get(batch.item_id)
    if (!item?.active) continue
    lines.push({
      id: `exp-${batch.id}`,
      kind: 'near-expiry',
      itemId: batch.item_id,
      title: `${item.name} (${batch.batch_no})`,
      detail:
        days < 0
          ? `Expired ${batch.expiry_date} · ${batch.qty_remaining} left`
          : `Expires ${batch.expiry_date} · ${days}d left · ${batch.qty_remaining} on hand`,
      daysLeft: days,
    })
  }

  const rank = { 'out-of-stock': 0, 'near-expiry': 1, 'low-stock': 2 } as const
  lines.sort((a, b) => rank[a.kind] - rank[b.kind])
  return lines.slice(0, limit)
}
