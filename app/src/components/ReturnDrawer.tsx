import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Drawer } from './Drawer.tsx'
import { formatMoney } from '../lib/money.ts'
import {
  fetchReturnedQtyByLine,
  previewReturnAmounts,
  processReturn,
} from '../lib/sales/api.ts'
import {
  TENDER_LABELS,
  type PaymentTender,
  type Sale,
} from '../lib/sales/types.ts'

type TenderDraft = Record<PaymentTender, string>

function emptyTenders(): TenderDraft {
  return { cash: '', zaad: '', edahab: '', mycash: '' }
}

export function ReturnDrawer({
  open,
  sale,
  branchId,
  onClose,
  onDone,
}: {
  open: boolean
  sale: Sale | null
  branchId: string
  onClose: () => void
  onDone?: (returnId: string) => void
}) {
  const queryClient = useQueryClient()
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({})
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [tenders, setTenders] = useState<TenderDraft>(emptyTenders())
  const [error, setError] = useState<string | null>(null)

  const returnedQuery = useQuery({
    queryKey: ['sale_returned_qty', sale?.id],
    queryFn: () => fetchReturnedQtyByLine(sale!.id),
    enabled: open && Boolean(sale?.id),
  })

  useEffect(() => {
    if (!open || !sale) return
    setRestock(true)
    setReason('')
    setTenders(emptyTenders())
    setError(null)
    setQtyByLine({})
  }, [open, sale?.id])

  const returnedMap = returnedQuery.data ?? {}

  const draftLines = useMemo(() => {
    if (!sale) return []
    return sale.sale_lines
      .map((line) => {
        const already = returnedMap[line.id] ?? 0
        const remaining = Math.max(line.qty - already, 0)
        const raw = qtyByLine[line.id]
        const qty = raw === undefined || raw === '' ? 0 : Number(raw)
        return { line, remaining, qty: Number.isFinite(qty) ? qty : 0 }
      })
      .filter((row) => row.remaining > 0.0001)
  }, [sale, returnedMap, qtyByLine])

  const selectedLines = draftLines
    .filter((row) => row.qty > 0)
    .map((row) => ({ sale_line_id: row.line.id, qty: row.qty }))

  const preview = sale
    ? previewReturnAmounts(sale, selectedLines)
    : { subtotal: 0, taxTotal: 0, total: 0, unpaid: 0, refundDue: 0 }

  const refundEntered = (Object.keys(tenders) as PaymentTender[]).reduce(
    (sum, tender) => sum + (Number(tenders[tender]) || 0),
    0,
  )

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sale) throw new Error('No sale')
      for (const row of draftLines) {
        if (row.qty < 0) throw new Error('Qty cannot be negative')
        if (row.qty > row.remaining + 0.0001) {
          throw new Error(`Only ${row.remaining} remaining for ${row.line.name}`)
        }
      }
      if (selectedLines.length === 0) throw new Error('Select at least one line to return')
      if (Math.abs(refundEntered - preview.refundDue) > 0.009) {
        throw new Error(
          `Refund tenders must total ${formatMoney(preview.refundDue)} (AR covers ${formatMoney(Math.min(preview.total, preview.unpaid))})`,
        )
      }
      const payments = (Object.keys(tenders) as PaymentTender[])
        .map((tender) => ({
          tender,
          amount: Number(tenders[tender]) || 0,
          reference: null as string | null,
        }))
        .filter((p) => p.amount > 0)

      return processReturn({
        branchId,
        saleId: sale.id,
        lines: selectedLines,
        refunds: payments,
        restock,
        reason: reason.trim() || null,
      })
    },
    onSuccess: async (returnId) => {
      await queryClient.invalidateQueries({ queryKey: ['customer_sales'] })
      await queryClient.invalidateQueries({ queryKey: ['customer_statement'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['recent_sales'] })
      await queryClient.invalidateQueries({ queryKey: ['branch_sales'] })
      await queryClient.invalidateQueries({ queryKey: ['sale_returned_qty'] })
      await queryClient.invalidateQueries({ queryKey: ['stock'] })
      onDone?.(returnId)
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!sale) return null

  const canReturn = sale.status !== 'void' && draftLines.length > 0

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Return / refund"
      subtitle={`${sale.receipt_number} · ${sale.status}`}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canReturn || mutation.isPending}
            onClick={() => {
              setError(null)
              mutation.mutate()
            }}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Processing…' : 'Process return'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!canReturn ? (
          <p className="text-sm text-muted">
            {sale.status === 'void'
              ? 'This sale is void — nothing left to return.'
              : 'All lines on this sale have already been returned.'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {draftLines.map(({ line, remaining, qty }) => (
                <div
                  key={line.id}
                  className="rounded-dentaflow border border-line bg-canvas px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{line.name}</p>
                      <p className="text-[11px] text-muted">
                        {line.sku_or_code} · {line.line_type} · sold {line.qty} · remaining{' '}
                        {remaining}
                      </p>
                    </div>
                    <label className="block w-24 text-end text-[11px] font-semibold">
                      Qty
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step="0.01"
                        value={qtyByLine[line.id] ?? ''}
                        placeholder="0"
                        onChange={(event) =>
                          setQtyByLine((current) => ({
                            ...current,
                            [line.id]: event.target.value,
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono text-sm"
                      />
                    </label>
                  </div>
                  {qty > 0 ? (
                    <p className="mt-1 text-end font-mono text-xs text-muted">
                      {formatMoney((line.line_gross / line.qty) * qty)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={restock}
                onChange={(event) => setRestock(event.target.checked)}
                className="rounded border-line"
              />
              Restock returned items
              <span className="font-normal text-muted">(services never restock materials)</span>
            </label>

            <label className="block text-sm font-semibold">
              Reason
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
                placeholder="Optional"
              />
            </label>

            <div className="rounded-dentaflow border border-line bg-canvas p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Return total</span>
                <span className="font-mono font-bold">{formatMoney(preview.total)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">Applied to unpaid AR</span>
                <span className="font-mono">
                  {formatMoney(Math.min(preview.total, preview.unpaid))}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2">
                <span className="font-semibold">Refund due</span>
                <span className="font-mono font-bold text-marine">
                  {formatMoney(preview.refundDue)}
                </span>
              </div>
            </div>

            {preview.refundDue > 0.009 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Refund tenders</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TENDER_LABELS) as PaymentTender[]).map((tender) => (
                    <label
                      key={tender}
                      className="rounded-dentaflow border border-line bg-canvas p-2"
                    >
                      <span className="text-[11px] font-semibold">{TENDER_LABELS[tender]}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tenders[tender]}
                        onChange={(event) =>
                          setTenders((current) => ({
                            ...current,
                            [tender]: event.target.value,
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono text-sm"
                        placeholder="0.00"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-status-red">{error}</p> : null}
          </>
        )}
      </div>
    </Drawer>
  )
}
