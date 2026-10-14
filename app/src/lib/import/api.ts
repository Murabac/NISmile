import { supabase } from '../supabase.ts'
import type { ImportKind } from './excel.ts'

export type ImportBatchStatus =
  | 'uploaded'
  | 'validated'
  | 'dry_run'
  | 'confirmed'
  | 'reverted'
  | 'failed'

export type ImportRowStatus = 'pending' | 'ok' | 'error' | 'applied' | 'reverted'

export type ImportRow = {
  id: string
  batch_id: string
  row_number: number
  raw: Record<string, unknown>
  status: ImportRowStatus
  errors: string[]
  created_entity_type: string | null
  created_entity_id: string | null
}

export type ImportBatch = {
  id: string
  branch_id: string | null
  import_type: ImportKind
  status: ImportBatchStatus
  file_name: string | null
  notes: string | null
  created_at: string
  confirmed_at: string | null
  reverted_at: string | null
  import_rows: ImportRow[]
}

export async function fetchImportBatches(branchId: string | 'all') {
  let query = supabase
    .from('import_batches')
    .select(
      `
      id, branch_id, import_type, status, file_name, notes, created_at, confirmed_at, reverted_at,
      import_rows ( id, batch_id, row_number, raw, status, errors, created_entity_type, created_entity_id )
    `,
    )
    .order('created_at', { ascending: false })

  if (branchId !== 'all') {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((batch) => ({
    ...batch,
    import_rows: [...(batch.import_rows ?? [])].sort((a, b) => a.row_number - b.row_number),
  })) as ImportBatch[]
}

export async function createImportBatch(input: {
  kind: ImportKind
  branchId: string | null
  fileName: string
  rows: Record<string, string>[]
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc('create_import_batch', {
    p_import_type: input.kind,
    p_branch_id: input.branchId,
    p_file_name: input.fileName,
    p_rows: input.rows,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function dryRunImport(batchId: string) {
  const { error } = await supabase.rpc('dry_run_import', { p_batch_id: batchId })
  if (error) throw error
}

export async function confirmImport(batchId: string) {
  const { error } = await supabase.rpc('confirm_import', { p_batch_id: batchId })
  if (error) throw error
}

export async function revertImport(batchId: string) {
  const { error } = await supabase.rpc('revert_import', { p_batch_id: batchId })
  if (error) throw error
}

export function batchStatusLabel(status: ImportBatchStatus): string {
  if (status === 'dry_run') return 'Dry run OK'
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'reverted') return 'Reverted'
  if (status === 'failed') return 'Failed'
  if (status === 'validated') return 'Validated'
  return 'Uploaded'
}
