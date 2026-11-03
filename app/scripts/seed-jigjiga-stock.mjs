/**
 * Seed N.I SMILE Jigjiga retail opening stock (owner count).
 * Creates new shared catalog items when marked new (Nano toothpaste, Soft toothbrush).
 * Cost/prices left at 0 / absent for manager.
 *
 * Requires CONFIRM_STOCK_RESET=YES and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BRANCH_NAME = 'N.I SMILE Jigjiga'
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
  readFileSync(resolve(root, 'scripts/data/jigjiga-stock-roster.json'), 'utf8'),
)
if (!Array.isArray(roster) || roster.length === 0) {
  console.error('Empty roster')
  process.exit(1)
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'dental' },
})

async function clearBranchStock(branchId) {
  const { data: branchBatches, error: listBatchErr } = await supabase
    .from('stock_batches')
    .select('id')
    .eq('branch_id', branchId)
  if (listBatchErr) throw listBatchErr
  const batchIds = (branchBatches ?? []).map((b) => b.id)

  let clearedAllocations = 0
  if (batchIds.length > 0) {
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
    .eq('branch_id', branchId)
    .select('id')
  if (moveDelErr) throw moveDelErr

  const { data: batches, error: batchDelErr } = await supabase
    .from('stock_batches')
    .delete()
    .eq('branch_id', branchId)
    .select('id')
  if (batchDelErr) throw batchDelErr

  return {
    cleared_allocations: clearedAllocations,
    cleared_movements: moved?.length ?? 0,
    cleared_batches: batches?.length ?? 0,
  }
}

async function seedOpening(branchId, itemId, sku, qty) {
  if (qty <= 0) return false

  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 2)
  const expiryDate = expiry.toISOString().slice(0, 10)

  const { data: batch, error: bErr } = await supabase
    .from('stock_batches')
    .insert({
      branch_id: branchId,
      item_id: itemId,
      batch_no: `OPEN-JJ-${sku}`,
      expiry_date: expiryDate,
      qty_remaining: qty,
      unit_cost: 0,
    })
    .select('id')
    .single()
  if (bErr) throw bErr

  const { error: mErr } = await supabase.from('stock_movements').insert({
    branch_id: branchId,
    item_id: itemId,
    batch_id: batch.id,
    movement_type: 'purchase_in',
    qty,
    ref_type: 'seed',
    notes: 'JIGJIGA-STOCK-2026-11 retail opening (manager count; cost TBD)',
  })
  if (mErr) throw mErr
  return true
}

const { data: branch, error: branchErr } = await supabase
  .from('branches')
  .select('id, name, region, active')
  .eq('name', BRANCH_NAME)
  .maybeSingle()
if (branchErr) throw branchErr
if (!branch) throw new Error(`Branch not found: ${BRANCH_NAME}`)
if (!branch.active) throw new Error(`Branch inactive: ${BRANCH_NAME}`)

console.log(JSON.stringify({ branch, rosterCount: roster.length }, null, 2))

const cleared = await clearBranchStock(branch.id)
console.log(JSON.stringify({ cleared }, null, 2))

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

const { data: activeItems, error: itemsErr } = await supabase
  .from('items')
  .select('id, sku, name')
  .eq('active', true)
  .like('sku', `${SKU_PREFIX}%`)
if (itemsErr) throw itemsErr

const byName = new Map((activeItems ?? []).map((it) => [it.name, it]))
let maxSkuNum = 0
for (const it of activeItems ?? []) {
  const m = String(it.sku).match(/^NS-(\d+)$/i)
  if (m) maxSkuNum = Math.max(maxSkuNum, Number(m[1]))
}

let createdItems = 0
let withStock = 0
let zeroStock = 0
let totalUnits = 0
const seeded = []

for (const row of roster) {
  const qty = Number(row.qty) || 0
  let item = byName.get(row.name)

  if (!item) {
    maxSkuNum += 1
    const sku = `${SKU_PREFIX}${String(maxSkuNum).padStart(3, '0')}`
    const { data: inserted, error: itemErr } = await supabase
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
    item = inserted
    createdItems += 1
    byName.set(row.name, item)
  }

  const ok = await seedOpening(branch.id, item.id, item.sku, qty)
  if (ok) {
    withStock += 1
    totalUnits += qty
  } else {
    zeroStock += 1
  }

  seeded.push({ sku: item.sku, name: item.name, qty })
}

console.log(
  JSON.stringify(
    {
      ok: true,
      branch_id: branch.id,
      createdItems,
      withStock,
      zeroStock,
      totalUnits,
      seeded,
    },
    null,
    2,
  ),
)
