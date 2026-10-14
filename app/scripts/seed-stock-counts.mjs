/**
 * Applies step 12 stock count sample via service role.
 * Requires migration 20261014050000_dental_stock_counts.sql.
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

const { data: gloves } = await supabase.from('items').select('id').eq('sku', 'CON-GLV-M100').maybeSingle()
if (!gloves) throw new Error('Gloves missing')

const { data: existing } = await supabase
  .from('stock_counts')
  .select('id, status')
  .eq('branch_id', branch.id)
  .eq('notes', 'SEED-STOCK-COUNT')
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ exists: existing }, null, 2))
  process.exit(0)
}

// Cancel open drafts so create can run.
const { data: drafts } = await supabase
  .from('stock_counts')
  .select('id')
  .eq('branch_id', branch.id)
  .eq('status', 'draft')

for (const draft of drafts ?? []) {
  const { error } = await supabase.rpc('cancel_stock_count', { p_stock_count_id: draft.id })
  if (error) console.warn('cancel', error.message)
}

const { data: countId, error: createErr } = await supabase.rpc('create_stock_count', {
  p_branch_id: branch.id,
  p_notes: 'SEED-STOCK-COUNT',
})
if (createErr) {
  console.error('create failed — apply stock count migration first:', createErr.message)
  process.exit(2)
}

const { data: lines, error: linesErr } = await supabase
  .from('stock_count_lines')
  .select('id, item_id, system_qty')
  .eq('stock_count_id', countId)
if (linesErr) throw linesErr

const payload = (lines ?? []).map((line) => ({
  line_id: line.id,
  counted_qty:
    line.item_id === gloves.id ? Math.max(Number(line.system_qty) - 1, 0) : Number(line.system_qty),
}))

const { error: saveErr } = await supabase.rpc('save_stock_count_lines', {
  p_stock_count_id: countId,
  p_lines: payload,
})
if (saveErr) throw saveErr

const { error: completeErr } = await supabase.rpc('complete_stock_count', {
  p_stock_count_id: countId,
})
if (completeErr) throw completeErr

console.log(JSON.stringify({ countId, lines: payload.length, glovesShort: 1 }, null, 2))
