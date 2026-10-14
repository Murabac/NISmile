/**
 * Ensure go-live checklist seed marker exists (steps 26–28).
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

const { data: settings, error } = await supabase.from('clinic_settings').select('id, go_live').limit(1).maybeSingle()
if (error) {
  console.error(error)
  console.error('Apply migration 20261014200000_dental_reports_dashboard.sql first.')
  process.exit(1)
}

let id = settings?.id
if (!id) {
  const { data: created, error: insErr } = await supabase.from('clinic_settings').insert({}).select('id').single()
  if (insErr) {
    console.error(insErr)
    process.exit(1)
  }
  id = created.id
}

const goLive = {
  ...(settings?.go_live && typeof settings.go_live === 'object' ? settings.go_live : {}),
  seed_marker: 'SEED-GO-LIVE',
  backup_confirmed: false,
  roles_trained: false,
  templates_reviewed: false,
  quality_rating_watched: false,
}

const { error: updErr } = await supabase
  .from('clinic_settings')
  .update({ go_live: goLive, updated_at: new Date().toISOString() })
  .eq('id', id)

if (updErr) {
  console.error(updErr)
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, clinic_settings_id: id, go_live: goLive }, null, 2))
