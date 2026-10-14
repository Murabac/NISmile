import { supabase } from '../supabase.ts'
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  Dentist,
} from './types.ts'

const appointmentSelect = `
  id, branch_id, customer_id, dentist_id, service_id,
  start_at, end_at, status, notes, sale_id, created_at,
  customers ( name, phone, language ),
  profiles!dentist_id ( name ),
  services ( name, code, duration_minutes )
`

function normalizeAppointment(row: Record<string, unknown>): Appointment {
  const customer = row.customers as
    | { name: string; phone: string | null; language: 'so' | 'ar' }
    | null
  const dentist = row.profiles as { name: string } | null
  const service = row.services as
    | { name: string; code: string; duration_minutes: number | null }
    | null
  const start = new Date(row.start_at as string)
  const end = new Date(row.end_at as string)
  const duration = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 60_000),
  )

  return {
    id: row.id as string,
    branch_id: row.branch_id as string,
    customer_id: row.customer_id as string,
    dentist_id: row.dentist_id as string,
    service_id: (row.service_id as string | null) ?? null,
    start_at: row.start_at as string,
    end_at: row.end_at as string,
    status: row.status as AppointmentStatus,
    notes: (row.notes as string | null) ?? null,
    sale_id: (row.sale_id as string | null) ?? null,
    created_at: row.created_at as string,
    customer_name: customer?.name ?? 'Patient',
    customer_phone: customer?.phone ?? null,
    customer_language: customer?.language ?? 'so',
    dentist_name: dentist?.name ?? 'Dentist',
    service_name: service?.name ?? null,
    service_code: service?.code ?? null,
    duration_minutes: service?.duration_minutes ?? duration,
  }
}

export async function fetchDentists(branchId: string): Promise<Dentist[]> {
  const { data: links, error: linkErr } = await supabase
    .from('user_branches')
    .select('user_id')
    .eq('branch_id', branchId)
  if (linkErr) throw linkErr

  const ids = (links ?? []).map((row) => row.user_id as string)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, role')
    .in('user_id', ids)
    .in('role', ['dentist', 'owner'])
    .order('name')
  if (error) throw error

  const dentists = (data ?? []).filter((row) => row.role === 'dentist')
  if (dentists.length > 0) {
    return dentists.map((row) => ({
      user_id: row.user_id as string,
      name: row.name as string,
    }))
  }

  // Fallback: owners can appear as clinicians when no dentist is assigned.
  return (data ?? [])
    .filter((row) => row.role === 'owner')
    .map((row) => ({
      user_id: row.user_id as string,
      name: row.name as string,
    }))
}

export async function fetchAppointments(
  branchId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(appointmentSelect)
    .eq('branch_id', branchId)
    .gte('start_at', rangeStart)
    .lt('start_at', rangeEnd)
    .order('start_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => normalizeAppointment(row as Record<string, unknown>))
}

export async function createBranchDentist(input: {
  branchId: string
  name: string
  email: string
  password?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_branch_dentist', {
    p_branch_id: input.branchId,
    p_name: input.name,
    p_email: input.email,
    p_password: input.password?.trim() ? input.password.trim() : null,
  })
  if (error) throw error
  return data as string
}

export async function createAppointment(input: CreateAppointmentInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_appointment', {
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_dentist_id: input.dentistId,
    p_start_at: input.startAt,
    p_end_at: input.endAt ?? null,
    p_service_id: input.serviceId ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: Exclude<AppointmentStatus, 'completed'>,
): Promise<void> {
  const { error } = await supabase.rpc('set_appointment_status', {
    p_appointment_id: appointmentId,
    p_status: status,
  })
  if (error) throw error
}

export async function completeAppointment(
  appointmentId: string,
  options?: {
    serviceId?: string | null
    notes?: string | null
  },
): Promise<string> {
  const lines =
    options?.serviceId != null
      ? [{ line_type: 'service', service_id: options.serviceId, qty: 1 }]
      : null

  const { data, error } = await supabase.rpc('complete_appointment', {
    p_appointment_id: appointmentId,
    p_lines: lines,
    p_payments: null,
    p_notes: options?.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
