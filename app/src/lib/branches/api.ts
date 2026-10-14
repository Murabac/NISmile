import { supabase } from '../supabase.ts'
import type { Branch, BranchInput, DeleteBranchResult } from './types.ts'

export async function fetchBranches(includeInactive = true): Promise<Branch[]> {
  let query = supabase
    .from('branches')
    .select('id, name, address, phone, tax_id, zaad, edahab, mycash, active, created_at')
    .order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Branch[]
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .insert({
      name: input.name.trim(),
      address: emptyToNull(input.address),
      phone: emptyToNull(input.phone),
      tax_id: emptyToNull(input.tax_id),
      zaad: emptyToNull(input.zaad),
      edahab: emptyToNull(input.edahab),
      mycash: emptyToNull(input.mycash),
      active: true,
    })
    .select('id, name, address, phone, tax_id, zaad, edahab, mycash, active, created_at')
    .single()
  if (error) throw error
  return data as Branch
}

export async function updateBranch(id: string, input: BranchInput & { active?: boolean }): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .update({
      name: input.name.trim(),
      address: emptyToNull(input.address),
      phone: emptyToNull(input.phone),
      tax_id: emptyToNull(input.tax_id),
      zaad: emptyToNull(input.zaad),
      edahab: emptyToNull(input.edahab),
      mycash: emptyToNull(input.mycash),
      ...(input.active != null ? { active: input.active } : {}),
    })
    .eq('id', id)
    .select('id, name, address, phone, tax_id, zaad, edahab, mycash, active, created_at')
    .single()
  if (error) throw error
  return data as Branch
}

export async function setBranchActive(id: string, active: boolean): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .update({ active })
    .eq('id', id)
    .select('id, name, address, phone, tax_id, zaad, edahab, mycash, active, created_at')
    .single()
  if (error) throw error
  return data as Branch
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
