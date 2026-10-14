import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { ReportPrintModal } from '../components/ReportPrintModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { formatMoney } from '../lib/money.ts'
import { runReport } from '../lib/reports/api.ts'
import { exportReportExcel } from '../lib/reports/exportExcel.ts'
import { formatReportCell, humanizeKey } from '../lib/reports/format.ts'
import {
  PERIOD_LABELS,
  REPORT_LABELS,
  type ReportPeriod,
  type ReportType,
} from '../lib/reports/types.ts'

const REPORT_TYPES = Object.keys(REPORT_LABELS) as ReportType[]
const PERIODS = Object.keys(PERIOD_LABELS) as ReportPeriod[]

export function ReportsPage() {
  const { branchId, branches, profile } = useAuth()
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [period, setPeriod] = useState<ReportPeriod>('mtd')
  const [printOpen, setPrintOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const canAll = profile?.role === 'owner'
  const effectiveBranch = branchId === 'all' && !canAll ? branches[0]?.id ?? 'all' : branchId

  const reportQuery = useQuery({
    queryKey: ['report', reportType, effectiveBranch, period],
    queryFn: () =>
      runReport({
        type: reportType,
        branchId: effectiveBranch,
        period,
      }),
  })

  const data = reportQuery.data
  const totals = data?.totals ?? {}
  const rows = data?.rows ?? []
  const byBranch = data?.by_branch ?? []

  const branchLabel =
    effectiveBranch === 'all'
      ? 'All branches'
      : (branches.find((b) => b.id === effectiveBranch)?.name ?? 'Branch')

  const highlight = useMemo(() => {
    if (reportType === 'sales') {
      return [
        { label: 'Sales total', value: formatMoney(Number(totals.total ?? 0)) },
        { label: 'Paid', value: formatMoney(Number(totals.paid_total ?? 0)) },
        { label: 'Sale count', value: String(totals.sale_count ?? 0) },
      ]
    }
    if (reportType === 'profit') {
      return [
        { label: 'Revenue ex-VAT', value: formatMoney(Number(totals.revenue_ex_vat ?? 0)) },
        { label: 'Est. COGS', value: formatMoney(Number(totals.estimated_cogs ?? 0)) },
        { label: 'Gross profit', value: formatMoney(Number(totals.gross_profit ?? 0)) },
      ]
    }
    if (reportType === 'valuation') {
      return [
        { label: 'Stock value', value: formatMoney(Number(totals.value_usd ?? 0)) },
        { label: 'Qty on hand', value: String(totals.qty_on_hand ?? 0) },
        { label: 'Batches', value: String(totals.batch_count ?? 0) },
      ]
    }
    if (reportType === 'expiry') {
      return [
        { label: '≤30 days', value: String(totals.within_30 ?? 0) },
        { label: '≤90 days', value: String(totals.within_90 ?? 0) },
        { label: 'Expired', value: String(totals.expired ?? 0) },
      ]
    }
    if (reportType === 'debts') {
      return [
        { label: 'AR balance', value: formatMoney(Number(totals.ar_balance ?? 0)) },
        { label: 'Overdue', value: formatMoney(Number(totals.overdue ?? 0)) },
        { label: 'Open invoices', value: String(totals.open_invoices ?? 0) },
      ]
    }
    if (reportType === 'vat') {
      return [
        { label: 'VAT collected', value: formatMoney(Number(totals.tax_total ?? 0)) },
        { label: 'Taxable net', value: formatMoney(Number(totals.taxable_net ?? 0)) },
        { label: 'Sales', value: String(totals.sale_count ?? 0) },
      ]
    }
    return [
      { label: 'Redemptions', value: String(totals.redemptions ?? 0) },
      { label: 'Discount given', value: formatMoney(Number(totals.discount_given ?? 0)) },
      { label: 'Promos with activity', value: String(rows.length) },
    ]
  }, [reportType, totals, rows.length])

  async function onExportExcel() {
    if (!data) return
    setExportError(null)
    setExporting(true)
    try {
      await exportReportExcel({
        type: reportType,
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-marine dark:text-[#E8F2F0]">
            Reports
          </h1>
          <p className="text-xs text-muted">
            Sales, profit, stock, expiry, debts, VAT, and promotions · {branchLabel} · USD
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
            Print
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
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {REPORT_TYPES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setReportType(id)}
              className={`whitespace-nowrap rounded-[8px] px-3 py-1.5 font-semibold ${
                reportType === id
                  ? 'bg-marine text-white dark:bg-[#2CC7BF] dark:text-[#08191F]'
                  : 'bg-canvas text-muted'
              }`}
            >
              {REPORT_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="font-semibold">Period:</span>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded px-2 py-1 font-mono text-[11px] font-bold uppercase ${
                  period === p
                    ? 'bg-flow-teal/15 text-marine dark:text-[#2CC7BF]'
                    : 'text-muted'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted">Currency: USD</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {highlight.map((card) => (
          <div key={card.label} className="rounded-dentaflow border border-line bg-surface p-4">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-2 font-mono text-xl font-extrabold">{card.value}</p>
          </div>
        ))}
      </div>

      {data?.note ? <p className="text-xs text-muted">{data.note}</p> : null}

      {reportQuery.isLoading ? (
        <p className="text-sm text-muted">Loading report…</p>
      ) : reportQuery.isError ? (
        <p className="text-sm text-status-red">{(reportQuery.error as Error).message}</p>
      ) : (
        <>
          {byBranch.length > 0 ? (
            <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
              <div className="border-b border-line px-4 py-2 text-xs font-bold">By branch</div>
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-[10px] uppercase text-muted">
                  <tr>
                    {Object.keys(byBranch[0] ?? {}).map((k) => (
                      <th key={k} className="px-3 py-2 font-semibold">
                        {humanizeKey(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byBranch.map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className="px-3 py-2 font-mono">
                          {formatReportCell(k, v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
            <div className="border-b border-line px-4 py-2 text-xs font-bold">
              Detail ({rows.length})
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No rows for this filter.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-canvas text-[10px] uppercase text-muted">
                    <tr>
                      {Object.keys(rows[0]).map((k) => (
                        <th key={k} className="px-3 py-2 font-semibold">
                          {humanizeKey(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-line">
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="px-3 py-2">
                            {formatReportCell(k, v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {printOpen && data ? (
        <ReportPrintModal
          type={reportType}
          period={period}
          branchLabel={branchLabel}
          data={data}
          highlights={highlight}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </div>
  )
}
