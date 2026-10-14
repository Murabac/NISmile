import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Upload,
  Users,
} from 'lucide-react'
import { useAuth } from '../lib/auth.tsx'
import {
  batchStatusLabel,
  confirmImport,
  createImportBatch,
  dryRunImport,
  fetchImportBatches,
  revertImport,
  type ImportBatch,
} from '../lib/import/api.ts'
import { downloadTemplate, parseExcel, type ImportKind } from '../lib/import/excel.ts'

export function ImportPage() {
  const { branchId } = useAuth()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<ImportKind>('items')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const needsBranch = kind === 'customers' || kind === 'opening_stock'

  if (needsBranch && branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Import</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header before importing customers or opening stock.
        </p>
      </section>
    )
  }

  const batchesQuery = useQuery({
    queryKey: ['import_batches', branchId],
    queryFn: () => fetchImportBatches(branchId),
  })

  const activeBatch = useMemo(
    () => (batchesQuery.data ?? []).find((batch) => batch.id === activeBatchId) ?? null,
    [batchesQuery.data, activeBatchId],
  )

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['import_batches'] })
    await queryClient.invalidateQueries({ queryKey: ['items'] })
    await queryClient.invalidateQueries({ queryKey: ['stock_summaries'] })
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const rows = await parseExcel(file)
      if (rows.length === 0) throw new Error('Excel file has no data rows.')
      return createImportBatch({
        kind,
        branchId: needsBranch ? (branchId as string) : null,
        fileName: file.name,
        rows,
      })
    },
    onSuccess: async (id) => {
      setActiveBatchId(id)
      setStep(3)
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const dryRunMutation = useMutation({
    mutationFn: () => dryRunImport(activeBatchId!),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmImport(activeBatchId!),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const revertMutation = useMutation({
    mutationFn: (id: string) => revertImport(id),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (err: Error) => setError(err.message),
  })

  const errorRows = (activeBatch?.import_rows ?? []).filter((row) => row.status === 'error')
  const okRows = (activeBatch?.import_rows ?? []).filter(
    (row) => row.status === 'ok' || row.status === 'applied',
  )

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Import</h1>
        <p className="mt-1 text-sm text-muted">
          Template → upload → validate → dry run → confirm. Revert while sales have not used the
          rows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { num: 1 as const, title: '1. Template', desc: 'Download Excel schema' },
          { num: 2 as const, title: '2. Upload', desc: 'Parse into staging' },
          { num: 3 as const, title: '3. Review', desc: 'Dry run and confirm' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`rounded-dentaflow border p-3.5 text-start ${
              step === s.num
                ? 'border-flow-teal bg-surface ring-2 ring-flow-teal/20'
                : 'border-line bg-subtle/40'
            }`}
          >
            <p className="text-sm font-bold">{s.title}</p>
            <p className="text-[11px] text-muted">{s.desc}</p>
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}

      {step === 1 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TemplateCard
            icon={<Boxes className="h-7 w-7 text-flow-teal" />}
            title="Items & prices"
            body="SKU, name, category, unit, cost, reorder, retail and wholesale prices."
            onDownload={() => {
              setKind('items')
              downloadTemplate('items')
              setStep(2)
            }}
          />
          <TemplateCard
            icon={<Users className="h-7 w-7 text-flow-teal" />}
            title="Customers"
            body="Name, retail/wholesale, phone (+252), WhatsApp language so/ar/en, credit limit."
            onDownload={() => {
              setKind('customers')
              downloadTemplate('customers')
              setStep(2)
            }}
          />
          <TemplateCard
            icon={<Database className="h-7 w-7 text-flow-teal" />}
            title="Opening stock"
            body="SKU, batch, expiry, quantity, unit cost. Use legacy=Y when expiry is unknown."
            onDownload={() => {
              setKind('opening_stock')
              downloadTemplate('opening_stock')
              setStep(2)
            }}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4 rounded-dentaflow border border-line bg-surface p-5">
          <p className="text-sm font-semibold">
            Upload {kind.replace('_', ' ')} Excel
            {needsBranch ? ' for the selected branch' : ' (shared catalog)'}
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-dentaflow border border-dashed border-line bg-canvas px-4 py-10 text-sm">
            <Upload className="h-6 w-6 text-flow-teal" />
            <span className="font-semibold">
              {uploadMutation.isPending ? 'Uploading…' : 'Choose Excel file'}
            </span>
            <span className="text-xs text-muted">
              {fileName ?? '.xlsx with header row on the first sheet'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              disabled={uploadMutation.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                setError(null)
                uploadMutation.mutate(file)
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm font-semibold text-flow-teal"
          >
            Back to templates
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {!activeBatch ? (
            <p className="text-sm text-muted">Upload an Excel file to review validation results.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-dentaflow border border-line bg-surface px-4 py-3">
                <div>
                  <p className="font-mono text-xs font-semibold">{activeBatch.file_name}</p>
                  <p className="text-xs text-muted">
                    {activeBatch.import_type} · {batchStatusLabel(activeBatch.status)} ·{' '}
                    {okRows.length} ok · {errorRows.length} errors
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeBatch.status === 'validated' || activeBatch.status === 'failed' ? (
                    <button
                      type="button"
                      disabled={dryRunMutation.isPending || errorRows.length > 0}
                      onClick={() => dryRunMutation.mutate()}
                      className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      {dryRunMutation.isPending ? 'Checking…' : 'Dry run'}
                    </button>
                  ) : null}
                  {activeBatch.status === 'dry_run' ? (
                    <button
                      type="button"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate()}
                      className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {confirmMutation.isPending ? 'Confirming…' : 'Confirm import'}
                    </button>
                  ) : null}
                  {activeBatch.status === 'confirmed' ? (
                    <button
                      type="button"
                      disabled={revertMutation.isPending}
                      onClick={() => revertMutation.mutate(activeBatch.id)}
                      className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold disabled:opacity-60"
                    >
                      {revertMutation.isPending ? 'Reverting…' : 'Revert'}
                    </button>
                  ) : null}
                </div>
              </div>

              {errorRows.length > 0 ? (
                <div className="overflow-x-auto rounded-dentaflow border border-status-red/40 bg-surface">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-subtle text-[10px] tracking-wide text-muted uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Row</th>
                        <th className="px-3 py-2 font-semibold">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((row) => (
                        <tr key={row.id} className="border-t border-line">
                          <td className="px-3 py-2 font-mono">{row.row_number}</td>
                          <td className="px-3 py-2 text-status-red">
                            <span className="inline-flex items-start gap-1">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {row.errors.join('; ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-status-green">
                  <CheckCircle2 className="h-4 w-4" />
                  All {okRows.length} rows passed validation.
                </p>
              )}
            </>
          )}

          <ImportHistory
            batches={batchesQuery.data ?? []}
            activeId={activeBatchId}
            onSelect={(batch) => {
              setActiveBatchId(batch.id)
              setKind(batch.import_type)
              setStep(3)
            }}
            onRevert={(id) => revertMutation.mutate(id)}
          />
        </div>
      ) : null}
    </section>
  )
}

function TemplateCard({
  icon,
  title,
  body,
  onDownload,
}: {
  icon: ReactNode
  title: string
  body: string
  onDownload: () => void
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-dentaflow border border-line bg-surface p-5">
      <div>
        {icon}
        <h2 className="mt-2 text-sm font-bold">{title}</h2>
        <p className="mt-1 text-xs text-muted">{body}</p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-dentaflow bg-marine px-3 text-xs font-bold text-white"
      >
        <Download className="h-3.5 w-3.5" />
        Download Excel template
      </button>
    </div>
  )
}

function ImportHistory({
  batches,
  activeId,
  onSelect,
  onRevert,
}: {
  batches: ImportBatch[]
  activeId: string | null
  onSelect: (batch: ImportBatch) => void
  onRevert: (id: string) => void
}) {
  if (batches.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-dentaflow border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileSpreadsheet className="h-4 w-4 text-flow-teal" />
        <h2 className="text-sm font-bold">Import history</h2>
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-subtle text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">File</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">When</th>
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr
              key={batch.id}
              className={`border-t border-line ${activeId === batch.id ? 'bg-flow-teal/5' : ''}`}
            >
              <td className="px-4 py-3 font-mono text-xs">{batch.file_name ?? '—'}</td>
              <td className="px-4 py-3 capitalize">{batch.import_type.replace('_', ' ')}</td>
              <td className="px-4 py-3">{batchStatusLabel(batch.status)}</td>
              <td className="px-4 py-3 text-xs text-muted">
                {new Date(batch.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(batch)}
                    className="text-sm font-semibold text-flow-teal"
                  >
                    Open
                  </button>
                  {batch.status === 'confirmed' ? (
                    <button
                      type="button"
                      onClick={() => onRevert(batch.id)}
                      className="text-sm font-semibold text-muted"
                    >
                      Revert
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
