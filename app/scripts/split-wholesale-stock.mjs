/**
 * Split summed stock into retail (Hargeisa) vs wholesale (N.I SMILE Wholesale).
 * Deactivates demo "Hargeisa North". Keeps active NS-* items; reseeds opening batches.
 * Cost/prices left alone (manager fills).
 *
 * Requires CONFIRM_STOCK_RESET=YES and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLINIC_BRANCH = 'N.I SMILE Oral care & Teeth whitening'
const WHOLESALE_BRANCH = 'N.I SMILE Wholesale'
const DEMO_BRANCH = 'Hargeisa North'
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

async function seedOpening(branchId, itemId, sku, qty, note) {
  if (qty <= 0) return false

  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 2)
  const expiryDate = expiry.toISOString().slice(0, 10)

  const { data: batch, error: bErr } = await supabase
    .from('stock_batches')
    .insert({
      branch_id: branchId,
      item_id: itemId,
      batch_no: `OPEN-${sku}`,
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
    notes: note,
  })
  if (mErr) throw mErr
  return true
}

// 1) Deactivate demo Hargeisa North
const { data: north, error: northErr } = await supabase
  .from('branches')
  .select('id, name, active')
  .eq('name', DEMO_BRANCH)
  .maybeSingle()
if (northErr) throw northErr
if (north?.active) {
  const { error } = await supabase.from('branches').update({ active: false }).eq('id', north.id)
  if (error) throw error
}
console.log(JSON.stringify({ deactivated_demo: north ? { id: north.id, name: north.name } : null }, null, 2))

// 2) Resolve clinic branch
const { data: clinic, error: clinicErr } = await supabase
  .from('branches')
  .select('id, name, region, active')
  .eq('name', CLINIC_BRANCH)
  .maybeSingle()
if (clinicErr) throw clinicErr
if (!clinic) throw new Error(`Branch not found: ${CLINIC_BRANCH}`)

// 3) Ensure Wholesale branch
let { data: wholesale, error: wsErr } = await supabase
  .from('branches')
  .select('id, name, region, active')
  .eq('name', WHOLESALE_BRANCH)
  .maybeSingle()
if (wsErr) throw wsErr

if (!wholesale) {
  const { data: created, error } = await supabase
    .from('branches')
    .insert({
      name: WHOLESALE_BRANCH,
      address: 'Wholesale stock — Hargeisa, Somaliland',
      phone: '+252 63 4749276',
      active: true,
      region: 'somaliland',
    })
    .select('id, name, region, active')
    .single()
  if (error) throw error
  wholesale = created
} else if (!wholesale.active) {
  const { data: reactivated, error } = await supabase
    .from('branches')
    .update({ active: true, region: 'somaliland' })
    .eq('id', wholesale.id)
    .select('id, name, region, active')
    .single()
  if (error) throw error
  wholesale = reactivated
}

console.log(JSON.stringify({ clinic, wholesale, rosterCount: roster.length }, null, 2))

// 4) Clear both stocks
const clinicCleared = await clearBranchStock(clinic.id)
const wholesaleCleared = await clearBranchStock(wholesale.id)
console.log(JSON.stringify({ clinicCleared, wholesaleCleared }, null, 2))

// 5) Resolve active NS-* items by name (create if missing)
const { data: activeItems, error: itemsErr } = await supabase
  .from('items')
  .select('id, sku, name')
  .eq('active', true)
  .like('sku', `${SKU_PREFIX}%`)
if (itemsErr) throw itemsErr

const byName = new Map((activeItems ?? []).map((it) => [it.name, it]))

let { data: category, error: catErr } = await supabase
  .from('categories')
  .select('id, name')
  .eq('name', 'Clinic oral care')
  .maybeSingle()
if (catErr) throw catErr
if (!category) {
  const { data: created, error } = await supabase
    .from('categories')
    .insert({ name: 'Clinic oral care', active: true })
    .select('id, name')
    .single()
  if (error) throw error
  category = created
}

let retailUnits = 0
let wholesaleUnits = 0
let retailWithStock = 0
let wholesaleWithStock = 0
let createdItems = 0
const seeded = []

for (let i = 0; i < roster.length; i++) {
  const row = roster[i]
  const retailQty = Number(row.retail_qty) || 0
  const wholesaleQty = Number(row.wholesale_qty) || 0
  const sku = `${SKU_PREFIX}${String(i + 1).padStart(3, '0')}`

  let item = byName.get(row.name)
  if (!item) {
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

  const rOk = await seedOpening(
    clinic.id,
    item.id,
    item.sku,
    retailQty,
    'CLINIC-STOCK-2026-11 retail opening (manager count; cost TBD)',
  )
  if (rOk) {
    retailWithStock += 1
    retailUnits += retailQty
  }

  const wOk = await seedOpening(
    wholesale.id,
    item.id,
    item.sku,
    wholesaleQty,
    'CLINIC-STOCK-2026-11 wholesale opening (manager count; cost TBD)',
  )
  if (wOk) {
    wholesaleWithStock += 1
    wholesaleUnits += wholesaleQty
  }

  seeded.push({
    sku: item.sku,
    name: item.name,
    retail_qty: retailQty,
    wholesale_qty: wholesaleQty,
  })
}

const { data: activeBranches, error: abErr } = await supabase
  .from('branches')
  .select('id, name, region, active')
  .eq('active', true)
  .order('name')
if (abErr) throw abErr

console.log(
  JSON.stringify(
    {
      ok: true,
      active_branches: activeBranches,
      createdItems,
      retail: { branch_id: clinic.id, withStock: retailWithStock, totalUnits: retailUnits },
      wholesale: {
        branch_id: wholesale.id,
        withStock: wholesaleWithStock,
        totalUnits: wholesaleUnits,
      },
      seeded,
    },
    null,
    2,
  ),
)
