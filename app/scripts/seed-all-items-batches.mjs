/**
 * Creates opening batches for active items with no batches at the primary branch.
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

const { data: items, error: itemsErr } = await supabase
  .from('items')
  .select('id, sku, cost, reorder_level')
  .eq('active', true)
if (itemsErr) throw itemsErr

const { data: existingBatches, error: batchErr } = await supabase
  .from('stock_batches')
  .select('item_id')
  .eq('branch_id', branch.id)
if (batchErr) throw batchErr

const stocked = new Set((existingBatches ?? []).map((row) => row.item_id))
const missing = (items ?? []).filter((item) => !stocked.has(item.id))

let created = 0
for (const item of missing) {
  const qty = Math.max(Number(item.reorder_level) || 0, 5)
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 365)
  const { data: batch, error } = await supabase
    .from('stock_batches')
    .insert({
      branch_id: branch.id,
      item_id: item.id,
      batch_no: `OPEN-${item.sku}`,
      expiry_date: expiry.toISOString().slice(0, 10),
      qty_remaining: qty,
      unit_cost: Number(item.cost) || 0,
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: moveErr } = await supabase.from('stock_movements').insert({
    branch_id: branch.id,
    item_id: item.id,
    batch_id: batch.id,
    movement_type: 'purchase_in',
    qty,
    ref_type: 'seed',
    notes: 'Opening batch so item appears on stock counts',
  })
  if (moveErr) throw moveErr
  created += 1
}

console.log(
  JSON.stringify(
    {
      branchId: branch.id,
      activeItems: items?.length ?? 0,
      alreadyStocked: stocked.size,
      created,
    },
    null,
    2,
  ),
)
