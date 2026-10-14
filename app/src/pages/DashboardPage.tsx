import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  Package,
  Receipt,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems } from '../lib/catalog/api.ts'
import type { CatalogItem } from '../lib/catalog/types.ts'
import { formatMoney } from '../lib/money.ts'
import { fetchDashboardSummary } from '../lib/reports/api.ts'
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

  const summaryQuery = useQuery({
    queryKey: ['dashboard_summary', branchId],
    queryFn: () => fetchDashboardSummary(branchId),
  })

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
      buildAttentionLines(itemRefs, stockQuery.data ?? [], batchesQuery.data ?? [], undefined, 8),
    [itemRefs, stockQuery.data, batchesQuery.data],
  )

  const summary = summaryQuery.data
  const stockLoading = itemsQuery.isLoading || stockQuery.isLoading || batchesQuery.isLoading

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Today for {branchLabel}: sales, appointments, stock alerts, and open AR.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/reports"
            className="inline-flex h-10 items-center gap-2 rounded-dentaflow border border-line bg-surface px-4 text-sm font-bold"
          >
            Reports
          </Link>
          <Link
            to="/stock"
            className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
          >
            Open stock
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Sales today"
          value={summary ? formatMoney(summary.sales_today.total) : '—'}
          hint={
            summary
              ? `${summary.sales_today.count} sales · paid ${formatMoney(summary.sales_today.paid)}`
              : 'Loading…'
          }
          icon={<Receipt className="h-4 w-4 text-flow-teal" />}
          valueClass="text-main"
          to="/sales"
        />
        <MetricCard
          label="Appointments today"
          value={summary ? String(summary.appointments_today.count) : '—'}
          hint={
            summary
              ? `${summary.appointments_today.confirmed} confirmed · ${summary.appointments_today.scheduled} scheduled`
              : 'Loading…'
          }
          icon={<CalendarDays className="h-4 w-4 text-flow-teal" />}
          valueClass="text-main"
          to="/appointments"
        />
        <MetricCard
          label="Open AR"
          value={summary ? formatMoney(summary.debts.ar_balance) : '—'}
          hint={
            summary
              ? `${summary.debts.open_invoices} invoices · overdue ${formatMoney(summary.debts.overdue)}`
              : 'Loading…'
          }
          icon={<Wallet className="h-4 w-4 text-status-amber" />}
          valueClass="text-status-amber"
          to="/customers"
        />
        <MetricCard
          label="Out of stock"
          value={String(counts.outOfStock)}
          hint={`${counts.lowStock} low · ${counts.nearExpiry30} expiring ≤30d`}
          icon={<Package className="h-4 w-4 text-status-red" />}
          valueClass="text-status-red"
          to="/stock"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Today's appointments"
          subtitle="Next slots for this branch filter"
          linkTo="/appointments"
          linkLabel="Calendar"
        >
          {summaryQuery.isLoading ? (
            <p className="px-4 py-8 text-sm text-muted">Loading appointments…</p>
          ) : summaryQuery.isError ? (
            <p className="px-4 py-8 text-sm text-status-red">
              {(summaryQuery.error as Error).message}
            </p>
          ) : (summary?.appointments_list.length ?? 0) === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No appointments today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary!.appointments_list.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{row.customer_name}</p>
                    <p className="text-xs text-muted">
                      {row.service_name ?? 'No service'} ·{' '}
                      {new Date(row.start_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
                    {row.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Open receivables"
          subtitle="Partial wholesale invoices"
          linkTo="/customers"
          linkLabel="Customers"
        >
          {summaryQuery.isLoading ? (
            <p className="px-4 py-8 text-sm text-muted">Loading debts…</p>
          ) : (summary?.debt_rows.length ?? 0) === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No open AR for this filter.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary!.debt_rows.map((row) => (
                <li
                  key={row.receipt_number}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {row.customer_name ?? 'Walk-in'} · {row.receipt_number}
                    </p>
                    <p className="text-xs text-muted">
                      Due {row.due_date ?? '—'}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold">
                    {formatMoney(row.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          label="Low stock"
          value={String(counts.lowStock)}
          hint="At or below reorder level"
          icon={<AlertTriangle className="h-4 w-4 text-status-amber" />}
          valueClass="text-status-amber"
          to="/stock"
        />
        <MetricCard
          label="Expiring ≤30 days"
          value={String(counts.nearExpiry30)}
          hint={`${counts.nearExpiry60} within 60d · ${counts.nearExpiry90} within 90d`}
          icon={<Clock className="h-4 w-4 text-status-amber" />}
          valueClass="text-main"
          to="/stock"
        />
        <MetricCard
          label="Near expiry (90d)"
          value={String(counts.nearExpiryItems)}
          hint="Items with a batch due within 90 days"
          icon={<Clock className="h-4 w-4 text-flow-teal" />}
          valueClass="text-main"
          to="/stock"
        />
      </div>

      <Panel
        title="Needs attention"
        subtitle="Out of stock, near expiry, then low stock"
        linkTo="/stock"
        linkLabel="View all in Stock"
      >
        {stockLoading ? (
          <p className="px-4 py-8 text-sm text-muted">Loading alerts…</p>
        ) : attention.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No stock alerts for this branch filter.</p>
        ) : (
          <ul className="divide-y divide-line">
            {attention.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
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
      </Panel>
    </section>
  )
}

function Panel({
  title,
  subtitle,
  linkTo,
  linkLabel,
  children,
}: {
  title: string
  subtitle: string
  linkTo: string
  linkLabel: string
  children: ReactNode
}) {
  return (
    <div className="rounded-dentaflow border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <Link to={linkTo} className="text-xs font-semibold text-flow-teal">
          {linkLabel}
        </Link>
      </div>
      {children}
    </div>
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
  value: string
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
