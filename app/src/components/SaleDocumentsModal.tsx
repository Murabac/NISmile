import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageSquare, Printer, X } from 'lucide-react'
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
  invoiceNumberFromReceipt,
  type ThermalWidth,
} from '../lib/clinic.ts'
import { formatMoney } from '../lib/money.ts'
import { notifySaleDocument } from '../lib/sales/api.ts'
import type { Sale } from '../lib/sales/types.ts'
import { TENDER_LABELS } from '../lib/sales/types.ts'

type DocMode = 'receipt' | 'invoice'

export function SaleDocumentsModal({
  sale,
  customerName,
  defaultMode = 'receipt',
  onClose,
}: {
  sale: Sale
  customerName: string
  defaultMode?: DocMode
  onClose: () => void
}) {
  const [mode, setMode] = useState<DocMode>(defaultMode)
  const [width, setWidth] = useState<ThermalWidth>(80)
  const [notice, setNotice] = useState<string | null>(null)

  const notifyMutation = useMutation({
    mutationFn: () => notifySaleDocument(sale.id),
    onSuccess: (id) => {
      setNotice(
        id
          ? 'WhatsApp notice queued (English). PDF stays English when attached later.'
          : 'No notice queued — customer may be walk-in, opted out, or already notified.',
      )
    },
    onError: (err: Error) => setNotice(err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-3xl rounded-dentaflow border border-line bg-surface p-4 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h2 className="text-lg font-bold">
              {mode === 'receipt' ? 'Thermal receipt' : 'A4 tax invoice'}
            </h2>
            <p className="text-xs text-muted">{sale.receipt_number}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-canvas p-1">
              <button
                type="button"
                onClick={() => setMode('receipt')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  mode === 'receipt' ? 'bg-surface shadow-sm' : 'text-muted'
                }`}
              >
                Receipt
              </button>
              <button
                type="button"
                onClick={() => setMode('invoice')}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  mode === 'invoice' ? 'bg-surface shadow-sm' : 'text-muted'
                }`}
              >
                A4 invoice
              </button>
            </div>
            {mode === 'receipt' ? (
              <div className="inline-flex rounded-lg bg-canvas p-1">
                <button
                  type="button"
                  onClick={() => setWidth(80)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                    width === 80 ? 'bg-surface shadow-sm' : 'text-muted'
                  }`}
                >
                  80 mm
                </button>
                <button
                  type="button"
                  onClick={() => setWidth(58)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                    width === 58 ? 'bg-surface shadow-sm' : 'text-muted'
                  }`}
                >
                  58 mm
                </button>
              </div>
            ) : null}
            {sale.customer_id ? (
              <button
                type="button"
                disabled={notifyMutation.isPending}
                onClick={() => {
                  setNotice(null)
                  notifyMutation.mutate()
                }}
                className="inline-flex h-9 items-center gap-2 rounded-dentaflow border border-line px-3 text-xs font-semibold disabled:opacity-60"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Queue WhatsApp notice
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-dentaflow bg-marine px-3 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              {mode === 'invoice' ? 'Print / Save PDF' : 'Print receipt'}
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
        {notice ? (
          <p className="mb-3 text-xs text-flow-teal no-print">{notice}</p>
        ) : null}

        <div
          className={
            mode === 'receipt'
              ? `mx-auto bg-white text-[#10262D] print-document print-thermal-${width}`
              : 'mx-auto bg-white text-[#10262D] print-document print-a4'
          }
        >
          {mode === 'receipt' ? (
            <ThermalReceipt sale={sale} customerName={customerName} width={width} />
          ) : (
            <A4Invoice sale={sale} customerName={customerName} />
          )}
        </div>
      </div>
    </div>
  )
}

function ThermalReceipt({
  sale,
  customerName,
  width,
}: {
  sale: Sale
  customerName: string
  width: ThermalWidth
}) {
  const paymentSummary =
    sale.payments.length === 0
      ? 'On account'
      : sale.payments.map((p) => TENDER_LABELS[p.tender]).join(', ')

  return (
    <div
      className={`border border-[#DDE7E5] p-4 font-mono text-xs shadow-sm ${
        width === 58 ? 'max-w-[220px]' : 'max-w-[300px]'
      } mx-auto`}
    >
      <div className="space-y-1 border-b border-dashed border-[#B0C6C2] pb-3 text-center">
        <img
          src={CLINIC_LOGO_SRC}
          alt={CLINIC_MARK_NAME}
          className={`mx-auto object-contain ${width === 58 ? 'h-12 w-12' : 'h-16 w-16'}`}
        />
        <p className={`font-bold tracking-wide text-[#0C3B4A] ${width === 58 ? 'text-[11px]' : 'text-sm'}`}>
          {CLINIC_LEGAL_NAME}
        </p>
        <p className="text-[10px] text-neutral-600">{CLINIC_ADDRESS}</p>
        <p className="text-[10px] text-neutral-600">Tel: {CLINIC_PHONE}</p>
        <p className="pt-1 text-[10px] text-neutral-500">Tax ID: {CLINIC_TAX_ID}</p>
      </div>

      <div className="space-y-1 border-b border-dashed border-[#B0C6C2] py-3 text-[11px]">
        <Row label="Receipt No" value={sale.receipt_number} />
        <Row label="Date" value={new Date(sale.created_at).toLocaleString()} />
        <Row label="Customer" value={customerName} />
        <Row label="Payment" value={paymentSummary} />
        {sale.due_date ? <Row label="Due date" value={sale.due_date} /> : null}
        <Row label="Status" value={sale.status === 'partial' ? 'Partial' : 'Paid'} />
      </div>

      <div className="space-y-2 border-b border-dashed border-[#B0C6C2] py-3">
        <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase">
          <span>Item / Qty</span>
          <span>Total</span>
        </div>
        {sale.sale_lines.map((line) => (
          <div key={line.id} className="space-y-0.5">
            <div className="flex justify-between gap-2 font-medium">
              <span className="truncate">{line.name}</span>
              <span className="shrink-0 tabular-nums font-bold">
                {formatMoney(line.line_gross)}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>
                {line.qty} × {formatMoney(line.unit_price)}
              </span>
              <span className="uppercase">{line.sku_or_code}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-b border-dashed border-[#B0C6C2] py-3">
        <Row label="Subtotal (ex-VAT)" value={formatMoney(sale.subtotal)} />
        {sale.discount_total > 0 ? (
          <Row label="Discount" value={`-${formatMoney(sale.discount_total)}`} />
        ) : null}
        <Row label="VAT" value={formatMoney(sale.tax_total)} />
        <div className="flex justify-between border-t border-neutral-300 pt-2 text-sm font-bold text-[#0C3B4A]">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatMoney(sale.total)}</span>
        </div>
        <Row label="Paid" value={formatMoney(sale.paid_total)} />
        {sale.total - sale.paid_total > 0.009 ? (
          <Row label="Balance due" value={formatMoney(sale.total - sale.paid_total)} />
        ) : null}
      </div>

      <div className="space-y-1 pt-3 text-center text-[10px] text-neutral-600">
        <p>Zaad: {CLINIC_ZAAD}</p>
        <p>eDahab: {CLINIC_EDAHAB}</p>
        <p>MyCash (Amal Bank): {CLINIC_MYCASH}</p>
        <p className="pt-2 text-neutral-500">Thank you for trusting {CLINIC_LEGAL_NAME}.</p>
        <p className="pt-1 text-[9px] text-neutral-400">{sale.receipt_number}</p>
      </div>
    </div>
  )
}

function A4Invoice({ sale, customerName }: { sale: Sale; customerName: string }) {
  const inv = invoiceNumberFromReceipt(sale.receipt_number)
  return (
    <div className="mx-auto max-w-[210mm] space-y-6 border border-[#DDE7E5] bg-white p-8 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-[#DDE7E5] pb-6">
        <div>
          <img
            src={CLINIC_LOGO_SRC}
            alt={CLINIC_MARK_NAME}
            className="h-24 w-24 object-contain"
          />
          <div className="mt-3 space-y-0.5 text-xs text-[#536E75]">
            <p className="font-semibold text-[#10262D]">{CLINIC_LEGAL_NAME}</p>
            <p>{CLINIC_ADDRESS}</p>
            <p>Tel: {CLINIC_PHONE}</p>
            <p>
              Tax ID: <span className="font-mono">{CLINIC_TAX_ID}</span>
            </p>
          </div>
        </div>
        <div className="text-end">
          <h2 className="font-display text-2xl font-black tracking-tight text-[#0C3B4A]">
            TAX INVOICE
          </h2>
          <p className="mt-1 font-mono text-xs font-bold text-[#12A6A0]">#{inv}</p>
          <div className="mt-3 space-y-0.5 text-xs text-[#536E75]">
            <p>Date: {new Date(sale.created_at).toLocaleDateString()}</p>
            {sale.due_date ? <p>Due: {sale.due_date}</p> : null}
            <p>Receipt: {sale.receipt_number}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-bold text-[#0C3B4A]">Bill to</p>
          <p className="mt-1 font-semibold">{customerName}</p>
          <p className="text-[#536E75]">
            {sale.price_list === 'wholesale' ? 'Wholesale account' : 'Retail / walk-in'}
          </p>
        </div>
        <div className="text-end">
          <p className="font-bold text-[#0C3B4A]">Payment status</p>
          <p className="mt-1 font-semibold capitalize">{sale.status}</p>
          <p className="text-[#536E75]">
            Paid {formatMoney(sale.paid_total)} of {formatMoney(sale.total)}
          </p>
        </div>
      </div>

      <table className="w-full text-left text-xs">
        <thead className="border-b border-[#DDE7E5] text-[10px] tracking-wide text-[#536E75] uppercase">
          <tr>
            <th className="py-2 font-semibold">Code</th>
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-end font-semibold">Qty</th>
            <th className="py-2 text-end font-semibold">Unit (ex-VAT)</th>
            <th className="py-2 text-end font-semibold">VAT</th>
            <th className="py-2 text-end font-semibold">Gross</th>
          </tr>
        </thead>
        <tbody>
          {sale.sale_lines.map((line) => (
            <tr key={line.id} className="border-b border-[#EEF4F3]">
              <td className="py-2 font-mono">{line.sku_or_code}</td>
              <td className="py-2">{line.name}</td>
              <td className="py-2 text-end font-mono">{line.qty}</td>
              <td className="py-2 text-end font-mono">{formatMoney(line.unit_price)}</td>
              <td className="py-2 text-end font-mono">{formatMoney(line.tax_amount)}</td>
              <td className="py-2 text-end font-mono font-bold">{formatMoney(line.line_gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-full max-w-xs space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-[#536E75]">Subtotal (ex-VAT)</span>
          <span className="font-mono font-bold">{formatMoney(sale.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#536E75]">VAT</span>
          <span className="font-mono font-bold">{formatMoney(sale.tax_total)}</span>
        </div>
        <div className="flex justify-between border-t border-[#DDE7E5] pt-2 text-sm font-bold text-[#0C3B4A]">
          <span>Total</span>
          <span className="font-mono">{formatMoney(sale.total)}</span>
        </div>
        {sale.payments.length > 0 ? (
          <div className="space-y-1 border-t border-[#EEF4F3] pt-2">
            {sale.payments.map((pay) => (
              <div key={pay.id} className="flex justify-between text-[#536E75]">
                <span>
                  {TENDER_LABELS[pay.tender]}
                  {pay.reference ? ` · ${pay.reference}` : ''}
                </span>
                <span className="font-mono">{formatMoney(pay.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#DDE7E5] pt-4 text-[11px] text-[#536E75]">
        <p>
          Payment accounts — Zaad: {CLINIC_ZAAD} · eDahab: {CLINIC_EDAHAB} · MyCash (Amal Bank):{' '}
          {CLINIC_MYCASH}
        </p>
        <p className="mt-2">Prices exclude VAT unless noted. Amounts in USD.</p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-end font-semibold">{value}</span>
    </div>
  )
}
