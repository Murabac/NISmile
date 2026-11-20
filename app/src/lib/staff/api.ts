import { supabase } from '../supabase.ts'
import type { StaffRole } from '../database.types.ts'

export type StaffUser = {
  user_id: string
  email: string
  name: string
  /** Name patients see as "Dentist" on WhatsApp (blank = own name for dentists, team for others). */
  display_name: string | null
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
    display_name: row.display_name ?? null,
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

export async function setStaffDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase.rpc('set_staff_display_name', {
    p_user_id: userId,
    p_display_name: displayName.trim(),
  })
  if (error) throw error
}

/** Owner self-service: update staff name + patient display name on own profile. */
export async function updateOwnProfileNames(input: {
  name: string
  displayName: string
}): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not signed in.')

  const name = input.name.trim()
  if (!name) throw new Error('Name is required.')

  const { error } = await supabase
    .from('profiles')
    .update({
      name,
      display_name: input.displayName.trim() ? input.displayName.trim().slice(0, 60) : null,
    })
    .eq('user_id', user.id)
  if (error) throw error
}

export async function updateOwnAuthCredentials(input: {
  email?: string | null
  password?: string | null
}): Promise<{ emailChangePending: boolean }> {
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null
  const password = input.password?.trim() ? input.password : null
  if (!email && !password) return { emailChangePending: false }

  const payload: { email?: string; password?: string } = {}
  if (email) payload.email = email
  if (password) payload.password = password

  const { data, error } = await supabase.auth.updateUser(payload)
  if (error) throw error

  const emailChangePending = Boolean(
    email && data.user?.new_email && data.user.new_email.toLowerCase() !== data.user.email?.toLowerCase(),
  )
  return { emailChangePending }
}

export async function setStaffLoginEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_staff_login_enabled', {
    p_user_id: userId,
    p_enabled: enabled,
  })
  if (error) throw error
}
