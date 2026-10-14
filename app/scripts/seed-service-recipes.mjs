/**
 * Sample service recipes for step 14. Requires dental_service_recipes migration.
 * Prefer running supabase/seed/20261014071000_seed_service_recipes_sample.sql in the SQL editor.
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

// Services are patient-priced only.
await supabase.from('service_prices').delete().eq('price_list', 'wholesale')

const { data: branch } = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (!branch) throw new Error('No branch')

const { data: services, error: svcErr } = await supabase
  .from('services')
  .select('id, code')
  .in('code', ['SRV-001', 'SRV-002', 'SRV-003'])
if (svcErr) throw svcErr
const byCode = Object.fromEntries((services ?? []).map((s) => [s.code, s.id]))
if (!byCode['SRV-001'] || !byCode['SRV-002'] || !byCode['SRV-003']) {
  throw new Error('Whitening services missing — run catalog seed first')
}

async function ensureItem(sku, fallback) {
  const { data } = await supabase.from('items').select('id').eq('sku', sku).maybeSingle()
  if (data) return data.id
  if (!fallback) throw new Error(`Item ${sku} missing`)
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  const { data: tax } = await supabase
    .from('tax_rates')
    .select('id')
    .eq('active', true)
    .order('rate', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: created, error } = await supabase
    .from('items')
    .insert({
      sku,
      name: fallback.name,
      category_id: cat.id,
      unit: fallback.unit,
      cost: fallback.cost,
      reorder_level: fallback.reorder,
      tax_rate_id: tax?.id ?? null,
      active: true,
    })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

const glovesId = await ensureItem('CON-GLV-M100', {
  name: 'Latex Gloves M (Box of 100)',
  unit: 'Box',
  cost: 4,
  reorder: 20,
})
const flossId = await ensureItem('PRD-006')
const pasteId = await ensureItem('PRD-001')

for (const [code, minutes] of [
  ['SRV-001', 60],
  ['SRV-002', 30],
  ['SRV-003', 75],
]) {
  await supabase
    .from('services')
    .update({ duration_minutes: minutes })
    .eq('id', byCode[code])
    .is('duration_minutes', null)
}

const recipeMap = [
  { service: 'SRV-001', item_id: glovesId, qty: 2 },
  { service: 'SRV-001', item_id: flossId, qty: 1 },
  { service: 'SRV-001', item_id: pasteId, qty: 1 },
  { service: 'SRV-002', item_id: glovesId, qty: 2 },
  { service: 'SRV-003', item_id: glovesId, qty: 2 },
  { service: 'SRV-003', item_id: flossId, qty: 1 },
]

for (const line of recipeMap) {
  const { error } = await supabase.from('service_recipes').upsert(
    {
      service_id: byCode[line.service],
      item_id: line.item_id,
      qty: line.qty,
    },
    { onConflict: 'service_id,item_id' },
  )
  if (error) {
    console.error('recipe upsert failed — apply service_recipes migration first:', error.message)
    process.exit(2)
  }
}

const { data: existingUsage } = await supabase
  .from('stock_movements')
  .select('id')
  .eq('movement_type', 'service_usage')
  .eq('notes', 'Recipe: SRV-002')
  .eq('branch_id', branch.id)
  .limit(1)

if (!existingUsage?.length) {
  const { data: batch } = await supabase
    .from('stock_batches')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('item_id', glovesId)
    .gt('qty_remaining', 0)
    .limit(1)
    .maybeSingle()
  if (!batch) {
    const { error: batchErr } = await supabase.from('stock_batches').insert({
      branch_id: branch.id,
      item_id: glovesId,
      batch_no: 'OPEN-RECIPE-GLOVES',
      expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      qty_remaining: 50,
      unit_cost: 4,
    })
    if (batchErr) throw batchErr
  }

  const { error: applyErr } = await supabase.rpc('apply_service_recipe', {
    p_branch_id: branch.id,
    p_service_id: byCode['SRV-002'],
    p_ref_type: 'seed',
    p_ref_id: byCode['SRV-002'],
  })
  if (applyErr) throw applyErr
}

console.log(
  JSON.stringify(
    {
      services: Object.keys(byCode),
      recipes: recipeMap.length,
      usage: 'SRV-002',
    },
    null,
    2,
  ),
)
