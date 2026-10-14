/**
 * Applies step 11 transfer sample data via service role.
 * Requires migration 20261014040000_dental_transfers.sql.
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

const { data: branches, error: branchErr } = await supabase
  .from('branches')
  .select('id, name, created_at')
  .eq('active', true)
  .order('created_at')
if (branchErr) throw branchErr

let main = branches?.[0]
if (!main) throw new Error('No branch')

let north = (branches ?? []).find((b) => b.name === 'Hargeisa North')
if (!north) {
  const { data, error } = await supabase
    .from('branches')
    .insert({
      name: 'Hargeisa North',
      address: 'North Road, Hargeisa, Somaliland',
      phone: '+252 63 0000000',
      active: true,
    })
    .select('id, name')
    .single()
  if (error) throw error
  north = data
  console.log('branch', north.name, north.id)
} else {
  console.log('branch_exists', north.name)
}

const { data: gloves } = await supabase.from('items').select('id').eq('sku', 'CON-GLV-M100').maybeSingle()
if (!gloves) throw new Error('Gloves missing')

const { data: existing } = await supabase
  .from('stock_transfers')
  .select('id, notes, status, transfer_number')
  .in('notes', ['SEED-TRANSFER-DRAFT', 'SEED-TRANSFER-IN-TRANSIT'])

const notes = new Set((existing ?? []).map((row) => row.notes))

if (!notes.has('SEED-TRANSFER-DRAFT')) {
  const { data, error } = await supabase.rpc('create_stock_transfer', {
    p_from_branch_id: main.id,
    p_to_branch_id: north.id,
    p_notes: 'SEED-TRANSFER-DRAFT',
    p_lines: [{ item_id: gloves.id, qty: 5 }],
  })
  if (error) {
    console.error('create draft failed — apply transfers migration first:', error.message)
    process.exit(2)
  }
  console.log('draft', data)
} else {
  console.log('draft_exists')
}

if (!notes.has('SEED-TRANSFER-IN-TRANSIT')) {
  const { data: id, error } = await supabase.rpc('create_stock_transfer', {
    p_from_branch_id: main.id,
    p_to_branch_id: north.id,
    p_notes: 'SEED-TRANSFER-IN-TRANSIT',
    p_lines: [{ item_id: gloves.id, qty: 10 }],
  })
  if (error) throw error
  const { error: sendErr } = await supabase.rpc('send_stock_transfer', {
    p_transfer_id: id,
  })
  if (sendErr) throw sendErr
  console.log('in_transit', id)
} else {
  console.log('in_transit_exists')
}

const { data: list } = await supabase
  .from('stock_transfers')
  .select('transfer_number, status, notes')
  .in('notes', ['SEED-TRANSFER-DRAFT', 'SEED-TRANSFER-IN-TRANSIT'])

console.log(JSON.stringify({ transfers: list }, null, 2))
