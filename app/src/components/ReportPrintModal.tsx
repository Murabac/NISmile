import { Printer, X } from 'lucide-react'
import {
  CLINIC_ADDRESS,
  CLINIC_EDAHAB,
  CLINIC_LEGAL_NAME,
  CLINIC_LOGO_SRC,
  CLINIC_MARK_NAME,
  CLINIC_MYCASH,
  CLINIC_PHONE,
  CLINIC_TAX_ID,
  CLINIC_ZAAD,
} from '../lib/clinic.ts'
import {
  formatReportCell,
  generatedAtLabel,
  humanizeKey,
  reportSubtitle,
  reportTitle,
} from '../lib/reports/format.ts'
import type { ReportPeriod, ReportResult, ReportType } from '../lib/reports/types.ts'

export function ReportPrintModal({
  type,
  period,
  branchLabel,
  data,
  highlights,
  onClose,
}: {
  type: ReportType
  period: ReportPeriod
  branchLabel: string
  data: ReportResult
  highlights: Array<{ label: string; value: string }>
  onClose: () => void
}) {
  const title = reportTitle(type)
  const subtitle = reportSubtitle({
    type,
    period,
    branchLabel,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
  })
  const totals = data.totals ?? {}
  const byBranch = data.by_branch ?? []
  const rows = data.rows ?? []
  const generated = generatedAtLabel()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-4xl rounded-dentaflow border border-line bg-surface p-4 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h2 className="text-lg font-bold">Print report</h2>
            <p className="text-xs text-muted">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-dentaflow bg-marine px-3 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-dentaflow border border-line"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="print-document print-a4 mx-auto bg-white text-[#10262D]">
          <div className="mx-auto max-w-[190mm] space-y-5 border border-[#DDE7E5] bg-white p-7 text-sm shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
            <header className="flex items-start justify-between gap-6 border-b-2 border-[#0C3B4A] pb-5">
              <div className="flex items-start gap-4">
                <img
                  src={CLINIC_LOGO_SRC}
                  alt={CLINIC_MARK_NAME}
                  className="h-20 w-20 shrink-0 object-contain"
                />
                <div className="space-y-0.5 pt-1 text-xs text-[#536E75]">
                  <p className="text-sm font-bold tracking-tight text-[#0C3B4A]">
                    {CLINIC_LEGAL_NAME}
                  </p>
                  <p>{CLINIC_ADDRESS}</p>
                  <p>Tel: {CLINIC_PHONE}</p>
                  <p>
                    Tax ID: <span className="font-mono">{CLINIC_TAX_ID}</span>
                  </p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#12A6A0] uppercase">
                  DentaFlow report
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0C3B4A]">
                  {title}
                </h2>
                <div className="mt-3 space-y-0.5 text-xs text-[#536E75]">
                  <p>{subtitle}</p>
                  <p>Printed: {generated}</p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-3">
              {highlights.map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-[#DDE7E5] bg-[#F4FAF9] px-3 py-3"
                >
                  <p className="text-[10px] font-bold tracking-wide text-[#12A6A0] uppercase">
                    {card.label}
                  </p>
                  <p className="mt-1 font-mono text-lg font-black text-[#0C3B4A]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {Object.keys(totals).length > 0 ? (
              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-[#0C3B4A] uppercase">
                  Totals
                </h3>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#0C3B4A] text-[10px] tracking-wide text-white uppercase">
                      <th className="rounded-l-md px-3 py-2.5 font-semibold">Metric</th>
                      <th className="rounded-r-md px-3 py-2.5 text-end font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totals).map(([key, value], index) => (
                      <tr
                        key={key}
                        className={`border-b border-[#EEF4F3] ${
                          index % 2 === 1 ? 'bg-[#F8FCFB]' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold">{humanizeKey(key)}</td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums">
                          {formatReportCell(key, value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            {data.note ? (
              <p className="rounded-lg bg-[#F4FAF9] px-3 py-2 text-xs text-[#536E75]">
                {data.note}
              </p>
            ) : null}

            {byBranch.length > 0 ? (
              <ReportTable title="By branch" rows={byBranch} />
            ) : null}

            <ReportTable title={`Detail (${rows.length})`} rows={rows} />

            <footer className="space-y-3 border-t border-[#DDE7E5] pt-4 text-[11px] text-[#536E75]">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="font-bold text-[#0C3B4A]">Zaad</p>
                  <p className="font-mono">{CLINIC_ZAAD}</p>
                </div>
                <div>
                  <p className="font-bold text-[#0C3B4A]">eDahab</p>
                  <p className="font-mono">{CLINIC_EDAHAB}</p>
                </div>
                <div>
                  <p className="font-bold text-[#0C3B4A]">MyCash</p>
                  <p className="font-mono">{CLINIC_MYCASH}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[#EEF4F3] pt-3">
                <div>
                  <p className="font-semibold text-[#10262D]">{CLINIC_LEGAL_NAME}</p>
                  <p>
                    {CLINIC_ADDRESS} · {CLINIC_PHONE}
                  </p>
                </div>
                <div className="text-end">
                  <p>Prepared with DentaFlow</p>
                  <p className="font-mono text-[10px]">Confidential · USD</p>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-xs font-bold tracking-wide text-[#0C3B4A] uppercase">
          {title}
        </h3>
        <p className="rounded-lg bg-[#F4FAF9] px-4 py-6 text-center text-sm text-[#536E75]">
          No rows for this filter.
        </p>
      </section>
    )
  }

  const keys = Object.keys(rows[0]!)

  return (
    <section>
      <h3 className="mb-2 text-xs font-bold tracking-wide text-[#0C3B4A] uppercase">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#0C3B4A] text-[10px] tracking-wide text-white uppercase">
              {keys.map((key, i) => (
                <th
                  key={key}
                  className={`px-3 py-2.5 font-semibold ${
                    i === 0 ? 'rounded-l-md' : ''
                  } ${i === keys.length - 1 ? 'rounded-r-md' : ''}`}
                >
                  {humanizeKey(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className={`border-b border-[#EEF4F3] ${
                  index % 2 === 1 ? 'bg-[#F8FCFB]' : ''
                }`}
              >
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 font-mono tabular-nums">
                    {formatReportCell(key, row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
