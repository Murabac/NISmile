import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Download, Printer, User } from 'lucide-react'
import { ReportPrintModal } from '../components/ReportPrintModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { formatMoney } from '../lib/money.ts'
import { fetchStaffPerformance } from '../lib/reports/api.ts'
import { exportReportExcel } from '../lib/reports/exportExcel.ts'
import { formatReportCell } from '../lib/reports/format.ts'
import { PERIOD_LABELS, type ReportPeriod } from '../lib/reports/types.ts'

const PERIODS = Object.keys(PERIOD_LABELS) as ReportPeriod[]
const TITLE = 'Staff performance'

type StaffRow = Record<string, unknown> & {
  rank?: number
  staff_name?: string
  staff_role?: string | null
  sale_count?: number
  revenue?: number
  paid_total?: number
  unpaid_total?: number
  avg_ticket?: number
  items_net?: number
  services_net?: number
  appointments_booked?: number
  appointments_completed?: number
  appointments_no_show?: number
  appointments_cancelled?: number
  appointments_open?: number
}

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function defaultFromDate() {
  const d = new Date()
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

function staffKey(row: StaffRow, index: number) {
  return `${row.rank ?? index}-${row.staff_name ?? 'staff'}-${row.staff_role ?? ''}`
}

const DETAIL_METRICS: Array<{ key: keyof StaffRow; label: string }> = [
  { key: 'sale_count', label: 'Sales' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'paid_total', label: 'Paid' },
  { key: 'unpaid_total', label: 'Unpaid / AR' },
  { key: 'avg_ticket', label: 'Average ticket' },
  { key: 'items_net', label: 'Items (ex-VAT)' },
  { key: 'services_net', label: 'Services (ex-VAT)' },
  { key: 'appointments_booked', label: 'Appointments booked' },
  { key: 'appointments_completed', label: 'Completed' },
  { key: 'appointments_open', label: 'Open (scheduled / confirmed)' },
  { key: 'appointments_no_show', label: 'No-shows' },
  { key: 'appointments_cancelled', label: 'Cancelled' },
]

export function StaffPerformancePage() {
  const { branchId, branches, profile } = useAuth()
  const [period, setPeriod] = useState<ReportPeriod>('mtd')
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(() => isoDate(new Date()))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const isOwner = profile?.role === 'owner'
  const effectiveBranch = branchId

  const customRangeValid =
    period !== 'custom' || (Boolean(fromDate) && Boolean(toDate) && fromDate <= toDate)

  const reportQuery = useQuery({
    queryKey: ['staff_performance', effectiveBranch, period, fromDate, toDate],
    queryFn: () =>
      fetchStaffPerformance({
        branchId: effectiveBranch,
        period,
        fromDate: period === 'custom' ? fromDate : null,
        toDate: period === 'custom' ? toDate : null,
      }),
    enabled: isOwner && customRangeValid,
  })

  const data = reportQuery.data
  const totals = data?.totals ?? {}
  const rows = (data?.rows ?? []) as StaffRow[]

  useEffect(() => {
    setSelectedKey(null)
  }, [effectiveBranch, period, fromDate, toDate])

  const selected = useMemo(() => {
    if (!selectedKey) return null
    return rows.find((row, index) => staffKey(row, index) === selectedKey) ?? null
  }, [rows, selectedKey])

  const branchLabel =
    effectiveBranch === 'all'
      ? 'All branches'
      : (branches.find((b) => b.id === effectiveBranch)?.name ?? 'Branch')

  const highlights = useMemo(
    () => [
      { label: 'Team revenue', value: formatMoney(Number(totals.revenue ?? 0)) },
      { label: 'Team sales', value: String(totals.sale_count ?? 0) },
      { label: 'Staff listed', value: String(totals.staff_count ?? rows.length) },
    ],
    [totals, rows.length],
  )

  const printHighlights = useMemo(() => {
    if (selected) {
      return [
        { label: 'Revenue', value: formatMoney(Number(selected.revenue ?? 0)) },
        { label: 'Sales', value: String(selected.sale_count ?? 0) },
        {
          label: 'Appointments booked',
          value: String(selected.appointments_booked ?? 0),
        },
      ]
    }
    return highlights
  }, [selected, highlights])

  const printData = useMemo(() => {
    if (!data) return null
    if (!selected) return data
    return {
      ...data,
      totals: {
        sale_count: Number(selected.sale_count ?? 0),
        revenue: Number(selected.revenue ?? 0),
        paid_total: Number(selected.paid_total ?? 0),
        unpaid_total: Number(selected.unpaid_total ?? 0),
        avg_ticket: Number(selected.avg_ticket ?? 0),
        items_net: Number(selected.items_net ?? 0),
        services_net: Number(selected.services_net ?? 0),
        appointments_booked: Number(selected.appointments_booked ?? 0),
        appointments_completed: Number(selected.appointments_completed ?? 0),
        appointments_open: Number(selected.appointments_open ?? 0),
        appointments_no_show: Number(selected.appointments_no_show ?? 0),
        appointments_cancelled: Number(selected.appointments_cancelled ?? 0),
      },
      rows: [selected],
      note: `${selected.staff_name ?? 'Staff'} · ${selected.staff_role ?? 'role n/a'} · ${data.note ?? ''}`,
    }
  }, [data, selected])

  async function onExportExcel() {
    if (!printData) return
    setExportError(null)
    setExporting(true)
    try {
      await exportReportExcel({
        title: selected
          ? `${TITLE} — ${selected.staff_name ?? 'Staff'}`
          : TITLE,
        period,
        branchLabel,
        data: printData,
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Excel export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!isOwner) {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Staff performance</h1>
        <p className="mt-3 max-w-xl text-muted">Owner access only.</p>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-marine dark:text-[#E8F2F0]">
            Staff performance
          </h1>
          <p className="text-xs text-muted">
            Pick a staff member to see their checkout and booking stats · {branchLabel} · USD
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={!printData}
            className="inline-flex items-center gap-2 rounded-dentaflow border border-line bg-surface px-3.5 py-2 text-xs font-bold disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => void onExportExcel()}
            disabled={!printData || exporting}
            className="inline-flex items-center gap-2 rounded-dentaflow bg-marine px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {exportError ? <p className="text-sm text-status-red">{exportError}</p> : null}

      <div className="space-y-3 rounded-dentaflow border border-line bg-surface p-4 shadow-xs">
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold">Period:</span>
            {PERIODS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className={`rounded-[8px] px-2.5 py-1 font-semibold ${
                  period === id
                    ? 'bg-marine text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
                    : 'bg-canvas text-muted'
                }`}
              >
                {PERIOD_LABELS[id]}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="font-semibold">
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1 block h-9 rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                />
              </label>
              <label className="font-semibold">
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1 block h-9 rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                />
              </label>
              {!customRangeValid ? (
                <p className="text-status-red">Choose a valid from / to range.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {reportQuery.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reportQuery.isError ? (
        <p className="text-sm text-status-red">
          {(reportQuery.error as Error).message || 'Could not load staff performance.'}
        </p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {highlights.map((card) => (
              <div
                key={card.label}
                className="rounded-dentaflow border border-line bg-surface px-4 py-3 shadow-xs"
              >
                <p className="text-[10px] font-bold tracking-wide text-flow-teal uppercase">
                  {card.label}
                </p>
                <p className="mt-1 font-mono text-xl font-black text-marine dark:text-[#E8F2F0]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {data.note ? <p className="text-xs text-muted">{data.note}</p> : null}

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-5">
              <h2 className="text-sm font-bold">Staff</h2>
              {rows.length === 0 ? (
                <p className="rounded-dentaflow border border-line bg-surface p-6 text-sm text-muted">
                  No staff activity in this period.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-dentaflow border border-line bg-surface">
                  {rows.map((row, index) => {
                    const key = staffKey(row, index)
                    const active = selectedKey === key
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => setSelectedKey(key)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-start transition-colors ${
                            active ? 'bg-flow-teal/10' : 'hover:bg-canvas'
                          }`}
                        >
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-marine/10 font-mono text-xs font-bold text-marine">
                            #{row.rank ?? index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {row.staff_name ?? 'Staff'}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted capitalize">
                              {row.staff_role ?? 'No role'} · {row.sale_count ?? 0} sales ·{' '}
                              {row.appointments_booked ?? 0} bookings
                            </span>
                          </span>
                          <span className="shrink-0 text-end font-mono text-sm font-bold">
                            {formatMoney(Number(row.revenue ?? 0))}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="lg:col-span-7">
              {!selected ? (
                <div className="rounded-dentaflow border border-dashed border-line bg-surface px-6 py-16 text-center">
                  <User className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-3 text-sm font-semibold">Select a staff member</p>
                  <p className="mt-1 text-xs text-muted">
                    Their sales, payments, and appointment booking stats will show here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 rounded-dentaflow border border-line bg-surface p-4 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(null)}
                        className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-flow-teal lg:hidden"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back to list
                      </button>
                      <p className="text-[10px] font-bold tracking-wide text-flow-teal uppercase">
                        Rank #{selected.rank ?? '—'}
                      </p>
                      <h2 className="text-xl font-black tracking-tight">
                        {selected.staff_name ?? 'Staff'}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted capitalize">
                        {selected.staff_role ?? 'No role'} · {PERIOD_LABELS[period]} · {branchLabel}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-dentaflow bg-canvas px-3 py-3">
                      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                        Revenue
                      </p>
                      <p className="mt-1 font-mono text-lg font-black">
                        {formatMoney(Number(selected.revenue ?? 0))}
                      </p>
                    </div>
                    <div className="rounded-dentaflow bg-canvas px-3 py-3">
                      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                        Sales
                      </p>
                      <p className="mt-1 font-mono text-lg font-black">
                        {selected.sale_count ?? 0}
                      </p>
                    </div>
                    <div className="rounded-dentaflow bg-canvas px-3 py-3">
                      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                        Avg ticket
                      </p>
                      <p className="mt-1 font-mono text-lg font-black">
                        {formatMoney(Number(selected.avg_ticket ?? 0))}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Metric</th>
                          <th className="px-3 py-2.5 text-end font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DETAIL_METRICS.map((metric) => (
                          <tr key={metric.key} className="border-b border-line last:border-0">
                            <td className="px-3 py-2.5 font-semibold">{metric.label}</td>
                            <td className="px-3 py-2.5 text-end font-mono tabular-nums">
                              {formatReportCell(metric.key, selected[metric.key])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {printOpen && printData ? (
        <ReportPrintModal
          title={
            selected ? `${TITLE} — ${selected.staff_name ?? 'Staff'}` : TITLE
          }
          period={period}
          branchLabel={branchLabel}
          data={printData}
          highlights={printHighlights}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </div>
  )
}
