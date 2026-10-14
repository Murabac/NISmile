/**
 * Sample return against SEED-SALE-WALKIN item line (step 18).
 * Requires migration 20261014100000_dental_returns.sql applied.
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
  .from('returns')
  .select('id, return_number')
  .eq('notes', 'SEED-RETURN-WALKIN-ITEM')
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ exists: existing }, null, 2))
  process.exit(0)
}

const { data: sale, error: saleErr } = await supabase
  .from('sales')
  .select('id, branch_id, sale_lines ( id, line_type, qty, line_gross )')
  .eq('notes', 'SEED-SALE-WALKIN')
  .order('created_at')
  .limit(1)
  .maybeSingle()
if (saleErr) throw saleErr
if (!sale) throw new Error('SEED-SALE-WALKIN missing. Run seed-sales first.')

const itemLine = (sale.sale_lines ?? []).find((l) => l.line_type === 'item')
if (!itemLine) throw new Error('Walk-in sale has no item line')

const { data: returnId, error } = await supabase.rpc('process_return', {
  p_branch_id: sale.branch_id,
  p_sale_id: sale.id,
  p_lines: [{ sale_line_id: itemLine.id, qty: Number(itemLine.qty) }],
  p_refunds: [
    {
      tender: 'cash',
      amount: Number(itemLine.line_gross),
      reference: 'SEED-REFUND-CASH',
    },
  ],
  p_restock: true,
  p_reason: 'Customer changed mind',
  p_notes: 'SEED-RETURN-WALKIN-ITEM',
})
if (error) throw error

console.log(JSON.stringify({ return_id: returnId, sale_id: sale.id }, null, 2))
