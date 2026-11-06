import { supabase } from '../supabase.ts'
import type { StaffRole } from '../database.types.ts'

export type StaffUser = {
  user_id: string
  email: string
  name: string
  role: StaffRole
  branch_ids: string[]
  banned: boolean
}

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'branch_manager', label: 'Branch manager' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'storekeeper', label: 'Storekeeper' },
]

export async function listStaffUsers(): Promise<StaffUser[]> {
  const { data, error } = await supabase.rpc('list_staff_users')
  if (error) throw error
  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    branch_ids: row.branch_ids ?? [],
    banned: Boolean(row.banned),
  }))
}

export async function createStaffUser(input: {
  name: string
  email: string
  password: string
  role: StaffRole
  branchIds: string[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_staff_user', {
    p_name: input.name.trim(),
    p_email: input.email.trim(),
    p_password: input.password,
    p_role: input.role,
    p_branch_ids: input.branchIds,
  })
  if (error) throw error
  return data as string
}

export async function updateStaffUser(input: {
  userId: string
  name: string
  role: StaffRole
  branchIds: string[]
  email?: string | null
  password?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('update_staff_user', {
    p_user_id: input.userId,
    p_name: input.name.trim(),
    p_role: input.role,
    p_branch_ids: input.branchIds,
    p_email: input.email?.trim() ? input.email.trim() : null,
    p_password: input.password?.trim() ? input.password : null,
  })
  if (error) throw error
}

export async function setStaffLoginEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_staff_login_enabled', {
    p_user_id: userId,
    p_enabled: enabled,
  })
  if (error) throw error
}
