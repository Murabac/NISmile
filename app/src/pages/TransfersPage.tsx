import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'
import { Modal } from '../components/Modal.tsx'
import { useAuth } from '../lib/auth.tsx'
import { fetchItems } from '../lib/catalog/api.ts'
import {
  cancelTransfer,
  createTransfer,
  fetchTransfers,
  receiveTransfer,
  sendTransfer,
  statusClass,
  statusLabel,
  type StockTransfer,
} from '../lib/transfers/api.ts'

type DraftLine = { key: string; itemId: string; qty: string }

export function TransfersPage() {
  const { branchId, branches } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [receiveTransferRow, setReceiveTransferRow] = useState<StockTransfer | null>(null)
  const [error, setError] = useState<string | null>(null)

  const otherBranches = useMemo(
    () => branches.filter((branch) => branch.id !== branchId),
    [branches, branchId],
  )

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Transfers</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header to create or receive transfers.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Transfers</h1>
          <p className="mt-1 text-sm text-muted">
            Draft, send, and receive stock between branches. Short receives become adjustments.
          </p>
        </div>
        <button
          type="button"
          disabled={otherBranches.length === 0}
          onClick={() => {
            setError(null)
            setCreateOpen(true)
          }}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New transfer
        </button>
      </div>

      {otherBranches.length === 0 ? (
        <p className="rounded-dentaflow border border-line bg-surface px-4 py-3 text-sm text-muted">
          Add a second branch before you can transfer stock.
        </p>
      ) : null}

      <TransfersTable
        branchId={branchId}
        onReceive={(row) => {
          setError(null)
          setReceiveTransferRow(row)
        }}
        onChanged={async () => {
          await queryClient.invalidateQueries({ queryKey: ['transfers'] })
          await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
        }}
      />

      <CreateTransferDrawer
        open={createOpen}
        fromBranchId={branchId}
        destinations={otherBranches}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => {
          setCreateOpen(false)
          await queryClient.invalidateQueries({ queryKey: ['transfers'] })
        }}
      />

      <ReceiveTransferModal
        transfer={receiveTransferRow}
        currentBranchId={branchId}
        error={error}
        setError={setError}
        onClose={() => setReceiveTransferRow(null)}
        onSaved={async () => {
          setReceiveTransferRow(null)
          await queryClient.invalidateQueries({ queryKey: ['transfers'] })
          await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
        }}
      />
    </section>
  )
}

