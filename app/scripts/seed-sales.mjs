/**
 * Sample walk-in sale for step 15. Requires dental_sales migration + catalog/recipes.
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
  .from('sales')
  .select('id, receipt_number')
  .eq('notes', 'SEED-SALE-WALKIN')
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
  .select('id, tax_rate_id, tax_rates ( rate, active )')
  .eq('sku', 'PRD-001')
  .eq('active', true)
  .maybeSingle()
const { data: service } = await supabase
  .from('services')
  .select('id, tax_rate_id, tax_rates ( rate, active )')
  .eq('code', 'SRV-002')
  .eq('active', true)
  .maybeSingle()
if (!item || !service) throw new Error('PRD-001 or SRV-002 missing')

async function ensureStock(itemId, batchNo, qty, cost) {
  const { data: stock } = await supabase
    .from('stock_batches')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('item_id', itemId)
    .gt('qty_remaining', qty - 0.01)
    .limit(1)
    .maybeSingle()
  if (stock) return
  const { error } = await supabase.from('stock_batches').insert({
    branch_id: branch.id,
    item_id: itemId,
    batch_no: batchNo,
    expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    qty_remaining: qty,
    unit_cost: cost,
  })
  if (error) throw error
}

await ensureStock(item.id, 'OPEN-SALE-PRD-001', 25, 7.5)

const { data: gloves } = await supabase
  .from('items')
  .select('id')
  .eq('sku', 'CON-GLV-M100')
  .maybeSingle()
if (gloves) await ensureStock(gloves.id, 'OPEN-SALE-GLOVES', 50, 4)

const { data: itemPrice } = await supabase.rpc('resolve_unit_price', {
  p_price_list: 'retail',
  p_qty: 1,
  p_item_id: item.id,
  p_service_id: null,
})
const { data: servicePrice } = await supabase.rpc('resolve_unit_price', {
  p_price_list: 'retail',
  p_qty: 1,
  p_item_id: null,
  p_service_id: service.id,
})

const itemTax =
  item.tax_rates && (Array.isArray(item.tax_rates) ? item.tax_rates[0] : item.tax_rates)
const serviceTax =
  service.tax_rates &&
  (Array.isArray(service.tax_rates) ? service.tax_rates[0] : service.tax_rates)
const itemRate = itemTax?.active === false ? 0 : Number(itemTax?.rate ?? 0)
const serviceRate = serviceTax?.active === false ? 0 : Number(serviceTax?.rate ?? 0)
const itemNet = Number(itemPrice)
const serviceNet = Number(servicePrice)
const total =
  Math.round(
    (itemNet + serviceNet + itemNet * itemRate + serviceNet * serviceRate) * 100,
  ) / 100

const { data: saleId, error } = await supabase.rpc('checkout_sale', {
  p_branch_id: branch.id,
  p_customer_id: null,
  p_notes: 'SEED-SALE-WALKIN',
  p_lines: [
    { line_type: 'item', item_id: item.id, qty: 1 },
    { line_type: 'service', service_id: service.id, qty: 1 },
  ],
  p_payments: [{ tender: 'cash', amount: total }],
})
if (error) {
  console.error('checkout failed — apply sales migration first:', error.message)
  process.exit(2)
}

const { data: sale } = await supabase
  .from('sales')
  .select('id, total, receipt_number, status')
  .eq('id', saleId)
  .single()

console.log(
  JSON.stringify(
    {
      saleId,
      receipt: sale?.receipt_number,
      total: sale?.total,
      status: sale?.status,
    },
    null,
    2,
  ),
)
