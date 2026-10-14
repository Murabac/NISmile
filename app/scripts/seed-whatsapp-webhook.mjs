/**
 * Simulate delivery + reply "1" on a queued appointment message (step 22).
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
  .from('notification_log')
  .select('id')
  .contains('payload', { seed: 'SEED-WEBHOOK-REPLY' })
  .limit(1)
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ exists: existing }, null, 2))
  process.exit(0)
}

const { data: queue } = await supabase
  .from('notification_queue')
  .select('id, phone, related_id, status')
  .eq('related_type', 'appointment')
  .in('kind', ['appointment_confirmation', 'appointment_reminder_24h'])
  .in('status', ['pending', 'sent'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (!queue) {
  console.log(JSON.stringify({ skipped: 'no appointment queue row' }, null, 2))
  process.exit(0)
}

const provider = `seed-wamid-${queue.id.slice(0, 8)}`

if (queue.status === 'pending') {
  const { error } = await supabase.rpc('mark_notification_sent', {
    p_queue_id: queue.id,
    p_provider_message_id: provider,
  })
  if (error) throw error
}

const { error: delErr } = await supabase.rpc('apply_whatsapp_delivery_status', {
  p_provider_message_id: provider,
  p_status: 'delivered',
  p_error_message: null,
  p_raw: { seed: 'SEED-WEBHOOK-DELIVERED' },
})
if (delErr) throw delErr

const { data: inbound, error: inErr } = await supabase.rpc('apply_whatsapp_inbound', {
  p_phone: queue.phone,
  p_body: '1',
  p_provider_message_id: `seed-inbound-${queue.id.slice(0, 8)}`,
  p_raw: { seed: 'SEED-WEBHOOK-REPLY' },
})
if (inErr) throw inErr

console.log(
  JSON.stringify({ queue_id: queue.id, appointment_id: queue.related_id, inbound }, null, 2),
)
