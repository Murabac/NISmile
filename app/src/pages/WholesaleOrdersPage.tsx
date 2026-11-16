import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  FileText,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { ReturnDrawer } from '../components/ReturnDrawer.tsx'
import { SaleDocumentsModal } from '../components/SaleDocumentsModal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems, basePrice } from '../lib/catalog/api.ts'
import type { CatalogItem } from '../lib/catalog/types.ts'
import {
  foreignCurrencyForRegion,
  formatForeign,
  formatMoney,
  formatMoneyForRegion,
  rateForRegion,
} from '../lib/money.ts'
import { customerArBalance } from '../lib/customers/api.ts'
import { fetchClinicSettings } from '../lib/loyalty/api.ts'
import {
  checkoutSale,
  fetchBranchCustomers,
  fetchSale,
  resolveDisplayPrice,
} from '../lib/sales/api.ts'
import {
  TENDER_LABELS,
  type PaymentTender,
  type Sale,
} from '../lib/sales/types.ts'
import { fetchBranchStockSummaries } from '../lib/stock/api.ts'

type CartLine = {
  key: string
  item_id: string
  sku: string
  name: string
  qty: number
  unit_price: number
  tax_rate: number
}

type TenderDraft = Record<PaymentTender, string>

const emptyTenders = (): TenderDraft => ({
  cash: '',
  zaad: '',
  edahab: '',
  mycash: '',
})

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function phoneMatches(phone: string | null, query: string): boolean {
  const queryDigits = phoneDigits(query)
  if (queryDigits.length < 3 || !phone) return false
  const stored = phoneDigits(phone)
  if (!stored) return false
  if (stored.includes(queryDigits)) return true
  const local = stored.replace(/^252/, '').replace(/^0+/, '')
  const typed = queryDigits.replace(/^252/, '').replace(/^0+/, '')
  return typed.length >= 3 && local.includes(typed)
}

