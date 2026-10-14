import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, History, Layers, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { Modal } from '../components/Modal.tsx'
import { StockCountDrawer } from '../components/StockCountDrawer.tsx'
import { useAuth } from '../lib/auth.tsx'
import {
  basePrice,
  fetchCategories,
  fetchItems,
  fetchTaxRates,
  saveItem,
} from '../lib/catalog/api.ts'
import type { CatalogItem, ItemInput, PriceTierInput } from '../lib/catalog/types.ts'
import { formatMoney } from '../lib/money.ts'
import {
  alertStatusClass,
  alertStatusLabel,
  alertStockStatus,
  buildAlertCounts,
  daysUntilExpiry,
  isWithinExpiryWindow,
  type ExpiryWindow,
} from '../lib/stock/alerts.ts'
import {
  adjustStock,
  fetchBranchStockSummaries,
  fetchItemBatches,
  fetchItemMovements,
  movementLabel,
} from '../lib/stock/api.ts'
import type { AdjustReason, BranchStockSummary } from '../lib/stock/types.ts'

type StatusFilter = 'all' | 'low-stock' | 'out-of-stock' | 'near-30' | 'near-60' | 'near-90'

type TierDraft = PriceTierInput & { key: string }

const ADJUST_REASONS: AdjustReason[] = [
  'Count reconciliation',
  'Damage',
  'Expired batch',
  'Returned to vendor',
]

function emptyTiers(): TierDraft[] {
  return [
    { key: 'retail-1', price_list: 'retail', min_qty: 1, price: 0 },
    { key: 'wholesale-1', price_list: 'wholesale', min_qty: 1, price: 0 },
  ]
}

function tiersFromItem(item: CatalogItem): TierDraft[] {
  if (!item.item_prices?.length) return emptyTiers()
  return item.item_prices.map((tier, index) => ({
    key: `${tier.price_list}-${tier.min_qty}-${index}`,
    price_list: tier.price_list,
    min_qty: Number(tier.min_qty),
    price: Number(tier.price),
  }))
}

function summaryFor(
  map: Map<string, BranchStockSummary>,
  itemId: string,
): BranchStockSummary {
  return (
    map.get(itemId) ?? {
      item_id: itemId,
      qty_on_hand: 0,
      nearest_expiry: null,
      batch_count: 0,
      ever_stocked: false,
    }
  )
}

