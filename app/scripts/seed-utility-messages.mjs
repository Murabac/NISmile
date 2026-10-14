/**
 * Schedule utility WhatsApp queue rows for the seed appointment (step 21).
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

const { data: marked } = await supabase
  .from('notification_queue')
  .select('id')
  .contains('params', { seed: 'SEED-UTILITY-CONFIRM' })
  .limit(1)
  .maybeSingle()

if (marked) {
  console.log(JSON.stringify({ exists: marked }, null, 2))
  process.exit(0)
}

const { data: apt } = await supabase
  .from('appointments')
  .select('id')
  .eq('notes', 'SEED-APPOINTMENT')
  .in('status', ['scheduled', 'confirmed'])
  .order('start_at')
  .limit(1)
  .maybeSingle()

if (!apt) {
  console.log(JSON.stringify({ skipped: 'no seed appointment' }, null, 2))
  process.exit(0)
}

const { error: cancelErr } = await supabase.rpc('cancel_related_notifications', {
  p_related_type: 'appointment',
  p_related_id: apt.id,
})
if (cancelErr) throw cancelErr

const { error: schedErr } = await supabase.rpc('schedule_appointment_utilities', {
  p_appointment_id: apt.id,
  p_include_confirmation: true,
})
if (schedErr) throw schedErr

const { data: conf } = await supabase
  .from('notification_queue')
  .select('id, params')
  .eq('related_type', 'appointment')
  .eq('related_id', apt.id)
  .eq('kind', 'appointment_confirmation')
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (conf) {
  await supabase
    .from('notification_queue')
    .update({ params: { ...(conf.params || {}), seed: 'SEED-UTILITY-CONFIRM' } })
    .eq('id', conf.id)
}

const { count } = await supabase
  .from('notification_queue')
  .select('id', { count: 'exact', head: true })
  .eq('related_type', 'appointment')
  .eq('related_id', apt.id)
  .eq('status', 'pending')

console.log(JSON.stringify({ appointment_id: apt.id, pending: count }, null, 2))
