import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Clock, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems } from '../lib/catalog/api.ts'
import type { CatalogItem } from '../lib/catalog/types.ts'
import {
  alertStatusClass,
  alertStatusLabel,
  buildAlertCounts,
  buildAttentionLines,
} from '../lib/stock/alerts.ts'
import { fetchBranchStockSummaries, fetchOpenBatches } from '../lib/stock/api.ts'

export function DashboardPage() {
  const { branchId, branches } = useAuth()
  const branchLabel =
    branchId === 'all'
      ? 'All branches'
      : (branches.find((row) => row.id === branchId)?.name ?? 'Branch')

  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems })
  const stockQuery = useQuery({
    queryKey: ['stock_summaries', branchId],
    queryFn: () => fetchBranchStockSummaries(branchId),
  })
  const batchesQuery = useQuery({
    queryKey: ['open_batches', branchId],
    queryFn: () => fetchOpenBatches(branchId),
  })

  const items = (itemsQuery.data ?? []) as CatalogItem[]
  const itemRefs = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        reorder_level: Number(item.reorder_level),
        active: item.active,
      })),
    [items],
  )

  const counts = useMemo(
    () => buildAlertCounts(itemRefs, stockQuery.data ?? []),
    [itemRefs, stockQuery.data],
  )

  const attention = useMemo(
    () =>
      buildAttentionLines(itemRefs, stockQuery.data ?? [], batchesQuery.data ?? [], undefined, 10),
    [itemRefs, stockQuery.data, batchesQuery.data],
  )

  const loading = itemsQuery.isLoading || stockQuery.isLoading || batchesQuery.isLoading

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Stock alerts for {branchLabel}. Sales and appointments arrive in later steps.
          </p>
        </div>
        <Link
          to="/stock"
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          Open stock
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Out of stock"
          value={counts.outOfStock}
          hint="Previously stocked, now zero"
          icon={<Package className="h-4 w-4 text-status-red" />}
          valueClass="text-status-red"
          to="/stock"
        />
        <MetricCard
          label="Low stock"
          value={counts.lowStock}
          hint="At or below reorder level"
          icon={<AlertTriangle className="h-4 w-4 text-status-amber" />}
          valueClass="text-status-amber"
          to="/stock"
        />
        <MetricCard
          label="Expiring ≤30 days"
          value={counts.nearExpiry30}
          hint={`${counts.nearExpiry60} within 60d · ${counts.nearExpiry90} within 90d`}
          icon={<Clock className="h-4 w-4 text-status-amber" />}
          valueClass="text-main"
          to="/stock"
        />
        <MetricCard
          label="Near expiry (90d)"
          value={counts.nearExpiryItems}
          hint="Items with a batch due within 90 days"
          icon={<Clock className="h-4 w-4 text-flow-teal" />}
          valueClass="text-main"
          to="/stock"
        />
      </div>

      <div className="rounded-dentaflow border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Needs attention</h2>
            <p className="text-xs text-muted">Out of stock, near expiry, then low stock</p>
          </div>
          <Link to="/stock" className="text-xs font-semibold text-flow-teal">
            View all in Stock
          </Link>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-sm text-muted">Loading alerts…</p>
        ) : attention.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No stock alerts for this branch filter.</p>
        ) : (
          <ul className="divide-y divide-line">
            {attention.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{line.title}</p>
                  <p className="text-xs text-muted">{line.detail}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${alertStatusClass(
                    line.kind === 'near-expiry' ? 'near-expiry' : line.kind,
                  )}`}
                >
                  {alertStatusLabel(
                    line.kind === 'near-expiry' ? 'near-expiry' : line.kind,
                    line.daysLeft,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  valueClass,
  to,
}: {
  label: string
  value: number
  hint: string
  icon: ReactNode
  valueClass: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="rounded-dentaflow border border-line bg-surface p-4 transition-colors hover:border-flow-teal/50"
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <p className={`mt-2 font-mono text-2xl font-extrabold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </Link>
  )
}