export function StockPage() {
  const { branchId, profile } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [detailItem, setDetailItem] = useState<CatalogItem | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [countOpen, setCountOpen] = useState(false)
  const [adjustReason, setAdjustReason] = useState<AdjustReason>('Count reconciliation')
  const [adjustQty, setAdjustQty] = useState('0')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustBatchId, setAdjustBatchId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unit, setUnit] = useState('')
  const [cost, setCost] = useState('0')
  const [reorderLevel, setReorderLevel] = useState('0')
  const [taxRateId, setTaxRateId] = useState('')
  const [active, setActive] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>(emptyTiers())

  const canAdjust =
    profile?.role === 'owner' ||
    profile?.role === 'branch_manager' ||
    profile?.role === 'storekeeper'

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories(true) })
  const taxRatesQuery = useQuery({ queryKey: ['tax_rates'], queryFn: () => fetchTaxRates(true) })
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems })
  const stockQuery = useQuery({
    queryKey: ['stock_summaries', branchId],
    queryFn: () => fetchBranchStockSummaries(branchId as string),
    enabled: branchId !== 'all',
  })
  const batchesQuery = useQuery({
    queryKey: ['stock_batches', branchId, detailItem?.id],
    queryFn: () => fetchItemBatches(branchId as string, detailItem!.id),
    enabled: branchId !== 'all' && Boolean(detailItem),
  })
  const movementsQuery = useQuery({
    queryKey: ['stock_movements', branchId, detailItem?.id],
    queryFn: () => fetchItemMovements(branchId as string, detailItem!.id),
    enabled: branchId !== 'all' && Boolean(detailItem),
  })

  const saveMutation = useMutation({
    mutationFn: (input: { values: ItemInput; id?: string }) => saveItem(input.values, input.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['items'] })
      closeCatalog()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustStock({
        branchId: branchId as string,
        itemId: detailItem!.id,
        qtyDelta: Number(adjustQty),
        reason: adjustReason,
        notes: adjustNotes,
        batchId: adjustBatchId || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock_summaries', branchId] }),
        queryClient.invalidateQueries({ queryKey: ['stock_batches', branchId, detailItem?.id] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements', branchId, detailItem?.id] }),
      ])
      setAdjustOpen(false)
      setAdjustQty('0')
      setAdjustNotes('')
      setAdjustBatchId('')
      setFormError(null)
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const categories = categoriesQuery.data ?? []
  const taxRates = taxRatesQuery.data ?? []
  const items = (itemsQuery.data ?? []) as CatalogItem[]
  const stockMap = useMemo(() => {
    const map = new Map<string, BranchStockSummary>()
    for (const row of stockQuery.data ?? []) map.set(row.item_id, row)
    return map
  }, [stockQuery.data])

  const alertCounts = useMemo(
    () =>
      buildAlertCounts(
        items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          reorder_level: Number(item.reorder_level),
          active: item.active,
        })),
        [...stockMap.values()],
      ),
    [items, stockMap],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false
      const stock = summaryFor(stockMap, item.id)
      const qty = stock.qty_on_hand
      const reorder = Number(item.reorder_level)

      if (statusFilter === 'low-stock' && !(qty > 0 && qty <= reorder)) return false
      if (statusFilter === 'out-of-stock' && !(qty <= 0 && stock.ever_stocked)) return false
      if (statusFilter === 'near-30' || statusFilter === 'near-60' || statusFilter === 'near-90') {
        const window = Number(statusFilter.slice(5)) as ExpiryWindow
        if (!isWithinExpiryWindow(stock.nearest_expiry, window)) return false
      }

      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, search, categoryFilter, statusFilter, stockMap])

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Stock</h1>
        <p className="mt-3 max-w-xl text-muted">Choose one branch in the header to use this screen.</p>
      </section>
    )
  }

  function openCreate() {
    setEditing(null)
    setSku('')
    setBarcode('')
    setName('')
    setCategoryId(categories.find((row) => row.active)?.id ?? '')
    setUnit('')
    setCost('0')
    setReorderLevel('0')
    setTaxRateId(taxRates.find((row) => row.active)?.id ?? '')
    setActive(true)
    setTiers(emptyTiers())
    setFormError(null)
    setCatalogOpen(true)
  }

  function openEdit(item: CatalogItem) {
    setEditing(item)
    setSku(item.sku)
    setBarcode(item.barcode ?? '')
    setName(item.name)
    setCategoryId(item.category_id)
    setUnit(item.unit)
    setCost(String(item.cost))
    setReorderLevel(String(item.reorder_level))
    setTaxRateId(item.tax_rate_id ?? '')
    setActive(item.active)
    setTiers(tiersFromItem(item))
    setFormError(null)
    setCatalogOpen(true)
  }

  function closeCatalog() {
    setCatalogOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function openDetail(item: CatalogItem) {
    setDetailItem(item)
    setFormError(null)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!categoryId) {
      setFormError('Choose a category.')
      return
    }
    if (!name.trim() || !sku.trim() || !unit.trim()) {
      setFormError('Name, SKU, and unit are required.')
      return
    }
    const prices = tiers
      .filter((tier) => Number(tier.price) >= 0 && Number(tier.min_qty) > 0)
      .map(({ price_list, min_qty, price }) => ({
        price_list,
        min_qty: Number(min_qty),
        price: Number(price),
      }))
    if (!prices.some((tier) => tier.price_list === 'retail' && tier.min_qty === 1)) {
      setFormError('Add a retail price for quantity 1.')
      return
    }
    saveMutation.mutate({
      id: editing?.id,
      values: {
        sku,
        barcode: barcode || null,
        name,
        category_id: categoryId,
        unit,
        cost: Number(cost) || 0,
        reorder_level: Number(reorderLevel) || 0,
        tax_rate_id: taxRateId || null,
        active,
        prices,
      },
    })
  }

  const detailStock = detailItem ? summaryFor(stockMap, detailItem.id) : null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Stock</h1>
          <p className="mt-1 text-sm text-muted">
            On-hand quantities, batches, movements, and adjustments for this branch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdjust ? (
            <>
              <button
                type="button"
                onClick={() => setCountOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-dentaflow border border-line bg-surface px-4 text-sm font-bold"
              >
                <ClipboardList className="h-4 w-4" />
                Stock count
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!detailItem && filtered[0]) openDetail(filtered[0])
                  setAdjustOpen(true)
                  setFormError(null)
                }}
                disabled={!detailItem && filtered.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Adjust stock
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-dentaflow border border-line bg-surface px-4 text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            New item
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-dentaflow border border-line bg-surface p-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, SKU, or barcode"
            className="h-10 w-full rounded-dentaflow border border-line bg-canvas pe-3 ps-9 text-sm"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-10 rounded-dentaflow border border-line bg-canvas px-3 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All'],
              ['low-stock', `Low (${alertCounts.lowStock})`],
              ['out-of-stock', `Out (${alertCounts.outOfStock})`],
              ['near-30', `≤30d (${alertCounts.nearExpiry30})`],
              ['near-60', `≤60d (${alertCounts.nearExpiry60})`],
              ['near-90', `≤90d (${alertCounts.nearExpiry90})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`h-10 rounded-dentaflow px-3 text-xs font-semibold ${
                statusFilter === id
                  ? 'bg-marine text-white'
                  : 'border border-line bg-canvas text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(alertCounts.lowStock > 0 ||
        alertCounts.outOfStock > 0 ||
        alertCounts.nearExpiryItems > 0) && (
        <div className="flex flex-wrap gap-3 rounded-dentaflow border border-status-amber/40 bg-status-amber/10 px-4 py-3 text-sm">
          <span className="font-semibold text-status-amber">Stock alerts</span>
          <span className="text-muted">
            {alertCounts.outOfStock} out · {alertCounts.lowStock} low ·{' '}
            {alertCounts.nearExpiry30} within 30d · {alertCounts.nearExpiry90} within 90d
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 text-end font-semibold">On hand</th>
              <th className="px-4 py-3 text-end font-semibold">Reorder</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-end font-semibold">Nearest expiry</th>
            </tr>
          </thead>
          <tbody>
            {itemsQuery.isLoading || stockQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  Loading stock…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  No items match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const stock = summaryFor(stockMap, item.id)
                const days = stock.nearest_expiry
                  ? daysUntilExpiry(stock.nearest_expiry)
                  : undefined
                const status = alertStockStatus(
                  stock.qty_on_hand,
                  Number(item.reorder_level),
                  stock.nearest_expiry,
                )
                const expiryUrgent = days != null && days <= 30
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle/60"
                    onClick={() => openDetail(item)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-[11px] text-muted">
                        {stock.batch_count} batch{stock.batch_count === 1 ? '' : 'es'} · {item.unit}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.categories?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-end font-mono text-sm font-bold">
                      {stock.qty_on_hand}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-xs text-muted">
                      {item.reorder_level}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${alertStatusClass(status)}`}
                      >
                        {alertStatusLabel(status, days)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-end font-mono text-xs ${
                        expiryUrgent ? 'font-bold text-status-red' : 'text-muted'
                      }`}
                    >
                      {stock.nearest_expiry ?? '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={detailItem?.name ?? 'Item'}
        subtitle={
          detailItem
            ? `SKU ${detailItem.sku} · ${detailItem.categories?.name ?? 'Uncategorized'}`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (detailItem) openEdit(detailItem)
              }}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Edit catalog
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
              >
                Close
              </button>
              {canAdjust ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdjustOpen(true)
                    setFormError(null)
                  }}
                  className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
                >
                  Adjust stock
                </button>
              ) : null}
            </div>
          </div>
        }
      >
        {detailItem && detailStock ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3 rounded-dentaflow bg-subtle p-3">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  On hand
                </p>
                <p className="font-mono text-sm font-bold">{detailStock.qty_on_hand}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Retail
                </p>
                <p className="font-mono text-sm font-bold">
                  {formatMoney(basePrice(detailItem.item_prices ?? [], 'retail') ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  Cost
                </p>
                <p className="font-mono text-sm font-bold text-muted">
                  {formatMoney(Number(detailItem.cost))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold">
                <Layers className="h-3.5 w-3.5 text-flow-teal" />
                Batches ({batchesQuery.data?.length ?? 0})
              </h3>
              <div className="overflow-hidden rounded-dentaflow border border-line">
                <table className="min-w-full text-xs">
                  <thead className="bg-subtle text-[10px] tracking-wide text-muted uppercase">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold">Batch</th>
                      <th className="px-3 py-2 text-end font-semibold">Qty</th>
                      <th className="px-3 py-2 text-end font-semibold">Cost</th>
                      <th className="px-3 py-2 text-end font-semibold">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchesQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-muted">
                          No batches at this branch yet.
                        </td>
                      </tr>
                    ) : (
                      (batchesQuery.data ?? []).map((batch) => (
                        <tr key={batch.id} className="border-t border-line">
                          <td className="px-3 py-2 font-mono">{batch.batch_no}</td>
                          <td className="px-3 py-2 text-end font-mono font-bold">
                            {batch.qty_remaining}
                          </td>
                          <td className="px-3 py-2 text-end font-mono">
                            {formatMoney(Number(batch.unit_cost))}
                          </td>
                          <td
                            className={`px-3 py-2 text-end font-mono ${
                              daysUntilExpiry(batch.expiry_date) <= 30
                                ? 'font-bold text-status-red'
                                : daysUntilExpiry(batch.expiry_date) <= 90
                                  ? 'font-semibold text-status-amber'
                                  : ''
                            }`}
                          >
                            {batch.expiry_date}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted">Batches listed earliest expiry first (FEFO).</p>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold">
                <History className="h-3.5 w-3.5 text-flow-teal" />
                Movement history
              </h3>
              {(movementsQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted italic">No movements for this item yet.</p>
              ) : (
                <div className="divide-y divide-line rounded-dentaflow border border-line">
                  {(movementsQuery.data ?? []).map((movement) => (
                    <div key={movement.id} className="space-y-1 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold capitalize">
                          {movementLabel(movement.movement_type)}
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            Number(movement.qty) < 0 ? 'text-status-red' : 'text-status-green'
                          }`}
                        >
                          {Number(movement.qty) > 0 ? `+${movement.qty}` : movement.qty}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 text-[11px] text-muted">
                        <span>{movement.ref_type ?? '—'}</span>
                        <span className="font-mono">
                          {new Date(movement.created_at).toLocaleString()}
                        </span>
                      </div>
                      {movement.notes ? (
                        <p className="text-[11px] text-muted italic">{movement.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={adjustOpen && Boolean(detailItem)}
        onClose={() => {
          setAdjustOpen(false)
          setFormError(null)
        }}
        title="Adjust inventory"
        subtitle={detailItem ? `Adjusting ${detailItem.name}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={adjustMutation.isPending || Number(adjustQty) === 0}
              onClick={() => {
                setFormError(null)
                adjustMutation.mutate()
              }}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {adjustMutation.isPending ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <label className="block font-semibold">
            Reason
            <select
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value as AdjustReason)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              {ADJUST_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold">
            Quantity delta (+ increase, − decrease)
            <input
              type="number"
              step="0.01"
              value={adjustQty}
              onChange={(event) => setAdjustQty(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
            />
          </label>
          <label className="block font-semibold">
            Batch (optional)
            <select
              value={adjustBatchId}
              onChange={(event) => setAdjustBatchId(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">
                {Number(adjustQty) < 0 ? 'FEFO across batches' : 'New adjustment batch'}
              </option>
              {(batchesQuery.data ?? [])
                .filter((batch) => Number(batch.qty_remaining) > 0 || Number(adjustQty) > 0)
                .map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no} · {batch.qty_remaining} left · exp {batch.expiry_date}
                  </option>
                ))}
            </select>
          </label>
          <label className="block font-semibold">
            Notes
            <textarea
              rows={3}
              value={adjustNotes}
              onChange={(event) => setAdjustNotes(event.target.value)}
              className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
              placeholder="Optional auditor notes"
            />
          </label>
          {formError ? <p className="text-sm text-status-red">{formError}</p> : null}
        </div>
      </Modal>

      <StockCountDrawer
        open={countOpen}
        branchId={branchId}
        onClose={() => setCountOpen(false)}
      />

      <Drawer
        open={catalogOpen}
        onClose={closeCatalog}
        title={editing ? 'Edit item' : 'New item'}
        subtitle="Shared across all branches. Prices exclude VAT."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeCatalog}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="item-form"
              disabled={saveMutation.isPending}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save item'}
            </button>
          </div>
        }
      >
        <form id="item-form" onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              SKU
              <input
                required
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Barcode
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Category
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              >
                <option value="">Select…</option>
                {categories
                  .filter((row) => row.active || row.id === categoryId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Unit
              <input
                required
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="Box, syringe, kit…"
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Cost (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Reorder level
              <input
                type="number"
                min="0"
                step="0.01"
                value={reorderLevel}
                onChange={(event) => setReorderLevel(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Tax rate
            <select
              value={taxRateId}
              onChange={(event) => setTaxRateId(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">None yet</option>
              {taxRates
                .filter((row) => row.active || row.id === taxRateId)
                .map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.name} ({(Number(rate.rate) * 100).toFixed(2).replace(/\.?0+$/, '')}%)
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="rounded border-line"
            />
            Active
          </label>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Price tiers</p>
              <button
                type="button"
                onClick={() =>
                  setTiers((current) => [
                    ...current,
                    {
                      key: `tier-${Date.now()}`,
                      price_list: 'wholesale',
                      min_qty: 10,
                      price: 0,
                    },
                  ])
                }
                className="text-xs font-semibold text-flow-teal"
              >
                Add tier
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {tiers.map((tier, index) => (
                <div key={tier.key} className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2">
                  <select
                    value={tier.price_list}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                price_list: event.target.value as PriceTierInput['price_list'],
                              }
                            : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={tier.min_qty}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, min_qty: Number(event.target.value) } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                    aria-label="Minimum quantity"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.price}
                    onChange={(event) =>
                      setTiers((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, price: Number(event.target.value) } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                    aria-label="Price"
                  />
                  <button
                    type="button"
                    disabled={tiers.length <= 1}
                    onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                    className="text-xs font-semibold text-muted disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">Columns: list, min qty, USD price.</p>
          </div>

          {formError && catalogOpen ? <p className="text-sm text-status-red">{formError}</p> : null}
        </form>
      </Drawer>
    </section>
  )
}
