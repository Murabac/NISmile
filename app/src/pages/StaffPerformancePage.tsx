import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { ReportPrintModal } from '../components/ReportPrintModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { formatMoney } from '../lib/money.ts'
import { fetchStaffPerformance } from '../lib/reports/api.ts'
import { exportReportExcel } from '../lib/reports/exportExcel.ts'
import { formatReportCell, humanizeKey } from '../lib/reports/format.ts'
import { PERIOD_LABELS, type ReportPeriod } from '../lib/reports/types.ts'

const PERIODS = Object.keys(PERIOD_LABELS) as ReportPeriod[]
const TITLE = 'Staff performance'

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function defaultFromDate() {
  const d = new Date()
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function StaffPerformancePage() {
  const { branchId, branches, profile } = useAuth()
  const [period, setPeriod] = useState<ReportPeriod>('mtd')
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(() => isoDate(new Date()))
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
  const rows = data?.rows ?? []

  const branchLabel =
    effectiveBranch === 'all'
      ? 'All branches'
      : (branches.find((b) => b.id === effectiveBranch)?.name ?? 'Branch')

  const highlights = useMemo(
    () => [
      { label: 'Revenue', value: formatMoney(Number(totals.revenue ?? 0)) },
      { label: 'Sales', value: String(totals.sale_count ?? 0) },
      { label: 'Staff with activity', value: String(totals.staff_count ?? 0) },
    ],
    [totals],
  )

  async function onExportExcel() {
    if (!data) return
    setExportError(null)
    setExporting(true)
    try {
      await exportReportExcel({
        title: TITLE,
        period,
        branchLabel,
        data,
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
            Checkout and booking activity by staff · {branchLabel} · USD
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-dentaflow border border-line bg-surface px-3.5 py-2 text-xs font-bold disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => void onExportExcel()}
            disabled={!data || exporting}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
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

          {Object.keys(totals).length > 0 ? (
            <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface shadow-xs">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Metric</th>
                    <th className="px-4 py-3 text-end font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals).map(([key, value]) => (
                    <tr key={key} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-semibold">{humanizeKey(key)}</td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums">
                        {formatReportCell(key, value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.note ? <p className="text-xs text-muted">{data.note}</p> : null}

          <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface shadow-xs">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
                <tr>
                  {(rows[0]
                    ? Object.keys(rows[0])
                    : [
                        'rank',
                        'staff_name',
                        'sale_count',
                        'revenue',
                        'avg_ticket',
                        'appointments_booked',
                      ]
                  ).map((key) => (
                    <th key={key} className="px-3 py-3 font-semibold whitespace-nowrap">
                      {humanizeKey(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted">
                      No staff activity in this period.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const keys = Object.keys(row)
                    return (
                      <tr key={index} className="border-b border-line last:border-0">
                        {keys.map((key) => (
                          <td key={key} className="px-3 py-2.5 font-mono text-xs tabular-nums">
                            {key === 'staff_name' || key === 'staff_role' ? (
                              <span className="font-sans font-semibold">
                                {formatReportCell(key, row[key])}
                              </span>
                            ) : (
                              formatReportCell(key, row[key])
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {printOpen && data ? (
        <ReportPrintModal
          title={TITLE}
          period={period}
          branchLabel={branchLabel}
          data={data}
          highlights={highlights}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </div>
  )
}
