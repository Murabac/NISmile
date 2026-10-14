/**
 * Applies step 10 alert sample scenarios via service role.
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

const { data: branch } = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (!branch) throw new Error('No branch')

const { data: gloves } = await supabase.from('items').select('id, reorder_level').eq('sku', 'CON-GLV-M100').maybeSingle()
const { data: carton } = await supabase.from('items').select('id').eq('sku', 'WHL-001').maybeSingle()
if (!gloves) throw new Error('Gloves missing')

if (Number(gloves.reorder_level) < 200) {
  const { error } = await supabase.from('items').update({ reorder_level: 200 }).eq('id', gloves.id)
  if (error) throw error
  console.log('gloves_reorder', 200)
} else {
  console.log('gloves_reorder_ok', gloves.reorder_level)
}

async function ensureBatch(batchNo, days, qty) {
  const { data: existing } = await supabase
    .from('stock_batches')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('item_id', gloves.id)
    .eq('batch_no', batchNo)
    .maybeSingle()
  if (existing) {
    console.log('batch_exists', batchNo)
    return
  }
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + days)
  const { data: batch, error } = await supabase
    .from('stock_batches')
    .insert({
      branch_id: branch.id,
      item_id: gloves.id,
      batch_no: batchNo,
      expiry_date: expiry.toISOString().slice(0, 10),
      qty_remaining: qty,
      unit_cost: 4.5,
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: moveErr } = await supabase.from('stock_movements').insert({
    branch_id: branch.id,
    item_id: gloves.id,
    batch_id: batch.id,
    movement_type: 'purchase_in',
    qty,
    ref_type: 'seed',
    notes: `Alert sample: expires within ${days <= 30 ? 30 : 60} days`,
  })
  if (moveErr) throw moveErr
  console.log('batch', batchNo, batch.id)
}

await ensureBatch('BATCH-SEED-ALERT-30D', 18, 8)
await ensureBatch('BATCH-SEED-ALERT-60D', 50, 6)

if (carton) {
  const { data: batches } = await supabase
    .from('stock_batches')
    .select('qty_remaining')
    .eq('branch_id', branch.id)
    .eq('item_id', carton.id)
  const qty = (batches ?? []).reduce((sum, row) => sum + Number(row.qty_remaining), 0)

  const { data: adj } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('item_id', carton.id)
    .ilike('notes', 'Expired batch:%SEED-ALERT-OUT%')
    .limit(1)
    .maybeSingle()

  if (qty > 0 && !adj) {
    const { error } = await supabase.rpc('adjust_stock', {
      p_branch_id: branch.id,
      p_item_id: carton.id,
      p_qty_delta: -qty,
      p_reason: 'Expired batch',
      p_notes: 'SEED-ALERT-OUT cleared for out-of-stock demo',
      p_batch_id: null,
    })
    if (error) throw error
    console.log('carton_out', qty)
  } else {
    console.log('carton_out_skip', { qty, adj: Boolean(adj) })
  }
}

console.log(JSON.stringify({ ok: true }, null, 2))
