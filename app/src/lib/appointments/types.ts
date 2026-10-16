export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type Dentist = {
  user_id: string
  name: string
}

export type Appointment = {
  id: string
  branch_id: string
  customer_id: string
  dentist_id: string
  service_id: string | null
  start_at: string
  end_at: string
  status: AppointmentStatus
  notes: string | null
  sale_id: string | null
  created_at: string
  customer_name: string
  customer_phone: string | null
  customer_language: 'en'
  dentist_name: string
  service_name: string | null
  service_code: string | null
  duration_minutes: number
}

export type CreateAppointmentInput = {
  branchId: string
  customerId: string
  dentistId: string
  startAt: string
  endAt?: string | null
  serviceId?: string | null
  notes?: string | null
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}
