import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems } from '../lib/catalog/api.ts'
import { formatMoney } from '../lib/money.ts'
import {
  createPurchaseOrder,
  createSupplier,
  fetchPurchaseOrders,
  fetchSuppliers,
  poTotal,
  receivePurchaseOrder,
  statusLabel,
  type PurchaseOrder,
} from '../lib/purchases/api.ts'

type Tab = 'orders' | 'suppliers'
type DraftLine = { key: string; itemId: string; qty: string; unitCost: string }
type ReceiveLine = {
  lineId: string
  itemLabel: string
  remaining: number
  qty: string
  batchNo: string
  expiryDate: string
  unitCost: string
}

export function PurchasesPage() {
  const { branchId } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('orders')
  const [createOpen, setCreateOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Purchases</h1>
        <p className="mt-3 max-w-xl text-muted">Choose one branch in the header to use this screen.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Purchases</h1>
          <p className="mt-1 text-sm text-muted">
            Suppliers, purchase orders, and goods receipt with batch and expiry.
          </p>
        </div>
        {tab === 'orders' ? (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setCreateOpen(true)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            New purchase order
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setSupplierOpen(true)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            New supplier
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-line">
        <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
          Purchase orders
        </TabButton>
        <TabButton active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>
          Suppliers
        </TabButton>
      </div>

      {tab === 'orders' ? (
        <OrdersPanel
          branchId={branchId}
          onReceive={(order) => {
            setError(null)
            setReceiveOrder(order)
          }}
        />
      ) : (
        <SuppliersPanel />
      )}

      <CreateOrderDrawer
        open={createOpen}
        branchId={branchId}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => {
          setCreateOpen(false)
          await queryClient.invalidateQueries({ queryKey: ['purchase_orders', branchId] })
        }}
      />
      <CreateSupplierDrawer
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        onSaved={async () => {
          setSupplierOpen(false)
          await queryClient.invalidateQueries({ queryKey: ['suppliers'] })
        }}
      />
      <ReceiveDrawer
        order={receiveOrder}
        error={error}
        setError={setError}
        onClose={() => setReceiveOrder(null)}
        onSaved={async () => {
          setReceiveOrder(null)
          await queryClient.invalidateQueries({ queryKey: ['purchase_orders', branchId] })
        }}
      />
    </section>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-semibold ${
        active ? 'border-flow-teal text-action' : 'border-transparent text-muted hover:text-main'
      }`}
    >
      {children}
    </button>
  )
}

function OrdersPanel({
  branchId,
  onReceive,
}: {
  branchId: string
  onReceive: (order: PurchaseOrder) => void
}) {
  const ordersQuery = useQuery({
    queryKey: ['purchase_orders', branchId],
    queryFn: () => fetchPurchaseOrders(branchId),
  })

  return (
    <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">PO</th>
            <th className="px-4 py-3 font-semibold">Supplier</th>
            <th className="px-4 py-3 font-semibold">Lines</th>
            <th className="px-4 py-3 font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Order date</th>
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ordersQuery.isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-muted">
                Loading orders…
              </td>
            </tr>
          ) : (ordersQuery.data ?? []).length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-muted">
                No purchase orders yet for this branch.
              </td>
            </tr>
          ) : (
            (ordersQuery.data ?? []).map((order) => {
              const canReceive = order.status === 'ordered' || order.status === 'partial'
              return (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{order.po_number}</td>
                  <td className="px-4 py-3">{order.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3">{order.purchase_order_lines.length}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatMoney(poTotal(order))}</td>
                  <td className="px-4 py-3">{statusLabel(order.status)}</td>
                  <td className="px-4 py-3 text-muted">{order.order_date}</td>
                  <td className="px-4 py-3">
                    {canReceive ? (
                      <button
                        type="button"
                        onClick={() => onReceive(order)}
                        className="text-sm font-semibold text-flow-teal"
                      >
                        Receive
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function SuppliersPanel() {
  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchSuppliers(true),
  })

  return (
    <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Phone</th>
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {(suppliersQuery.data ?? []).length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-muted">
                No suppliers yet.
              </td>
            </tr>
          ) : (
            (suppliersQuery.data ?? []).map((supplier) => (
              <tr key={supplier.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">{supplier.name}</td>
                <td className="px-4 py-3 text-muted">{supplier.phone ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{supplier.email ?? '—'}</td>
                <td className="px-4 py-3">{supplier.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CreateSupplierDrawer({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      setName('')
      setPhone('')
      setEmail('')
      setNotes('')
      await onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Supplier name is required.')
      return
    }
    mutation.mutate({ name, phone, email, notes })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New supplier"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            form="supplier-form"
            disabled={mutation.isPending}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save supplier'}
          </button>
        </div>
      }
    >
      <form id="supplier-form" onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-semibold">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal" />
        </label>
        <label className="block text-sm font-semibold">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal" />
        </label>
        {error ? <p className="text-sm text-status-red">{error}</p> : null}
      </form>
    </Drawer>
  )
}

function CreateOrderDrawer({
  open,
  branchId,
  onClose,
  onSaved,
}: {
  open: boolean
  branchId: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: () => fetchSuppliers(false) })
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems })
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', itemId: '', qty: '1', unitCost: '0' },
  ])
  const [error, setError] = useState<string | null>(null)

  const activeItems = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => item.active),
    [itemsQuery.data],
  )

  const mutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: async () => {
      setSupplierId('')
      setExpectedDate('')
      setNotes('')
      setLines([{ key: '1', itemId: '', qty: '1', unitCost: '0' }])
      await onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!supplierId) {
      setError('Choose a supplier.')
      return
    }
    const parsed = lines
      .filter((line) => line.itemId)
      .map((line) => ({
        itemId: line.itemId,
        qtyOrdered: Number(line.qty),
        unitCost: Number(line.unitCost),
      }))
    if (parsed.length === 0 || parsed.some((line) => !(line.qtyOrdered > 0) || line.unitCost < 0)) {
      setError('Each line needs an item, quantity above 0, and a unit cost.')
      return
    }
    mutation.mutate({
      branchId,
      supplierId,
      expectedDate: expectedDate || null,
      notes,
      lines: parsed,
    })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New purchase order"
      subtitle="Ordered into the selected branch."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            form="po-form"
            disabled={mutation.isPending}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Create order'}
          </button>
        </div>
      }
    >
      <form id="po-form" onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-semibold">
          Supplier
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          >
            <option value="">Select…</option>
            {(suppliersQuery.data ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Expected date
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Lines</p>
            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { key: String(Date.now()), itemId: '', qty: '1', unitCost: '0' },
                ])
              }
              className="text-xs font-semibold text-flow-teal"
            >
              Add line
            </button>
          </div>
          {lines.map((line, index) => (
            <div key={line.key} className="grid grid-cols-[1fr_4.5rem_5.5rem_auto] gap-2">
              <select
                value={line.itemId}
                onChange={(e) =>
                  setLines((current) =>
                    current.map((row, i) => (i === index ? { ...row, itemId: e.target.value } : row)),
                  )
                }
                className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
              >
                <option value="">Item…</option>
                {activeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={line.qty}
                onChange={(e) =>
                  setLines((current) =>
                    current.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)),
                  )
                }
                className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                aria-label="Quantity"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unitCost}
                onChange={(e) =>
                  setLines((current) =>
                    current.map((row, i) => (i === index ? { ...row, unitCost: e.target.value } : row)),
                  )
                }
                className="h-10 rounded-dentaflow border border-line bg-canvas px-2 text-sm"
                aria-label="Unit cost"
              />
              <button
                type="button"
                disabled={lines.length <= 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                className="text-xs font-semibold text-muted disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <label className="block text-sm font-semibold">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
          />
        </label>
        {error ? <p className="text-sm text-status-red">{error}</p> : null}
      </form>
    </Drawer>
  )
}

function ReceiveDrawer({
  order,
  error,
  setError,
  onClose,
  onSaved,
}: {
  order: PurchaseOrder | null
  error: string | null
  setError: (value: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const openLines = useMemo(
    () =>
      (order?.purchase_order_lines ?? [])
        .map((line) => {
          const remaining = Number(line.qty_ordered) - Number(line.qty_received)
          return {
            lineId: line.id,
            itemLabel: `${line.items?.sku ?? ''} ${line.items?.name ?? ''}`.trim(),
            remaining,
            qty: String(remaining),
            batchNo: '',
            expiryDate: '',
            unitCost: String(line.unit_cost),
          } satisfies ReceiveLine
        })
        .filter((line) => line.remaining > 0),
    [order],
  )
  const [lines, setLines] = useState<ReceiveLine[]>([])

  useEffect(() => {
    setLines(openLines)
  }, [openLines])

  const mutation = useMutation({
    mutationFn: receivePurchaseOrder,
    onSuccess: async () => {
      await onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!order) return
    setError(null)
    const payload = lines
      .filter((line) => Number(line.qty) > 0)
      .map((line) => ({
        purchaseOrderLineId: line.lineId,
        qty: Number(line.qty),
        batchNo: line.batchNo.trim(),
        expiryDate: line.expiryDate,
        unitCost: Number(line.unitCost),
      }))
    if (payload.length === 0) {
      setError('Enter a quantity to receive.')
      return
    }
    if (payload.some((line) => !line.batchNo || !line.expiryDate)) {
      setError('Batch number and expiry are required for each received line.')
      return
    }
    mutation.mutate({ purchaseOrderId: order.id, lines: payload })
  }

  return (
    <Drawer
      open={Boolean(order)}
      onClose={onClose}
      title={order ? `Receive ${order.po_number}` : 'Receive'}
      subtitle="Creates stock batches and a purchase-in movement."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            form="receive-form"
            disabled={mutation.isPending}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Receiving…' : 'Confirm receipt'}
          </button>
        </div>
      }
    >
      <form id="receive-form" onSubmit={onSubmit} className="space-y-3">
        {lines.length === 0 ? (
          <p className="text-sm text-muted">Nothing left to receive on this order.</p>
        ) : (
          lines.map((line, index) => (
            <div key={line.lineId} className="space-y-2 rounded-dentaflow border border-line p-3">
              <p className="text-sm font-semibold">
                {line.itemLabel}{' '}
                <span className="font-normal text-muted">(open {line.remaining})</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold">
                  Qty
                  <input
                    type="number"
                    min="0"
                    max={line.remaining}
                    step="0.01"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)),
                      )
                    }
                    className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Unit cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, unitCost: e.target.value } : row,
                        ),
                      )
                    }
                    className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Batch #
                  <input
                    value={line.batchNo}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, batchNo: e.target.value } : row,
                        ),
                      )
                    }
                    className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Expiry
                  <input
                    type="date"
                    value={line.expiryDate}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, expiryDate: e.target.value } : row,
                        ),
                      )
                    }
                    className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-2 font-normal"
                  />
                </label>
              </div>
            </div>
          ))
        )}
        {error ? <p className="text-sm text-status-red">{error}</p> : null}
      </form>
    </Drawer>
  )
}
