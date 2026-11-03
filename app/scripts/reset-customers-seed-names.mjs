/**
 * One-shot: wipe all customers + sales/returns/appointments/loyalty/queue,
 * then seed retail patients (name only) on the Hargeisa N.I SMILE branch.
 *
 * Requires CONFIRM_CUSTOMER_RESET=YES and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Does not restore stock FEFO deductions from wiped sales.
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
  console.error('Refusing to run. Set CONFIRM_CUSTOMER_RESET=YES to wipe customers and sales.')
  process.exit(1)
}

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/.env.local')
  process.exit(1)
}

const namesPath = resolve(root, 'scripts/data/clinic-patient-names.txt')
const names = readFileSync(namesPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

if (names.length === 0) {
  console.error('No names in', namesPath)
  process.exit(1)
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'dental' },
})

/** PostgREST requires a filter; match everything by created_at. */
async function deleteAll(table) {
  const { data, error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01')
    .select('id')
  if (error) {
    throw new Error(`${table} delete failed: ${error.message}`)
  }
  return count ?? data?.length ?? 0
}

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

console.log(JSON.stringify({ branch, nameCount: names.length }, null, 2))

const wiped = {}
try {
  wiped.notification_queue = await deleteAll('notification_queue')
  wiped.promotion_redemptions = await deleteAll('promotion_redemptions')
  wiped.loyalty_transactions = await deleteAll('loyalty_transactions')
  wiped.appointments = await deleteAll('appointments')
  // returns cascade return_lines + return_refunds; must go before sales
  wiped.returns = await deleteAll('returns')
  wiped.sales = await deleteAll('sales')
  wiped.customers = await deleteAll('customers')
} catch (err) {
  console.error(err)
  process.exit(1)
}

console.log(JSON.stringify({ wiped }, null, 2))

let inserted = 0
for (let i = 0; i < names.length; i += BATCH) {
  const chunk = names.slice(i, i + BATCH).map((name) => ({
    branch_id: branch.id,
    name,
    phone: null,
    customer_type: 'retail',
    subtype: null,
    language: 'en',
    whatsapp_opt_in: true,
    credit_limit: null,
    notes: NOTES_MARKER,
  }))
  const { data, error } = await supabase.from('customers').insert(chunk).select('id')
  if (error) {
    console.error('Insert failed at offset', i, error)
    process.exit(1)
  }
  inserted += data?.length ?? chunk.length
  console.log(`Inserted ${inserted}/${names.length}`)
}

const { count: customerCount, error: countErr } = await supabase
  .from('customers')
  .select('id', { count: 'exact', head: true })
  .eq('notes', NOTES_MARKER)

if (countErr) {
  console.error(countErr)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      branch_id: branch.id,
      wiped,
      inserted,
      marker_count: customerCount,
    },
    null,
    2,
  ),
)
