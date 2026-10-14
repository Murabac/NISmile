import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { Drawer } from './Drawer.tsx'
import {
  cancelStockCount,
  completeStockCount,
  countStatusLabel,
  createStockCount,
  fetchStockCounts,
  saveStockCountLines,
  type StockCount,
} from '../lib/stock/countApi.ts'

type Props = {
  open: boolean
  branchId: string
  onClose: () => void
}

export function StockCountDrawer({ open, branchId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const countsQuery = useQuery({
    queryKey: ['stock_counts', branchId],
    queryFn: () => fetchStockCounts(branchId),
    enabled: open,
  })

  const counts = countsQuery.data ?? []
  const draft = useMemo(() => counts.find((row) => row.status === 'draft') ?? null, [counts])
  const active: StockCount | null = useMemo(() => {
    if (activeId) return counts.find((row) => row.id === activeId) ?? draft
    return draft
  }, [activeId, counts, draft])

  useEffect(() => {
    if (!open) {
      setActiveId(null)
      setCounted({})
      setError(null)
      return
    }
    if (draft) setActiveId(draft.id)
  }, [open, draft?.id])

  useEffect(() => {
    if (!active) {
      setCounted({})
      return
    }
    const next: Record<string, string> = {}
    for (const line of active.stock_count_lines) {
      next[line.id] =
        line.counted_qty == null ? String(line.system_qty) : String(line.counted_qty)
    }
    setCounted(next)
  }, [active?.id, active?.status])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['stock_counts', branchId] })
    await queryClient.invalidateQueries({ queryKey: ['stock_summaries', branchId] })
  }

  const startMutation = useMutation({
    mutationFn: () => createStockCount(branchId),
    onSuccess: async (id) => {
      setActiveId(id)
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!active) return
      await saveStockCountLines(
        active.id,
        active.stock_count_lines.map((line) => ({
          lineId: line.id,
          countedQty: counted[line.id] === '' ? null : Number(counted[line.id]),
        })),
      )
    },
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!active) return
      await saveStockCountLines(
        active.id,
        active.stock_count_lines.map((line) => ({
          lineId: line.id,
          countedQty: counted[line.id] === '' ? null : Number(counted[line.id]),
        })),
      )
      await completeStockCount(active.id)
    },
    onSuccess: async () => {
      setError(null)
      setActiveId(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelStockCount(active!.id),
    onSuccess: async () => {
      setError(null)
      setActiveId(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const restartMutation = useMutation({
    mutationFn: async () => {
      if (draft) await cancelStockCount(draft.id)
      return createStockCount(branchId)
    },
    onSuccess: async (id) => {
      setActiveId(id)
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const isDraft = active?.status === 'draft'
  const varianceTotal = active
    ? active.stock_count_lines.reduce((sum, line) => {
        const countedQty = Number(counted[line.id] ?? line.counted_qty ?? line.system_qty)
        return sum + (countedQty - Number(line.system_qty))
      }, 0)
    : 0

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Stock count"
      subtitle="Enter physical counts. Completing posts adjustments for any variance."
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
          >
            Close
          </button>
          <div className="flex flex-wrap gap-2">
            {!draft ? (
              <button
                type="button"
                disabled={startMutation.isPending}
                onClick={() => {
                  setError(null)
                  startMutation.mutate()
                }}
                className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <ClipboardList className="h-4 w-4" />
                {startMutation.isPending ? 'Starting…' : 'Start count'}
              </button>
            ) : null}
            {isDraft && active ? (
              <>
                <button
                  type="button"
                  disabled={restartMutation.isPending}
                  onClick={() => {
                    setError(null)
                    restartMutation.mutate()
                  }}
                  className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {restartMutation.isPending ? 'Restarting…' : 'Restart count'}
                </button>
                <button
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    setError(null)
                    cancelMutation.mutate()
                  }}
                  className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold disabled:opacity-60"
                >
                  Cancel count
                </button>
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    setError(null)
                    saveMutation.mutate()
                  }}
                  className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={completeMutation.isPending}
                  onClick={() => {
                    setError(null)
                    completeMutation.mutate()
                  }}
                  className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {completeMutation.isPending ? 'Posting…' : 'Complete'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="min-w-0 space-y-4">
        {error ? <p className="text-sm text-status-red">{error}</p> : null}

        {countsQuery.isLoading ? (
          <p className="text-sm text-muted">Loading counts…</p>
        ) : null}

        {!active && !countsQuery.isLoading ? (
          <p className="text-sm text-muted">
            No open count. Start one to snapshot on-hand quantities for this branch.
          </p>
        ) : null}

        {active ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Lines are frozen when the count starts. Use Restart count after adding stock or
              catalog items.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                Status:{' '}
                <strong className="text-main">{countStatusLabel(active.status)}</strong>
                {' · '}
                {active.stock_count_lines.length} items
              </span>
              {isDraft ? (
                <span>
                  Net variance:{' '}
                  <strong
                    className={
                      varianceTotal === 0
                        ? 'text-main'
                        : varianceTotal < 0
                          ? 'text-status-red'
                          : 'text-status-green'
                    }
                  >
                    {varianceTotal > 0 ? `+${varianceTotal}` : varianceTotal}
                  </strong>
                </span>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-dentaflow border border-line">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-subtle text-[10px] tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 text-end font-semibold">System</th>
                    <th className="px-3 py-2 text-end font-semibold">Counted</th>
                    <th className="px-3 py-2 text-end font-semibold">Var</th>
                  </tr>
                </thead>
                <tbody>
                  {active.stock_count_lines.map((line) => {
                    const countedQty = Number(counted[line.id] ?? line.system_qty)
                    const variance = countedQty - Number(line.system_qty)
                    return (
                      <tr key={line.id} className="border-t border-line">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-main">{line.items?.name ?? 'Item'}</p>
                          <p className="font-mono text-[10px] text-muted">{line.items?.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-end font-mono">{line.system_qty}</td>
                        <td className="px-3 py-2 text-end">
                          {isDraft ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={counted[line.id] ?? ''}
                              onChange={(event) =>
                                setCounted((current) => ({
                                  ...current,
                                  [line.id]: event.target.value,
                                }))
                              }
                              className="h-9 w-20 rounded-dentaflow border border-line bg-canvas px-2 font-mono"
                            />
                          ) : (
                            <span className="font-mono">{line.counted_qty ?? '—'}</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-end font-mono font-semibold ${
                            variance === 0
                              ? 'text-muted'
                              : variance < 0
                                ? 'text-status-red'
                                : 'text-status-green'
                          }`}
                        >
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {counts.filter((row) => row.status !== 'draft').length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">Recent</p>
            <ul className="divide-y divide-line rounded-dentaflow border border-line text-xs">
              {counts
                .filter((row) => row.status !== 'draft')
                .slice(0, 5)
                .map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                    <span className="font-semibold">{countStatusLabel(row.status)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}
