/**
 * Applies ledger sample data via service role.
 * Requires migration 20261014030000_dental_stock_ledger.sql already applied
 * for the toothpaste write-off (adjust_stock). FEFO batch can insert without it.
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

const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { db: { schema: 'dental' } })

const { data: branch, error: branchErr } = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (branchErr || !branch) throw branchErr ?? new Error('No branch')

const { data: gloves } = await supabase.from('items').select('id').eq('sku', 'CON-GLV-M100').maybeSingle()
if (!gloves) throw new Error('Gloves item missing')

const { data: existingFefo } = await supabase
  .from('stock_batches')
  .select('id')
  .eq('branch_id', branch.id)
  .eq('item_id', gloves.id)
  .eq('batch_no', 'BATCH-SEED-GLOVES-FEFO')
  .maybeSingle()

if (!existingFefo) {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 45)
  const expiryDate = expiry.toISOString().slice(0, 10)
  const { data: batch, error: batchErr } = await supabase
    .from('stock_batches')
    .insert({
      branch_id: branch.id,
      item_id: gloves.id,
      batch_no: 'BATCH-SEED-GLOVES-FEFO',
      expiry_date: expiryDate,
      qty_remaining: 20,
      unit_cost: 4.5,
    })
    .select('id')
    .single()
  if (batchErr) throw batchErr

  const { error: moveErr } = await supabase.from('stock_movements').insert({
    branch_id: branch.id,
    item_id: gloves.id,
    batch_id: batch.id,
    movement_type: 'purchase_in',
    qty: 20,
    ref_type: 'seed',
    notes: 'Ledger sample: earlier expiry FEFO batch',
  })
  if (moveErr) throw moveErr
  console.log('fefo_batch', batch.id)
} else {
  console.log('fefo_batch_exists', existingFefo.id)
}

const { data: adj } = await supabase
  .from('stock_movements')
  .select('id')
  .eq('branch_id', branch.id)
  .eq('item_id', gloves.id)
  .eq('ref_type', 'adjustment')
  .ilike('notes', 'Expired batch:%SEED-LEDGER%')
  .limit(1)
  .maybeSingle()

if (!adj) {
  const { error: rpcErr } = await supabase.rpc('adjust_stock', {
    p_branch_id: branch.id,
    p_item_id: gloves.id,
    p_qty_delta: -1,
    p_reason: 'Expired batch',
    p_notes: 'SEED-LEDGER damaged unit removed from shelf',
    p_batch_id: null,
  })
  if (rpcErr) {
    console.error('adjust_stock failed — apply ledger migration first:', rpcErr.message)
    process.exit(2)
  }
  console.log('gloves_writeoff', 'ok')
} else {
  console.log('gloves_writeoff_exists', adj.id)
}

const { data: batches } = await supabase
  .from('stock_batches')
  .select('batch_no, qty_remaining')
  .eq('branch_id', branch.id)
  .in('batch_no', ['BATCH-SEED-GLOVES-FEFO', 'BATCH-SEED-GLOVES-01', 'BATCH-SEED-PASTE-CTN-01'])

console.log(JSON.stringify({ batches }, null, 2))
