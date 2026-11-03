/**
 * Replace CLINIC-PATIENT-LIST-2026-11 customers with enriched roster
 * (name + location in notes + normalized phone when usable).
 *
 * Requires CONFIRM_CUSTOMER_RESET=YES and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const NOTES_MARKER = 'CLINIC-PATIENT-LIST-2026-11'
const BRANCH_NAME = 'N.I SMILE Oral care & Teeth whitening'
const BATCH = 100

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

if (process.env.CONFIRM_CUSTOMER_RESET !== 'YES') {
  console.error('Refusing to run. Set CONFIRM_CUSTOMER_RESET=YES.')
  process.exit(1)
}

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/.env.local')
  process.exit(1)
}

/** @returns {{ phone: string | null, rawFailed: string | null }} */
function normalizePhone(raw) {
  if (raw == null) return { phone: null, rawFailed: null }
  let s = String(raw).trim()
  if (!s || s === '.' || s === '??') return { phone: null, rawFailed: null }

  s = s
    .replace(/\?\?/g, ' ')
    .replace(/\bwaiting nano\b/gi, ' ')
    .replace(/,/g, ' ')
    .trim()

  const digits = s.replace(/\D/g, '')
  if (!digits) return { phone: null, rawFailed: s || null }

  if (digits.startsWith('252') && digits.length === 12) {
    return { phone: `+${digits}`, rawFailed: null }
  }
  if (digits.length === 9 && digits.startsWith('6')) {
    return { phone: `+252${digits}`, rawFailed: null }
  }
  if (s.startsWith('+') && digits.startsWith('252') && digits.length === 12) {
    return { phone: `+${digits}`, rawFailed: null }
  }

  return { phone: null, rawFailed: s }
}

function buildNotes(location, rawFailed) {
  const parts = [NOTES_MARKER]
  if (location) parts.push(location)
  if (rawFailed) parts.push(`raw phone: ${rawFailed}`)
  return parts.join(' | ')
}

const rosterPath = resolve(root, 'scripts/data/clinic-patient-roster.tsv')
const rosterLines = readFileSync(rosterPath, 'utf8').split(/\r?\n/)
const records = []
for (let i = 0; i < rosterLines.length; i++) {
  const line = rosterLines[i]
  if (!line.trim()) continue
  const parts = line.split('\t')
  if (i === 0 && /^name$/i.test((parts[0] || '').trim())) continue
  const name = (parts[0] || '').replace(/\s+/g, ' ').trim()
  if (!name) continue
  const location = (parts[1] || '').replace(/\s+/g, ' ').trim()
  const phoneRaw = (parts.slice(2).join('\t') || '').replace(/\s+/g, ' ').trim()
  const { phone, rawFailed } = normalizePhone(phoneRaw)
  records.push({
    name,
    location,
    phone,
    notes: buildNotes(location, rawFailed),
  })
}

if (records.length === 0) {
  console.error('No rows in', rosterPath)
  process.exit(1)
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'dental' },
})

const { data: branch, error: branchErr } = await supabase
  .from('branches')
  .select('id, name, region')
  .eq('name', BRANCH_NAME)
  .maybeSingle()

if (branchErr) {
  console.error(branchErr)
  process.exit(1)
}
if (!branch) {
  console.error(`Branch not found: ${BRANCH_NAME}`)
  process.exit(1)
}

console.log(JSON.stringify({ branch, rosterCount: records.length }, null, 2))

const { data: deletedRows, error: delErr } = await supabase
  .from('customers')
  .delete()
  .ilike('notes', `${NOTES_MARKER}%`)
  .select('id')

if (delErr) {
  console.error('Delete failed:', delErr)
  process.exit(1)
}

const deleted = deletedRows?.length ?? 0
console.log(JSON.stringify({ deleted }, null, 2))

let inserted = 0
let withPhone = 0
let withoutPhone = 0

for (let i = 0; i < records.length; i += BATCH) {
  const chunk = records.slice(i, i + BATCH).map((r) => {
    if (r.phone) withPhone += 1
    else withoutPhone += 1
    return {
      branch_id: branch.id,
      name: r.name,
      phone: r.phone,
      customer_type: 'retail',
      subtype: null,
      language: 'en',
      whatsapp_opt_in: true,
      credit_limit: null,
      notes: r.notes,
    }
  })
  const { data, error } = await supabase.from('customers').insert(chunk).select('id')
  if (error) {
    console.error('Insert failed at offset', i, error)
    process.exit(1)
  }
  inserted += data?.length ?? chunk.length
  console.log(`Inserted ${inserted}/${records.length}`)
}

const { count: markerCount, error: countErr } = await supabase
  .from('customers')
  .select('id', { count: 'exact', head: true })
  .ilike('notes', `${NOTES_MARKER}%`)

if (countErr) {
  console.error(countErr)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      branch_id: branch.id,
      deleted,
      inserted,
      withPhone,
      withoutPhone,
      marker_count: markerCount,
    },
    null,
    2,
  ),
)
