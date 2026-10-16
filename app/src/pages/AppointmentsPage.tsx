import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '../components/Drawer.tsx'
import { useAuth } from '../lib/auth.tsx'
import {
  addDays,
  createAppointment,
  createBranchDentist,
  fetchAppointments,
  fetchDentists,
  rescheduleAppointment,
  setAppointmentStatus,
  startOfWeek,
  toDateKey,
} from '../lib/appointments/api.ts'
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from '../lib/appointments/types.ts'
import { fetchServices } from '../lib/catalog/api.ts'
import { fetchCustomers, saveCustomer } from '../lib/customers/api.ts'

type ViewMode = 'calendar' | 'list'

function statusClass(status: AppointmentStatus) {
  if (status === 'confirmed') return 'bg-flow-teal/15 text-flow-teal'
  if (status === 'completed') return 'bg-status-green/15 text-status-green'
  if (status === 'cancelled' || status === 'no_show') return 'bg-status-red/15 text-status-red'
  return 'bg-status-amber/15 text-status-amber'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AppointmentsPage() {
  const { branchId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [dentistFilter, setDentistFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [patientId, setPatientId] = useState('')
  const [dentistId, setDentistId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const [time, setTime] = useState('10:00')
  const [notes, setNotes] = useState('')

  const [addingPatient, setAddingPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [addingDentist, setAddingDentist] = useState(false)
  const [newDentistName, setNewDentistName] = useState('')
  const [newDentistEmail, setNewDentistEmail] = useState('')
  const [newDentistPassword, setNewDentistPassword] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [info, setInfo] = useState<string | null>(null)

  const weekStart = weekAnchor
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const rangeStart = weekStart.toISOString()
  const rangeEnd = addDays(weekStart, 7).toISOString()

  const dentistsQuery = useQuery({
    queryKey: ['dentists', branchId],
    queryFn: () => fetchDentists(branchId),
    enabled: branchId !== 'all',
  })

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', branchId, rangeStart, rangeEnd],
    queryFn: () => fetchAppointments(branchId, rangeStart, rangeEnd),
    enabled: branchId !== 'all',
  })

  const patientsQuery = useQuery({
    queryKey: ['customers', branchId],
    queryFn: () => fetchCustomers(branchId),
    enabled: bookingOpen && branchId !== 'all',
  })

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    enabled: bookingOpen || Boolean(selected),
  })

  const dentists = dentistsQuery.data ?? []
  const appointments = (appointmentsQuery.data ?? []).filter(
    (apt) => dentistFilter === 'all' || apt.dentist_id === dentistFilter,
  )
  const patients = (patientsQuery.data ?? []).filter((c) => c.customer_type === 'retail')
  const services = (servicesQuery.data ?? []).filter((s) => s.active)

  useEffect(() => {
    if (!bookingOpen) return
    if (!patientId && patients[0]) setPatientId(patients[0].id)
    if (!dentistId && dentists[0]) setDentistId(dentists[0].user_id)
    if (!serviceId && services[0]) setServiceId(services[0].id)
  }, [bookingOpen, patients, dentists, services, patientId, dentistId, serviceId])

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error('Select a patient')
      if (!dentistId) throw new Error('Select a dentist')
      const startAt = new Date(`${date}T${time}:00`)
      if (Number.isNaN(startAt.getTime())) throw new Error('Invalid date/time')
      return createAppointment({
        branchId,
        customerId: patientId,
        dentistId,
        startAt: startAt.toISOString(),
        serviceId: serviceId || null,
        notes: notes.trim() || null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      setBookingOpen(false)
      setNotes('')
      setError(null)
      setInfo('Booked. Confirmation and reminders queued when the patient is opted in.')
    },
    onError: (err: Error) => setError(err.message),
  })

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No appointment')
      const startAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`)
      if (Number.isNaN(startAt.getTime())) throw new Error('Invalid date/time')
      return rescheduleAppointment({
        appointmentId: selected.id,
        startAt: startAt.toISOString(),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      setSelected(null)
      setError(null)
      setInfo('Rescheduled. Notice and new reminders queued when opted in.')
    },
    onError: (err: Error) => setError(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: Exclude<AppointmentStatus, 'completed'>
    }) => setAppointmentStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      await queryClient.invalidateQueries({ queryKey: ['notification_queue'] })
      setSelected(null)
      setError(null)
      setInfo('Status updated. Cancel/reopen notifications queued when applicable.')
    },
    onError: (err: Error) => setError(err.message),
  })

  function checkoutInPos(apt: Appointment) {
    const params = new URLSearchParams({
      appointment: apt.id,
      customer: apt.customer_id,
    })
    if (apt.service_id) params.set('service', apt.service_id)
    setSelected(null)
    navigate(`/pos?${params.toString()}`)
  }

  const addPatientMutation = useMutation({
    mutationFn: async () => {
      if (branchId === 'all') throw new Error('Choose a branch first')
      if (!newPatientName.trim()) throw new Error('Patient name is required')
      return saveCustomer(branchId, {
        name: newPatientName.trim(),
        phone: newPatientPhone.trim() || null,
        customer_type: 'retail',
        subtype: null,
        language: 'en',
        whatsapp_opt_in: Boolean(newPatientPhone.trim()),
        credit_limit: null,
        notes: null,
      })
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['customers', branchId] })
      setPatientId(id)
      setAddingPatient(false)
      setNewPatientName('')
      setNewPatientPhone('')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  const addDentistMutation = useMutation({
    mutationFn: async () => {
      if (branchId === 'all') throw new Error('Choose a branch first')
      if (!newDentistName.trim()) throw new Error('Dentist name is required')
      if (!newDentistEmail.trim()) throw new Error('Dentist email is required')
      return createBranchDentist({
        branchId,
        name: newDentistName.trim(),
        email: newDentistEmail.trim(),
        password: newDentistPassword.trim() || null,
      })
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['dentists', branchId] })
      setDentistId(id)
      setAddingDentist(false)
      setNewDentistName('')
      setNewDentistEmail('')
      setNewDentistPassword('')
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  function openBooking() {
    setError(null)
    setPatientId(patients[0]?.id ?? '')
    setDentistId(dentists[0]?.user_id ?? '')
    setServiceId(services[0]?.id ?? '')
    setDate(toDateKey(new Date()))
    setTime('10:00')
    setNotes('')
    setAddingPatient(false)
    setAddingDentist(false)
    setNewPatientName('')
    setNewPatientPhone('')
    setNewDentistName('')
    setNewDentistEmail('')
    setNewDentistPassword('')
    setBookingOpen(true)
  }

  if (branchId === 'all') {
    return (
      <section className="rounded-dentaflow border border-line bg-surface p-6">
        <h1 className="text-3xl font-semibold">Appointments</h1>
        <p className="mt-3 max-w-xl text-muted">
          Choose one branch in the header to manage the patient calendar.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-3xl font-semibold">Appointments</h1>
          <p className="mt-1 text-sm text-muted">
            Retail patients, dentist calendar, and visit status. WhatsApp reminders come next.
          </p>
        </div>
        <button
          type="button"
          onClick={openBooking}
          className="inline-flex h-10 items-center gap-2 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" />
          Book appointment
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-dentaflow border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Dentist
          <select
            value={dentistFilter}
            onChange={(event) => setDentistFilter(event.target.value)}
            className="h-9 rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          >
            <option value="all">All clinicians</option>
            {dentists.map((d) => (
              <option key={d.user_id} value={d.user_id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-canvas p-1">
            <button
              type="button"
              onClick={() => setWeekAnchor(addDays(weekStart, -7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-mono text-xs font-bold">
              {toDateKey(weekDays[0]!)} – {toDateKey(weekDays[4]!)}
            </span>
            <button
              type="button"
              onClick={() => setWeekAnchor(addDays(weekStart, 7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(startOfWeek(new Date()))}
              className="rounded-md px-2 py-1 text-xs font-bold text-flow-teal"
            >
              Today
            </button>
          </div>

          <div className="inline-flex rounded-lg bg-canvas p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                viewMode === 'calendar' ? 'bg-surface shadow-sm' : 'text-muted'
              }`}
            >
              Week calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                viewMode === 'list' ? 'bg-surface shadow-sm' : 'text-muted'
              }`}
            >
              List ({appointments.length})
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}
      {info ? <p className="text-sm text-flow-teal">{info}</p> : null}

      {appointmentsQuery.isLoading ? (
        <p className="text-sm text-muted">Loading appointments…</p>
      ) : appointmentsQuery.isError ? (
        <p className="text-sm text-status-red">{(appointmentsQuery.error as Error).message}</p>
      ) : viewMode === 'calendar' ? (
        <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
          <div className="grid grid-cols-5 divide-x divide-line border-b border-line bg-canvas">
            {weekDays.map((day) => {
              const key = toDateKey(day)
              const isToday = key === toDateKey(new Date())
              return (
                <div key={key} className="p-3 text-center">
                  <p className={`text-xs font-bold ${isToday ? 'text-flow-teal' : ''}`}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    {isToday ? ' · Today' : ''}
                  </p>
                  <p className="font-mono text-[11px] text-muted">{key}</p>
                </div>
              )
            })}
          </div>
          <div className="grid min-h-[420px] grid-cols-5 divide-x divide-line">
            {weekDays.map((day) => {
              const key = toDateKey(day)
              const dayApts = appointments.filter((a) => toDateKey(new Date(a.start_at)) === key)
              return (
                <div key={key} className="space-y-2 p-2">
                  {dayApts.length === 0 ? (
                    <p className="py-10 text-center text-[11px] text-muted italic">No bookings</p>
                  ) : (
                    dayApts.map((apt) => (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => {
                          setError(null)
                          setInfo(null)
                          setSelected(apt)
                          setRescheduleDate(toDateKey(new Date(apt.start_at)))
                          setRescheduleTime(
                            new Date(apt.start_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            }),
                          )
                        }}
                        className="w-full space-y-1.5 rounded-lg border border-line bg-canvas/80 p-3 text-start hover:border-flow-teal"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[11px] font-bold text-marine">
                            {formatTime(apt.start_at)}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusClass(apt.status)}`}
                          >
                            {APPOINTMENT_STATUS_LABELS[apt.status]}
                          </span>
                        </div>
                        <p className="text-xs font-bold leading-snug">{apt.customer_name}</p>
                        <p className="line-clamp-1 text-[11px] text-muted">
                          {apt.service_name ?? 'No service'}
                        </p>
                        <p className="text-[10px] text-muted">{apt.dentist_name}</p>
                        <p className="border-t border-line pt-1.5 text-[10px] text-muted">
                          Checkout in POS when the visit ends
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-dentaflow border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-[10px] tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">Dentist</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                    No appointments this week.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr
                    key={apt.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas/60"
                    onClick={() => {
                      setError(null)
                      setInfo(null)
                      setSelected(apt)
                      setRescheduleDate(toDateKey(new Date(apt.start_at)))
                      setRescheduleTime(
                        new Date(apt.start_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        }),
                      )
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-marine">
                      {toDateKey(new Date(apt.start_at))} {formatTime(apt.start_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{apt.customer_name}</p>
                      <p className="font-mono text-[11px] text-muted">{apt.customer_phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{apt.dentist_name}</td>
                    <td className="px-4 py-3 text-sm text-muted">{apt.service_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(apt.status)}`}
                      >
                        {APPOINTMENT_STATUS_LABELS[apt.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title="Book appointment"
        subtitle="Retail patient · WhatsApp notices use English Meta templates."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBookingOpen(false)}
              className="h-10 rounded-dentaflow border border-line px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bookMutation.isPending}
              onClick={() => {
                setError(null)
                bookMutation.mutate()
              }}
              className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {bookMutation.isPending ? 'Saving…' : 'Confirm booking'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold">Patient</label>
              <button
                type="button"
                onClick={() => {
                  setAddingPatient((open) => !open)
                  setError(null)
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-flow-teal"
              >
                {addingPatient ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {addingPatient ? 'Cancel' : 'Add patient'}
              </button>
            </div>
            {addingPatient ? (
              <div className="mt-2 space-y-2 rounded-dentaflow border border-line bg-canvas p-3">
                <label className="block text-xs font-semibold">
                  Full name
                  <input
                    value={newPatientName}
                    onChange={(event) => setNewPatientName(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-normal"
                    placeholder="Ayaan Abdi Mohamed"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  WhatsApp phone
                  <input
                    value={newPatientPhone}
                    onChange={(event) => setNewPatientPhone(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono font-normal"
                    placeholder="+25263…"
                  />
                </label>
                <button
                  type="button"
                  disabled={addPatientMutation.isPending}
                  onClick={() => {
                    setError(null)
                    addPatientMutation.mutate()
                  }}
                  className="h-9 w-full rounded-dentaflow bg-marine text-xs font-bold text-white disabled:opacity-60"
                >
                  {addPatientMutation.isPending ? 'Saving…' : 'Save patient'}
                </button>
              </div>
            ) : (
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-semibold">Dentist</label>
              <button
                type="button"
                onClick={() => {
                  setAddingDentist((open) => !open)
                  setError(null)
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-flow-teal"
              >
                {addingDentist ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {addingDentist ? 'Cancel' : 'Add dentist'}
              </button>
            </div>
            {addingDentist ? (
              <div className="mt-2 space-y-2 rounded-dentaflow border border-line bg-canvas p-3">
                <label className="block text-xs font-semibold">
                  Full name
                  <input
                    value={newDentistName}
                    onChange={(event) => setNewDentistName(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-normal"
                    placeholder="Dr. Sahra Awale"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Login email
                  <input
                    type="email"
                    value={newDentistEmail}
                    onChange={(event) => setNewDentistEmail(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-normal"
                    placeholder="dentist@nismile.local"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Temporary password
                  <input
                    type="text"
                    value={newDentistPassword}
                    onChange={(event) => setNewDentistPassword(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-mono font-normal"
                    placeholder="Defaults to dentaflow-demo"
                  />
                </label>
                <p className="text-[11px] text-muted">
                  Creates a staff login with role Dentist on this branch.
                </p>
                <button
                  type="button"
                  disabled={addDentistMutation.isPending}
                  onClick={() => {
                    setError(null)
                    addDentistMutation.mutate()
                  }}
                  className="h-9 w-full rounded-dentaflow bg-marine text-xs font-bold text-white disabled:opacity-60"
                >
                  {addDentistMutation.isPending ? 'Creating…' : 'Save dentist'}
                </button>
              </div>
            ) : (
              <select
                value={dentistId}
                onChange={(event) => setDentistId(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              >
                <option value="">Select dentist…</option>
                {dentists.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="block text-sm font-semibold">
            Service
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            >
              <option value="">Optional…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                  {s.duration_minutes ? ` · ${s.duration_minutes}m` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Time
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-dentaflow border border-line bg-canvas px-3 py-2 font-normal"
              placeholder="Visit notes (not a clinical chart)"
            />
          </label>
        </div>
      </Drawer>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.customer_name ?? 'Appointment'}
        subtitle={
          selected
            ? `${toDateKey(new Date(selected.start_at))} · ${formatTime(selected.start_at)} · ${selected.dentist_name}`
            : undefined
        }
        footer={
          selected && selected.status !== 'completed' ? (
            <div className="flex flex-wrap justify-end gap-2">
              {selected.status === 'scheduled' ? (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: selected.id, status: 'confirmed' })
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-dentaflow border border-line px-3 text-sm font-semibold"
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirm
                </button>
              ) : null}
              {selected.status !== 'cancelled' && selected.status !== 'no_show' ? (
                <>
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ id: selected.id, status: 'no_show' })
                    }
                    className="h-10 rounded-dentaflow border border-line px-3 text-sm font-semibold"
                  >
                    No-show
                  </button>
                  <button
                    type="button"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ id: selected.id, status: 'cancelled' })
                    }
                    className="h-10 rounded-dentaflow border border-line px-3 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => checkoutInPos(selected)}
                    className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
                  >
                    Checkout in POS
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: selected.id, status: 'scheduled' })
                  }
                  className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white"
                >
                  Reopen as scheduled
                </button>
              )}
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <User className="h-4 w-4" />
              {selected.customer_phone ?? 'No phone'}
            </div>
            <div className="flex items-center gap-2 text-muted">
              <CalendarDays className="h-4 w-4" />
              {selected.service_name ?? 'No service linked'} · {selected.duration_minutes} min
            </div>
            <p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(selected.status)}`}
              >
                {APPOINTMENT_STATUS_LABELS[selected.status]}
              </span>
            </p>
            {selected.notes ? (
              <p className="rounded-dentaflow bg-canvas px-3 py-2 text-xs text-muted">
                {selected.notes}
              </p>
            ) : null}
            {selected.sale_id ? (
              <p className="text-xs text-status-green">Sale linked · {selected.sale_id.slice(0, 8)}…</p>
            ) : null}
            {!selected.service_id &&
            (selected.status === 'scheduled' || selected.status === 'confirmed') ? (
              <p className="text-xs text-status-amber">
                No service linked at booking. POS will open with the patient; add services
                there.
              </p>
            ) : null}

            {selected.status === 'scheduled' || selected.status === 'confirmed' ? (
              <div className="space-y-2 rounded-dentaflow border border-line bg-canvas p-3">
                <p className="text-xs font-bold">Reschedule</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] font-semibold">
                    Date
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-normal"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold">
                    Time
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(event) => setRescheduleTime(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 font-normal"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={rescheduleMutation.isPending}
                  onClick={() => {
                    setError(null)
                    rescheduleMutation.mutate()
                  }}
                  className="h-9 w-full rounded-dentaflow border border-line text-xs font-bold disabled:opacity-60"
                >
                  {rescheduleMutation.isPending ? 'Saving…' : 'Save new time + notify'}
                </button>
              </div>
            ) : null}

            <p className="text-[11px] text-muted">
              Opted-in patients get English confirmation, 24h/2h reminders, and
              cancel/reschedule notices in the WhatsApp queue.
            </p>
          </div>
        ) : null}
      </Drawer>
    </section>
  )
}