function TransfersTable({
  branchId,
  onReceive,
  onChanged,
}: {
  branchId: string
  onReceive: (row: StockTransfer) => void
  onChanged: () => Promise<void>
}) {
  const transfersQuery = useQuery({
    queryKey: ['transfers', branchId],
    queryFn: () => fetchTransfers(branchId),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendTransfer(id),
    onSuccess: () => void onChanged(),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: () => void onChanged(),
  })

  return (
    <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-subtle text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Transfer</th>
            <th className="px-4 py-3 font-semibold">From</th>
            <th className="px-4 py-3 font-semibold">To</th>
            <th className="px-4 py-3 font-semibold">Lines</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transfersQuery.isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-muted">
                Loading transfers…
              </td>
            </tr>
          ) : (transfersQuery.data ?? []).length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-muted">
                No transfers for this branch yet.
              </td>
            </tr>
          ) : (
            (transfersQuery.data ?? []).map((row) => {
              const isSource = row.from_branch_id === branchId
              const isDest = row.to_branch_id === branchId
              return (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    {row.transfer_number}
                  </td>
                  <td className="px-4 py-3">{row.from_branch?.name ?? '—'}</td>
                  <td className="px-4 py-3">{row.to_branch?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{row.stock_transfer_lines.length}</span>
                    <p className="max-w-xs truncate text-[11px] text-muted">
                      {row.stock_transfer_lines
                        .map(
                          (line) =>
                            `${line.items?.name ?? 'Item'} (${line.qty_requested})`,
                        )
                        .join(', ')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === 'draft' && isSource ? (
                        <>
                          <button
                            type="button"
                            disabled={sendMutation.isPending}
                            onClick={() => sendMutation.mutate(row.id)}
                            className="text-sm font-semibold text-flow-teal disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button
                            type="button"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(row.id)}
                            className="text-sm font-semibold text-muted disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                      {row.status === 'in_transit' && isDest ? (
                        <button
                          type="button"
                          onClick={() => onReceive(row)}
                          className="text-sm font-semibold text-flow-teal"
                        >
                          Receive
                        </button>
                      ) : null}
                      {row.status === 'in_transit' && isSource && !isDest ? (
                        <span className="text-xs text-muted">Awaiting destination</span>
                      ) : null}
                      {row.status === 'received' || row.status === 'cancelled' ? (
                        <span className="text-muted">—</span>
                      ) : null}
                    </div>
                    {sendMutation.isError && sendMutation.variables === row.id ? (
                      <p className="mt-1 text-xs text-status-red">
                        {(sendMutation.error as Error).message}
                      </p>
                    ) : null}
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

function CreateTransferDrawer({
  open,
  fromBranchId,
  destinations,
  onClose,
  onSaved,
}: {
  open: boolean
  fromBranchId: string
  destinations: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: fetchItems, enabled: open })
  const [toBranchId, setToBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', itemId: '', qty: '1' },
  ])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setToBranchId(destinations[0]?.id ?? '')
    setNotes('')
    setLines([{ key: '1', itemId: '', qty: '1' }])
    setError(null)
  }, [open, destinations])

  const mutation = useMutation({
    mutationFn: () =>
      createTransfer({
        fromBranchId,
        toBranchId,
        notes,
        lines: lines
          .filter((line) => line.itemId && Number(line.qty) > 0)
          .map((line) => ({ itemId: line.itemId, qty: Number(line.qty) })),
      }),
    onSuccess: async () => {
      await onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!toBranchId) {
      setError('Choose a destination branch.')
      return
    }
    if (!lines.some((line) => line.itemId && Number(line.qty) > 0)) {
      setError('Add at least one item line.')
      return
    }
    mutation.mutate()
  }

  const items = itemsQuery.data ?? []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New stock transfer"
      subtitle="Creates a draft. Send removes stock from this branch (FEFO)."
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
            type="submit"
            form="transfer-form"
            disabled={mutation.isPending}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      }
    >
      <form id="transfer-form" onSubmit={onSubmit} className="min-w-0 space-y-4">
        <label className="block min-w-0 text-sm font-semibold">
          Destination branch
          <select
            required
            value={toBranchId}
            onChange={(event) => setToBranchId(event.target.value)}
            className="mt-1 h-10 w-full min-w-0 max-w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          >
            {destinations.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Lines</p>
            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { key: String(Date.now()), itemId: '', qty: '1' },
                ])
              }
              className="shrink-0 text-xs font-semibold text-flow-teal"
            >
              Add line
            </button>
          </div>
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_auto]"
            >
              <select
                value={line.itemId}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, itemId: event.target.value } : row,
                    ),
                  )
                }
                className="h-10 w-full min-w-0 max-w-full rounded-dentaflow border border-line bg-canvas px-2 text-sm"
              >
                <option value="">Item…</option>
                {items
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={line.qty}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, qty: event.target.value } : row,
                    ),
                  )
                }
                className="h-10 w-full min-w-0 rounded-dentaflow border border-line bg-canvas px-2 font-mono text-sm"
                aria-label="Quantity"
              />
              <button
                type="button"
                disabled={lines.length <= 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                className="justify-self-start text-xs font-semibold text-muted disabled:opacity-40 sm:justify-self-auto"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <label className="block min-w-0 text-sm font-semibold">
          Notes
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 w-full min-w-0 max-w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
          />
        </label>

        {error ? <p className="text-sm text-status-red">{error}</p> : null}
      </form>
    </Drawer>
  )
}

function ReceiveTransferModal({
  transfer,
  currentBranchId,
  error,
  setError,
  onClose,
  onSaved,
}: {
  transfer: StockTransfer | null
  currentBranchId: string
  error: string | null
  setError: (value: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!transfer) return
    const next: Record<string, string> = {}
    for (const line of transfer.stock_transfer_lines) {
      next[line.id] = String(line.qty_requested)
    }
    setQtyByLine(next)
  }, [transfer])

  const mutation = useMutation({
    mutationFn: () =>
      receiveTransfer(
        transfer!.id,
        transfer!.stock_transfer_lines.map((line) => ({
          transferLineId: line.id,
          qtyReceived: Number(qtyByLine[line.id] ?? 0),
        })),
      ),
    onSuccess: async () => {
      await onSaved()
    },
    onError: (err: Error) => setError(err.message),
  })

  const open = Boolean(transfer) && transfer?.to_branch_id === currentBranchId

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive transfer"
      subtitle={transfer ? transfer.transfer_number : undefined}
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
            disabled={mutation.isPending}
            onClick={() => {
              setError(null)
              mutation.mutate()
            }}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {mutation.isPending ? 'Receiving…' : 'Confirm receive'}
          </button>
        </div>
      }
    >
      {transfer ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted">
            From {transfer.from_branch?.name}. Enter less than sent to record a short receive
            (adjustment).
          </p>
          {transfer.stock_transfer_lines.map((line) => (
            <label key={line.id} className="block font-semibold">
              {line.items?.name ?? 'Item'}{' '}
              <span className="font-normal text-muted">
                (sent {line.qty_requested} {line.items?.unit ?? ''})
              </span>
              <input
                type="number"
                min="0"
                max={line.qty_requested}
                step="0.01"
                value={qtyByLine[line.id] ?? '0'}
                onChange={(event) =>
                  setQtyByLine((current) => ({ ...current, [line.id]: event.target.value }))
                }
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-mono font-normal"
              />
            </label>
          ))}
          {error ? <p className="text-sm text-status-red">{error}</p> : null}
        </div>
      ) : null}
    </Modal>
  )
}
