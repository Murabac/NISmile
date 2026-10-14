import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Printer, RotateCcw, Search, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ReturnDrawer } from '../components/ReturnDrawer.tsx'
import { SaleDocumentsModal } from '../components/SaleDocumentsModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { formatMoney } from '../lib/money.ts'
import { fetchBranchSales } from '../lib/sales/api.ts'
import type { Sale, SaleStatus } from '../lib/sales/types.ts'

type StatusFilter = 'all' | SaleStatus

function statusLabel(status: SaleStatus) {
  if (status === 'partial') return 'Partial'
  if (status === 'void') return 'Void'
  return 'Paid'
}

function statusClass(status: SaleStatus) {
  if (status === 'partial') return 'bg-status-amber/15 text-status-amber'
  if (status === 'void') return 'bg-muted/20 text-muted'
  return 'bg-status-green/15 text-status-green'
}

export function SalesPage() {
  const { branchId } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [docSale, setDocSale] = useState<Sale | null>(null)
  const [docMode, setDocMode] = useState<'receipt' | 'invoice'>('receipt')
  const [returnSale, setReturnSale] = useState<Sale | null>(null)

  const salesQuery = useQuery({
    queryKey: ['branch_sales', branchId, status],
    queryFn: () => fetchBranchSales(branchId, { status, limit: 200 }),
    enabled: branchId !== 'all',
  })

  const sales = salesQuery.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sales
    return sales.filter((sale) => {
      const customer = (sale.customer_name ?? 'walk-in').toLowerCase()
      return (
        sale.receipt_number.toLowerCase().includes(q) ||
        customer.includes(q) ||
        (sale.notes ?? '').toLowerCase().includes(q)
      )
    })
  }, [sales, search])

  const totals = useMemo(() => {
    const active = filtered.filter((s) => s.status !== 'void')
    return {
      count: filtered.length,
      sales: active.reduce((sum, s) => sum + s.total, 0),
      paid: active.reduce((sum, s) => sum + s.paid_total, 0),
      open: active
        .filter((s) => s.status === 'partial')
        .reduce((sum, s) => sum + (s.total - s.paid_total), 0),
    }
  }, [filtered])

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Sales</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header to browse sales, print documents, and process returns.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Sales</h1>
          <p className="mt-1 text-sm text-muted">
            Branch sales history — open receipts, invoices, and returns.
          </p>
        </div>
        <Link
          to="/pos"
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <ShoppingBag className="h-4 w-4" />
          New sale
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Shown" value={String(totals.count)} />
        <Stat label="Sales total" value={formatMoney(totals.sales)} />
        <Stat label="Open AR" value={formatMoney(totals.open)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search receipt, customer, notes"
            className="h-10 w-full rounded-dentaflow border border-line bg-surface pe-3 ps-9 text-sm"
          />
        </label>
        <div className="inline-flex rounded-lg bg-canvas p-1">
          {(['all', 'paid', 'partial', 'void'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize ${
                status === value ? 'bg-surface shadow-sm' : 'text-muted'
              }`}
            >
              {value === 'all' ? 'All' : statusLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {salesQuery.isLoading ? (
        <p className="text-sm text-muted">Loading sales…</p>
      ) : salesQuery.isError ? (
        <p className="text-sm text-status-red">{(salesQuery.error as Error).message}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-dentaflow border border-dashed border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-muted">No sales match this filter.</p>
          <Link to="/pos" className="mt-3 inline-block text-sm font-semibold text-flow-teal">
            Open Point of Sale
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Receipt</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-end font-semibold">Total</th>
                <th className="px-4 py-3 text-end font-semibold">Paid</th>
                <th className="px-4 py-3 text-end font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
                <tr key={sale.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date(sale.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{sale.receipt_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{sale.customer_name ?? 'Walk-in'}</p>
                    <p className="text-[11px] capitalize text-muted">
                      {sale.customer_type ?? sale.price_list}
                      {sale.due_date ? ` · due ${sale.due_date}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusClass(sale.status)}`}
                    >
                      {statusLabel(sale.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold">
                    {formatMoney(sale.total)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-muted">
                    {formatMoney(sale.paid_total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        title="Receipt"
                        onClick={() => {
                          setDocMode('receipt')
                          setDocSale(sale)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-flow-teal"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Invoice"
                        onClick={() => {
                          setDocMode('invoice')
                          setDocSale(sale)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-flow-teal"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      {sale.status !== 'void' ? (
                        <button
                          type="button"
                          title="Return"
                          onClick={() => setReturnSale(sale)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-flow-teal"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {docSale ? (
        <SaleDocumentsModal
          key={`${docSale.id}-${docMode}`}
          sale={docSale}
          customerName={docSale.customer_name ?? 'Walk-in'}
          defaultMode={docMode}
          onClose={() => setDocSale(null)}
        />
      ) : null}

      {returnSale ? (
        <ReturnDrawer
          open={Boolean(returnSale)}
          sale={returnSale}
          branchId={returnSale.branch_id}
          onClose={() => setReturnSale(null)}
        />
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-dentaflow border border-line bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold">{value}</p>
    </div>
  )
}
