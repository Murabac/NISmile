/**
 * Sample wholesale customer + on-account sale + settlement for step 16.
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

const { data: existing } = await supabase
  .from('customers')
  .select('id')
  .eq('notes', 'SEED-WHOLESALE-CUSTOMER')
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ exists: existing }, null, 2))
  process.exit(0)
}

const { data: branch } = await supabase
  .from('branches')
  .select('id')
  .eq('active', true)
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (!branch) throw new Error('No branch')

const { data: item } = await supabase
  .from('items')
  .select('id')
  .eq('sku', 'PRD-001')
  .eq('active', true)
  .maybeSingle()
if (!item) throw new Error('PRD-001 missing')

const { data: customer, error: custErr } = await supabase
  .from('customers')
  .insert({
    branch_id: branch.id,
    name: 'Hargeisa Dental Supply Co.',
    phone: '+252634555666',
    customer_type: 'wholesale',
    subtype: 'pharmacy',
    language: 'so',
    whatsapp_opt_in: true,
    credit_limit: 2500,
    notes: 'SEED-WHOLESALE-CUSTOMER',
  })
  .select('id')
  .single()
if (custErr) throw custErr

const { data: stock } = await supabase
  .from('stock_batches')
  .select('id')
  .eq('branch_id', branch.id)
  .eq('item_id', item.id)
  .gte('qty_remaining', 5)
  .limit(1)
  .maybeSingle()

if (!stock) {
  const { error: batchErr } = await supabase.from('stock_batches').insert({
    branch_id: branch.id,
    item_id: item.id,
    batch_no: 'OPEN-WS-PRD-001',
    expiry_date: new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10),
    qty_remaining: 40,
    unit_cost: 7.5,
  })
  if (batchErr) throw batchErr
}

const due = new Date()
due.setDate(due.getDate() + 30)

const { data: saleId, error: saleErr } = await supabase.rpc('checkout_sale', {
  p_branch_id: branch.id,
  p_customer_id: customer.id,
  p_lines: [{ line_type: 'item', item_id: item.id, qty: 5 }],
  p_payments: [],
  p_notes: 'SEED-WHOLESALE-ON-ACCOUNT',
  p_due_date: due.toISOString().slice(0, 10),
})
if (saleErr) {
  console.error('checkout failed — apply wholesale migration first:', saleErr.message)
  process.exit(2)
}

const { data: sale } = await supabase
  .from('sales')
  .select('id, total')
  .eq('id', saleId)
  .single()

const settle = Math.round((Number(sale.total) / 2) * 100) / 100
const { error: payErr } = await supabase.rpc('apply_customer_payment', {
  p_branch_id: branch.id,
  p_customer_id: customer.id,
  p_payments: [{ tender: 'zaad', amount: settle, reference: 'SEED-ZAAD-WS' }],
  p_sale_id: saleId,
})
if (payErr) throw payErr

const { data: ar } = await supabase.rpc('customer_ar_balance', {
  p_customer_id: customer.id,
})

console.log(
  JSON.stringify(
    {
      customerId: customer.id,
      saleId,
      total: sale.total,
      settled: settle,
      ar,
    },
    null,
    2,
  ),
)
