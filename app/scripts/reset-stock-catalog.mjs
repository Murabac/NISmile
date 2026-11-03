/**
 * Deactivate old catalog items, clear Hargeisa stock ledger, seed manager roster
 * with summed wholesale+retail qtys. Cost/prices left at 0 / absent for manager.
 *
 * Requires CONFIRM_STOCK_RESET=YES and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BRANCH_NAME = 'N.I SMILE Oral care & Teeth whitening'
const CATEGORY_NAME = 'Clinic oral care'
const SKU_PREFIX = 'NS-'

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

if (process.env.CONFIRM_STOCK_RESET !== 'YES') {
  console.error('Refusing to run. Set CONFIRM_STOCK_RESET=YES.')
  process.exit(1)
}

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/.env.local')
  process.exit(1)
}

const roster = JSON.parse(
  readFileSync(resolve(root, 'scripts/data/clinic-stock-roster.json'), 'utf8'),
)
if (!Array.isArray(roster) || roster.length === 0) {
  console.error('Empty roster')
  process.exit(1)
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'dental' },
})

const { data: branch, error: branchErr } = await supabase
  .from('branches')
  .select('id, name')
  .eq('name', BRANCH_NAME)
  .maybeSingle()
if (branchErr) throw branchErr
if (!branch) throw new Error(`Branch not found: ${BRANCH_NAME}`)

console.log(JSON.stringify({ branch, rosterCount: roster.length }, null, 2))

// 1) Clear stock ledger at this branch (allocations → movements → batches)
const { data: branchBatches, error: listBatchErr } = await supabase
  .from('stock_batches')
  .select('id')
  .eq('branch_id', branch.id)
if (listBatchErr) throw listBatchErr
const batchIds = (branchBatches ?? []).map((b) => b.id)

let clearedAllocations = 0
if (batchIds.length > 0) {
  // PostgREST .in() chunks
  for (let i = 0; i < batchIds.length; i += 100) {
    const chunk = batchIds.slice(i, i + 100)
    const { data: allocs, error: allocErr } = await supabase
      .from('stock_transfer_allocations')
      .delete()
      .in('from_batch_id', chunk)
      .select('id')
    if (allocErr) throw allocErr
    clearedAllocations += allocs?.length ?? 0
  }
}

const { data: moved, error: moveDelErr } = await supabase
  .from('stock_movements')
  .delete()
  .eq('branch_id', branch.id)
  .select('id')
if (moveDelErr) throw moveDelErr

const { data: batches, error: batchDelErr } = await supabase
  .from('stock_batches')
  .delete()
  .eq('branch_id', branch.id)
  .select('id')
if (batchDelErr) throw batchDelErr

console.log(
  JSON.stringify(
    {
      cleared_allocations: clearedAllocations,
      cleared_movements: moved?.length ?? 0,
      cleared_batches: batches?.length ?? 0,
    },
    null,
    2,
  ),
)

// 2) Delete recipes that point at items we will deactivate (no active flag on recipes)
const { data: oldItems, error: oldItemsErr } = await supabase.from('items').select('id').eq('active', true)
if (oldItemsErr) throw oldItemsErr
const oldIds = (oldItems ?? []).map((r) => r.id)

if (oldIds.length > 0) {
  const { error: recipeErr } = await supabase.from('service_recipes').delete().in('item_id', oldIds)
  if (recipeErr) throw recipeErr

  const { error: deactErr } = await supabase.from('items').update({ active: false }).in('id', oldIds)
  if (deactErr) throw deactErr
}

console.log(JSON.stringify({ deactivated_items: oldIds.length }, null, 2))

// 3) Category for new items
let { data: category, error: catErr } = await supabase
  .from('categories')
  .select('id, name')
  .eq('name', CATEGORY_NAME)
  .maybeSingle()
if (catErr) throw catErr
if (!category) {
  const { data: created, error } = await supabase
    .from('categories')
    .insert({ name: CATEGORY_NAME, active: true })
    .select('id, name')
    .single()
  if (error) throw error
  category = created
}

const expiry = new Date()
expiry.setFullYear(expiry.getFullYear() + 2)
const expiryDate = expiry.toISOString().slice(0, 10)

let insertedItems = 0
let withStock = 0
let zeroStock = 0
let totalUnits = 0

for (let i = 0; i < roster.length; i++) {
  const row = roster[i]
  const qty = Number(row.qty) || 0
  const sku = `${SKU_PREFIX}${String(i + 1).padStart(3, '0')}`

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .insert({
      sku,
      name: row.name,
      category_id: category.id,
      unit: 'pcs',
      cost: 0,
      reorder_level: 0,
      tax_rate_id: null,
      active: true,
    })
    .select('id, sku, name')
    .single()
  if (itemErr) throw itemErr
  insertedItems += 1

  if (qty > 0) {
    const { data: batch, error: bErr } = await supabase
      .from('stock_batches')
      .insert({
        branch_id: branch.id,
        item_id: item.id,
        batch_no: `OPEN-${sku}`,
        expiry_date: expiryDate,
        qty_remaining: qty,
        unit_cost: 0,
      })
      .select('id')
      .single()
    if (bErr) throw bErr

    const { error: mErr } = await supabase.from('stock_movements').insert({
      branch_id: branch.id,
      item_id: item.id,
      batch_id: batch.id,
      movement_type: 'purchase_in',
      qty,
      ref_type: 'seed',
      notes: 'CLINIC-STOCK-2026-11 opening (manager count; cost TBD)',
    })
    if (mErr) throw mErr
    withStock += 1
    totalUnits += qty
  } else {
    zeroStock += 1
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      branch_id: branch.id,
      category_id: category.id,
      insertedItems,
      withStock,
      zeroStock,
      totalUnits,
    },
    null,
    2,
  ),
)
