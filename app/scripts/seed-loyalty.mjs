/**
 * Seed loyalty sample: ensure settings row + 250 pt adjust for seed patient.
 * Rates stay blank until the owner sets them in Settings / Promotions.
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

const { data: settings, error: sErr } = await supabase.from('clinic_settings').select('id').limit(1).maybeSingle()
if (sErr) {
  console.error(sErr)
  console.error('Apply migration 20261014180000_dental_loyalty.sql first.')
  process.exit(1)
}
if (!settings) {
  const { error } = await supabase.from('clinic_settings').insert({})
  if (error) {
    console.error(error)
    process.exit(1)
  }
}

const { data: customer } = await supabase
  .from('customers')
  .select('id, name, loyalty_points')
  .eq('notes', 'SEED-APPOINTMENT-PATIENT')
  .order('created_at')
  .limit(1)
  .maybeSingle()

if (!customer) {
  console.log(JSON.stringify({ ok: true, skipped: 'no seed patient' }, null, 2))
  process.exit(0)
}

const { data: existing } = await supabase
  .from('loyalty_transactions')
  .select('id')
  .eq('customer_id', customer.id)
  .eq('notes', 'SEED-LOYALTY-ADJUST')
  .limit(1)
  .maybeSingle()

if (existing) {
  console.log(
    JSON.stringify(
      { ok: true, skipped: 'already seeded', customer_id: customer.id, loyalty_points: customer.loyalty_points },
      null,
      2,
    ),
  )
  process.exit(0)
}

const { data: tx, error: txErr } = await supabase.rpc('adjust_loyalty_points', {
  p_customer_id: customer.id,
  p_points: 250,
  p_notes: 'SEED-LOYALTY-ADJUST',
})
if (txErr) {
  console.error(txErr)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      customer_id: customer.id,
      name: customer.name,
      balance_after: tx?.balance_after ?? null,
      note: 'Earn/redeem rates stay blank until owner sets them in Settings.',
    },
    null,
    2,
  ),
)
