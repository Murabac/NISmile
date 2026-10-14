/**
 * Sample retail patient + appointments for step 19.
 * Requires migration 20261014110000_dental_appointments.sql.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envText = readFileSync(resolve(root, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'dental' },
})

const { data: existing } = await supabase
  .from('appointments')
  .select('id')
  .eq('notes', 'SEED-APPOINTMENT')
  .limit(1)
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ exists: existing }, null, 2))
  process.exit(0)
}

const { data: branch } = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (!branch) throw new Error('No branch')

let { data: dentist } = await supabase
  .from('profiles')
  .select('user_id, name')
  .eq('role', 'dentist')
  .order('created_at')
  .limit(1)
  .maybeSingle()

if (!dentist) {
  const { data: owner } = await supabase
    .from('profiles')
    .select('user_id, name')
    .eq('role', 'owner')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  dentist = owner
}
if (!dentist) throw new Error('No dentist/owner profile')

let { data: service } = await supabase
  .from('services')
  .select('id, duration_minutes')
  .eq('code', 'SRV-002')
  .eq('active', true)
  .maybeSingle()

if (!service) {
  const { data: anyService } = await supabase
    .from('services')
    .select('id, duration_minutes')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  service = anyService
}
if (!service) throw new Error('No active service')

const duration = service.duration_minutes || 45

let { data: patient } = await supabase
  .from('customers')
  .select('id')
  .eq('notes', 'SEED-APPOINTMENT-PATIENT')
  .maybeSingle()

if (!patient) {
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      branch_id: branch.id,
      name: 'Ayaan Abdi Mohamed',
      phone: '+252634819201',
      customer_type: 'retail',
      language: 'so',
      whatsapp_opt_in: true,
      notes: 'SEED-APPOINTMENT-PATIENT',
    })
    .select('id')
    .single()
  if (error) throw error
  patient = created
}

function slot(dayOffset, timeHHmm, status) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + dayOffset)
  const [hh, mm] = timeHHmm.split(':').map(Number)
  start.setHours(hh, mm, 0, 0)
  const end = new Date(start.getTime() + duration * 60_000)
  return {
    branch_id: branch.id,
    customer_id: patient.id,
    dentist_id: dentist.user_id,
    service_id: service.id,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    status,
    notes: 'SEED-APPOINTMENT',
    created_by: dentist.user_id,
  }
}

const { data, error } = await supabase
  .from('appointments')
  .insert([slot(0, '15:00', 'confirmed'), slot(1, '10:30', 'scheduled')])
  .select('id, start_at, status')
if (error) throw error

console.log(JSON.stringify({ appointments: data, dentist: dentist.name }, null, 2))
