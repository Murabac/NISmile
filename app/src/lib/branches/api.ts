import { supabase } from '../supabase.ts'
import type { Branch, BranchInput, DeleteBranchResult } from './types.ts'

const BRANCH_COLS =
  'id, name, region, address, phone, tax_id, zaad, edahab, mycash, active, created_at' as const

export async function fetchBranches(includeInactive = true): Promise<Branch[]> {
  let query = supabase.from('branches').select(BRANCH_COLS).order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(normalizeBranch)
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .insert({
      name: input.name.trim(),
      region: input.region,
      address: emptyToNull(input.address),
      phone: emptyToNull(input.phone),
      tax_id: emptyToNull(input.tax_id),
      zaad: emptyToNull(input.zaad),
      edahab: emptyToNull(input.edahab),
      mycash: emptyToNull(input.mycash),
      active: true,
    })
    .select(BRANCH_COLS)
    .single()
  if (error) throw error
  return normalizeBranch(data)
}

export async function updateBranch(id: string, input: BranchInput & { active?: boolean }): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .update({
      name: input.name.trim(),
      region: input.region,
      address: emptyToNull(input.address),
      phone: emptyToNull(input.phone),
      tax_id: emptyToNull(input.tax_id),
      zaad: emptyToNull(input.zaad),
      edahab: emptyToNull(input.edahab),
      mycash: emptyToNull(input.mycash),
      ...(input.active != null ? { active: input.active } : {}),
    })
    .eq('id', id)
    .select(BRANCH_COLS)
    .single()
  if (error) throw error
  return normalizeBranch(data)
}

export async function setBranchActive(id: string, active: boolean): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .update({ active })
    .eq('id', id)
    .select(BRANCH_COLS)
    .single()
  if (error) throw error
  return normalizeBranch(data)
}

function normalizeBranch(row: unknown): Branch {
  const r = row as Branch
  return {
    ...r,
    region: r.region === 'ethiopia' ? 'ethiopia' : 'somaliland',
  }
}

export async function deleteBranch(id: string): Promise<DeleteBranchResult> {
  const { data, error } = await supabase.rpc('delete_branch', { p_branch_id: id })
  if (error) throw error
  return data as DeleteBranchResult
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