function customerMatchesQuery(
  customer: { name: string; phone: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (customer.name.toLowerCase().includes(q)) return true
  return phoneMatches(customer.phone, q)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function WholesaleOrdersPage() {
  const { branchId, branches } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [customerId, setCustomerId] = useState<string>('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerHighlight, setCustomerHighlight] = useState(0)
  const customerBoxRef = useRef<HTMLDivElement>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [tenders, setTenders] = useState<TenderDraft>(emptyTenders)
  const [foreignPay, setForeignPay] = useState('')
  const [chargeToAccount, setChargeToAccount] = useState(true)
  const [dueDate, setDueDate] = useState(() => defaultDueDate())
  const [error, setError] = useState<string | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [lastCustomerName, setLastCustomerName] = useState('Buyer')
  const [docsOpen, setDocsOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)

  const activeBranch = branches.find((b) => b.id === branchId)
  const branchRegion = activeBranch?.region ?? 'somaliland'
  const isWarehouse = activeBranch?.kind === 'warehouse'
  const branchReady = branchId !== 'all' && isWarehouse

  const itemsQuery = useQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
    enabled: branchReady,
  })
  const customersQuery = useQuery({
    queryKey: ['wholesale_buyers', branchId],
    queryFn: () => fetchBranchCustomers(branchId),
    enabled: branchReady,
  })
  const stockQuery = useQuery({
    queryKey: ['stock_summaries', branchId],
    queryFn: () => fetchBranchStockSummaries(branchId),
    enabled: branchReady,
  })
  const settingsQuery = useQuery({
    queryKey: ['clinic_settings'],
    queryFn: fetchClinicSettings,
    enabled: branchReady,
  })

  const items = (itemsQuery.data ?? []).filter((row) => row.active) as CatalogItem[]
  const buyers = useMemo(
    () => (customersQuery.data ?? []).filter((c) => c.customer_type === 'wholesale'),
    [customersQuery.data],
  )
  const customerChoices = useMemo(() => {
    const matched = buyers
      .filter((customer) => customerMatchesQuery(customer, customerQuery))
      .slice(0, 12)
    return { matched, count: matched.length }
  }, [buyers, customerQuery])

  useEffect(() => {
    setCustomerHighlight(0)
  }, [customerQuery])

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of stockQuery.data ?? []) map.set(row.item_id, row.qty_on_hand)
    return map
  }, [stockQuery.data])

  const selectedCustomer = buyers.find((c) => c.id === customerId) ?? null
  const creditLimit = selectedCustomer?.credit_limit

  const arQuery = useQuery({
    queryKey: ['customer_ar', selectedCustomer?.id],
    queryFn: () => customerArBalance(selectedCustomer!.id),
    enabled: branchReady && Boolean(selectedCustomer?.id),
  })
  const currentAr = arQuery.data ?? 0

  const itemCategories = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      if (item.categories) map.set(item.categories.id, item.categories.name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryId !== 'all' && item.category_id !== categoryId) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search, categoryId])

  const settings = settingsQuery.data
  const fxRate = rateForRegion(branchRegion, settings)
  const foreignCode = foreignCurrencyForRegion(branchRegion)

  const cartTotals = useMemo(() => {
    let subtotal = 0
    let taxTotal = 0
    for (const line of cart) {
      const net = line.unit_price * line.qty
      subtotal += net
      taxTotal += net * line.tax_rate
    }
    return {
      subtotal: round2(subtotal),
      taxTotal: round2(taxTotal),
      total: round2(subtotal + taxTotal),
    }
  }, [cart])

  const paidTotal = useMemo(() => {
    return round2(
      (Object.keys(tenders) as PaymentTender[]).reduce((sum, tender) => {
        const n = Number(tenders[tender])
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    )
  }, [tenders])

  const remaining = round2(Math.max(0, cartTotals.total - paidTotal))
  const overpaid = paidTotal > cartTotals.total + 0.009

  useEffect(() => {
    setTenders((current) => {
      let budget = cartTotals.total
      let changed = false
      const next: TenderDraft = { ...current }
      for (const tender of Object.keys(TENDER_LABELS) as PaymentTender[]) {
        const raw = next[tender]
        if (!raw.trim()) continue
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) {
          if (raw !== '') {
            next[tender] = ''
            changed = true
          }
          continue
        }
        if (n > budget + 0.0001) {
          next[tender] = budget > 0.0001 ? String(round2(budget)) : ''
          changed = true
          budget = 0
        } else {
          budget = round2(budget - n)
        }
      }
      return changed ? next : current
    })
  }, [cartTotals.total])

  function tenderOthersPaid(current: TenderDraft, tender: PaymentTender) {
    return round2(
      (Object.keys(current) as PaymentTender[]).reduce((sum, key) => {
        if (key === tender) return sum
        const n = Number(current[key])
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    )
  }

  function maxForTender(tender: PaymentTender) {
    return round2(Math.max(0, cartTotals.total - tenderOthersPaid(tenders, tender)))
  }

  function setTenderAmount(tender: PaymentTender, raw: string) {
    if (raw.trim() === '') {
      setTenders((current) => ({ ...current, [tender]: '' }))
      return
    }
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return

    setTenders((current) => {
      const max = round2(Math.max(0, cartTotals.total - tenderOthersPaid(current, tender)))
      if (n > max + 0.0001) {
        return { ...current, [tender]: max > 0.0001 ? String(max) : '' }
      }
      return { ...current, [tender]: raw }
    })
  }

  function chooseCustomer(id: string) {
    setCustomerId(id)
    setCustomerQuery('')
    setCustomerOpen(false)
    setLastSale(null)
    setChargeToAccount(true)
    setDueDate(defaultDueDate())
  }

  const onAccountAmount = chargeToAccount ? remaining : 0

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error('Select a wholesale buyer.')
      const payments = (Object.keys(tenders) as PaymentTender[])
        .map((tender) => ({
          tender,
          amount: Number(tenders[tender]),
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      if (cart.length === 0) throw new Error('Cart is empty.')
      if (cartTotals.total <= 0) throw new Error('Order total must be greater than zero.')
      if (payments.some((row) => row.amount <= 0)) {
        throw new Error('Payment amounts must be positive.')
      }
      if (paidTotal > cartTotals.total + 0.009) {
        throw new Error(
          `Paid total (${paidTotal.toFixed(2)}) cannot exceed order total (${cartTotals.total.toFixed(2)}).`,
        )
      }

      const unpaid = round2(cartTotals.total - paidTotal)
      if (unpaid > 0.009) {
        if (!chargeToAccount) {
          if (payments.length === 0) throw new Error('Enter at least one payment amount.')
          throw new Error('Turn on Charge remainder to account, or pay in full.')
        }
        if (!dueDate) throw new Error('Due date is required for on-account sales.')
        const limit = Number(creditLimit ?? 0)
        if (limit <= 0) throw new Error('Buyer has no credit limit; pay in full.')
        if (currentAr + unpaid > limit + 0.009) {
          throw new Error(
            `Credit limit exceeded (AR ${currentAr.toFixed(2)} + ${unpaid.toFixed(2)} > ${limit.toFixed(2)}).`,
          )
        }
      } else if (payments.length === 0) {
        throw new Error('Enter at least one payment amount.')
      }

      const saleId = await checkoutSale({
        branchId,
        customerId: selectedCustomer.id,
        lines: cart.map((line) => ({
          line_type: 'item' as const,
          item_id: line.item_id,
          service_id: null,
          qty: line.qty,
        })),
        payments,
        dueDate: unpaid > 0.009 && chargeToAccount ? dueDate : null,
        redeemPoints: 0,
      })

      return fetchSale(saleId)
    },
    onSuccess: async (sale) => {
      setError(null)
      setCart([])
      setTenders(emptyTenders())
      setChargeToAccount(true)
      setDueDate(defaultDueDate())
      setLastSale(sale)
      setLastCustomerName(selectedCustomer?.name ?? 'Buyer')
      setDocsOpen(true)
      await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['wholesale_buyers'] })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['customer_ar'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function addItem(item: CatalogItem) {
    const taxRate = Number(item.tax_rates?.rate ?? 0)
    const existing = cart.find((line) => line.item_id === item.id)
    const nextQty = (existing?.qty ?? 0) + 1
    const unit =
      resolveDisplayPrice(item.item_prices ?? [], 'wholesale', nextQty) ??
      basePrice(item.item_prices ?? [], 'wholesale') ??
      0
    setLastSale(null)
    setError(null)
    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, qty: nextQty, unit_price: unit, tax_rate: taxRate }
            : line,
        ),
      )
      return
    }
    setCart((current) => [
      ...current,
      {
        key: `item-${item.id}`,
        item_id: item.id,
        sku: item.sku,
        name: item.name,
        qty: 1,
        unit_price: unit,
        tax_rate: taxRate,
      },
    ])
  }

  function updateQty(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.key !== key) return line
          const qty = line.qty + delta
          if (qty <= 0) return null
          const item = items.find((row) => row.id === line.item_id)
          const unit = item
            ? (resolveDisplayPrice(item.item_prices ?? [], 'wholesale', qty) ?? line.unit_price)
            : line.unit_price
          return { ...line, qty, unit_price: unit }
        })
        .filter(Boolean) as CartLine[],
    )
  }

  function fillRemaining(tender: PaymentTender) {
    const need = maxForTender(tender)
    setTenders((current) => ({ ...current, [tender]: need > 0 ? String(need) : '' }))
  }

  if (branchId === 'all' || !isWarehouse) {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Wholesale Orders</h1>
        <p className="mt-3 max-w-xl text-muted">
          Select the <strong>N.I SMILE Wholesale</strong> warehouse branch in the header. Clinic
          branches use Point of Sale for retail patients.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Wholesale Orders</h1>
        <p className="mt-1 text-sm text-muted">
          Sell items from warehouse stock to wholesale buyers. Wholesale price list, credit / AR,
          FEFO deduction on this branch.
        </p>
      </div>

      {lastSale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-dentaflow border border-status-green/40 bg-surface px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-status-green">
            <CheckCircle2 className="h-4 w-4" />
            Order {lastSale.receipt_number} · {formatMoney(lastSale.total)} ·{' '}
            {lastSale.status === 'partial' ? 'Partial' : 'Paid'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              Receipt
            </button>
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
            >
              <FileText className="h-3.5 w-3.5" />
              A4 invoice
            </button>
            {lastSale.status !== 'void' ? (
              <button
                type="button"
                onClick={() => setReturnOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLastSale(null)}
              className="text-xs font-semibold text-flow-teal"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {docsOpen && lastSale ? (
        <SaleDocumentsModal
          key={lastSale.id}
          sale={lastSale}
          customerName={lastCustomerName}
          defaultMode="invoice"
          onClose={() => setDocsOpen(false)}
        />
      ) : null}

      <ReturnDrawer
        open={returnOpen}
        sale={lastSale}
        branchId={branchId}
        onClose={() => setReturnOpen(false)}
        onDone={async () => {
          if (!lastSale) return
          const refreshed = await fetchSale(lastSale.id)
          if (refreshed) setLastSale(refreshed)
        }}
      />

      {error ? <p className="text-sm text-status-red">{error}</p> : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="space-y-4 rounded-dentaflow border border-line bg-surface p-4 lg:col-span-7">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU, or barcode"
              className="h-11 w-full rounded-dentaflow border border-line bg-canvas pe-3 ps-9 text-sm"
            />
          </label>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                categoryId === 'all'
                  ? 'border border-flow-teal/40 bg-flow-teal/15 font-bold'
                  : 'bg-canvas text-muted'
              }`}
            >
              All
            </button>
            {itemCategories.map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryId(id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                  categoryId === id
                    ? 'border border-flow-teal/40 bg-flow-teal/15 font-bold'
                    : 'bg-canvas text-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid max-h-[580px] grid-cols-1 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const qty = stockByItem.get(item.id) ?? 0
              const price =
                resolveDisplayPrice(item.item_prices ?? [], 'wholesale', 1) ??
                basePrice(item.item_prices ?? [], 'wholesale') ??
                0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className="flex min-h-[110px] flex-col justify-between rounded-dentaflow border border-line bg-canvas p-3.5 text-start hover:border-flow-teal"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span className="font-mono">{item.sku}</span>
                      <span
                        className={`font-mono text-[10px] font-semibold ${
                          qty === 0
                            ? 'text-status-red'
                            : qty <= Number(item.reorder_level)
                              ? 'text-status-amber'
                              : 'text-status-green'
                        }`}
                      >
                        {qty} in stock
                      </span>
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-xs font-bold">{item.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                    <span className="text-[11px] text-muted">{item.unit}</span>
                    <span className="inline-flex items-center gap-2 font-mono text-sm font-bold">
                      {formatMoney(price)}
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flow-teal/15 text-flow-teal">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="sticky top-20 space-y-4 rounded-dentaflow border border-line bg-surface p-4 lg:col-span-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
              <User className="h-3.5 w-3.5 text-flow-teal" />
              Wholesale buyer
            </label>
            <div ref={customerBoxRef} className="relative">
              <input
                role="combobox"
                aria-expanded={customerOpen}
                aria-controls="wholesale-buyer-list"
                aria-autocomplete="list"
                value={
                  customerOpen
                    ? customerQuery
                    : selectedCustomer
                      ? [selectedCustomer.name, selectedCustomer.phone].filter(Boolean).join(' · ')
                      : ''
                }
                placeholder="Search buyer name or phone"
                onChange={(event) => {
                  setCustomerQuery(event.target.value)
                  setCustomerOpen(true)
                }}
                onFocus={() => {
                  setCustomerQuery('')
                  setCustomerOpen(true)
                }}
                onBlur={() => {
                  window.setTimeout(() => setCustomerOpen(false), 120)
                }}
                onKeyDown={(event) => {
                  if (!customerOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
                    setCustomerOpen(true)
                    return
                  }
                  if (event.key === 'Escape') {
                    setCustomerOpen(false)
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setCustomerHighlight((index) =>
                      Math.min(index + 1, Math.max(customerChoices.count - 1, 0)),
                    )
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setCustomerHighlight((index) => Math.max(index - 1, 0))
                  } else if (event.key === 'Enter' && customerOpen) {
                    event.preventDefault()
                    if (customerChoices.matched[customerHighlight]) {
                      chooseCustomer(customerChoices.matched[customerHighlight].id)
                    }
                  }
                }}
                className="h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 text-sm"
              />
              {customerOpen ? (
                <ul
                  id="wholesale-buyer-list"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-dentaflow border border-line bg-surface py-1 shadow-lg"
                >
                  {customerChoices.matched.map((customer, index) => {
                    const queryHasDigits = phoneDigits(customerQuery).length >= 3
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={customer.id === customerId}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseCustomer(customer.id)}
                          className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-start ${
                            customerHighlight === index ? 'bg-canvas' : ''
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {queryHasDigits && customer.phone ? customer.phone : customer.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {queryHasDigits && customer.phone
                                ? customer.name
                                : customer.phone || 'No phone'}
                              {customer.subtype ? ` · ${customer.subtype}` : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {customerChoices.count === 0 ? (
                    <li className="px-3 py-2 text-xs text-muted">
                      No wholesale buyer with that name or phone. Add buyers under Customers.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            <p className="text-[11px] text-muted">Price list: Wholesale items</p>
            {selectedCustomer ? (
              <div className="rounded-dentaflow bg-canvas px-3 py-2 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Open AR</span>
                  <span className="font-mono font-bold">{formatMoney(currentAr)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-muted">Credit limit</span>
                  <span className="font-mono font-bold">
                    {creditLimit == null || Number(creditLimit) <= 0
                      ? 'None'
                      : formatMoney(Number(creditLimit))}
                  </span>
                </div>
                {selectedCustomer.subtype ? (
                  <p className="mt-1 text-muted">Subtype: {selectedCustomer.subtype}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Cart</h2>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-muted"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {cart.length === 0 ? (
              <p className="rounded-dentaflow border border-dashed border-line bg-canvas px-3 py-6 text-center text-xs text-muted">
                Tap catalog cards to add lines.
              </p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-dentaflow border border-line">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-start gap-2 px-3 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{line.name}</p>
                      <p className="font-mono text-[10px] text-muted">{line.sku}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted">
                        {formatMoney(line.unit_price)} ex-VAT
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(line.key, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-8 text-center font-mono font-bold">{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.key, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-mono font-bold">
                        {formatMoney(line.unit_price * line.qty)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((current) => current.filter((row) => row.key !== line.key))
                        }
                        className="mt-2 inline-flex text-muted"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-dentaflow bg-canvas p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal (ex-VAT)</span>
              <span className="font-mono font-bold">{formatMoney(cartTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">VAT</span>
              <span className="font-mono font-bold">{formatMoney(cartTotals.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-sm">
              <span className="font-bold">Total</span>
              <span className="text-end font-mono font-extrabold">
                {formatMoneyForRegion(cartTotals.total, branchRegion, settings)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-bold">Payments</h2>
            {fxRate != null ? (
              <div className="rounded-dentaflow border border-line bg-canvas p-2 text-[11px]">
                <label className="flex flex-wrap items-end gap-2 font-semibold">
                  <span className="min-w-[7rem]">Pay in {foreignCode}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={foreignPay}
                    onChange={(e) => setForeignPay(e.target.value)}
                    placeholder={`Amount in ${foreignCode}`}
                    className="h-8 min-w-[7rem] flex-1 rounded-md border border-line bg-surface px-2 font-mono"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-marine px-2 py-1.5 text-[10px] font-bold text-white"
                    onClick={() => {
                      const n = Number(foreignPay)
                      if (!Number.isFinite(n) || n <= 0 || fxRate <= 0) return
                      const usd = round2(n / fxRate)
                      const capped = Math.min(usd, maxForTender('cash'))
                      setTenderAmount('cash', capped > 0 ? String(capped) : '')
                      setForeignPay('')
                    }}
                  >
                    → Cash USD
                  </button>
                </label>
                <p className="mt-1 text-muted">
                  Converts at clinic rate ({formatForeign(1, foreignCode, fxRate)} per $1) into Cash
                  tender.
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TENDER_LABELS) as PaymentTender[]).map((tender) => (
                <label key={tender} className="rounded-dentaflow border border-line bg-canvas p-2">
                  <span className="flex items-center justify-between text-[11px] font-semibold">
                    {TENDER_LABELS[tender]}
                    <button
                      type="button"
                      onClick={() => fillRemaining(tender)}
                      className="text-[10px] font-bold text-flow-teal"
                    >
                      Fill
                    </button>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={maxForTender(tender)}
                    step="0.01"
                    inputMode="decimal"
                    value={tenders[tender]}
                    onChange={(event) => setTenderAmount(tender, event.target.value)}
                    placeholder="0.00"
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Paid</span>
              <span className={`font-mono font-bold ${overpaid ? 'text-status-red' : ''}`}>
                {formatMoney(paidTotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Remaining</span>
              <span
                className={`font-mono font-bold ${remaining > 0 ? 'text-status-amber' : 'text-status-green'}`}
              >
                {formatMoney(remaining)}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-dentaflow border border-line bg-canvas p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={chargeToAccount}
                onChange={(event) => setChargeToAccount(event.target.checked)}
                className="rounded border-line"
              />
              Charge remainder to account
            </label>
            {chargeToAccount ? (
              <label className="block text-xs font-semibold">
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-surface px-3 font-normal"
                />
              </label>
            ) : null}
            {chargeToAccount && onAccountAmount > 0 ? (
              <p className="text-[11px] text-muted">
                On account: {formatMoney(onAccountAmount)} (not a tender)
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={
              checkoutMutation.isPending || cart.length === 0 || overpaid || !selectedCustomer
            }
            onClick={() => checkoutMutation.mutate()}
            className="h-11 w-full rounded-dentaflow bg-marine text-sm font-bold text-white disabled:opacity-60"
          >
            {checkoutMutation.isPending
              ? 'Processing…'
              : chargeToAccount && remaining > 0
                ? 'Complete on-account order'
                : remaining > 0 && paidTotal > 0
                  ? 'Complete partial order'
                  : 'Complete order'}
          </button>
        </div>
      </div>
    </section>
  )
}
