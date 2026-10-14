/**
 * Schedule the newest pending queue row for immediate Cloud API send testing.
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

const { data: row, error } = await supabase
  .from('notification_queue')
  .select('id, phone, status, kind')
  .in('status', ['pending', 'failed'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (error) {
  console.error(error)
  process.exit(1)
}
if (!row) {
  console.log(JSON.stringify({ ok: false, reason: 'no_pending_row' }, null, 2))
  process.exit(0)
}

const { error: updErr } = await supabase
  .from('notification_queue')
  .update({
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    last_error: null,
  })
  .eq('id', row.id)

if (updErr) {
  console.error(updErr)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      queue_id: row.id,
      phone: row.phone,
      kind: row.kind,
      note: 'Add this phone as a Meta test recipient, then Process due on /whatsapp',
    },
    null,
    2,
  ),
)
