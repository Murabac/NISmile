/**
 * Sample customer import for step 13. Requires dental_imports migration.
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
  .from('import_batches')
  .select('id, status')
  .eq('notes', 'SEED-IMPORT-CUSTOMERS')
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

const { data: batchId, error } = await supabase.rpc('create_import_batch', {
  p_import_type: 'customers',
  p_branch_id: branch.id,
  p_file_name: 'seed_customers.csv',
  p_notes: 'SEED-IMPORT-CUSTOMERS',
  p_rows: [
    {
      name: 'Seed Retail Patient',
      customer_type: 'retail',
      subtype: '',
      phone: '634111222',
      language: 'so',
      credit_limit: '',
      notes: 'SEED-IMPORT-CUSTOMERS',
    },
    {
      name: 'Seed Wholesale Pharmacy',
      customer_type: 'wholesale',
      subtype: 'pharmacy',
      phone: '+252634333444',
      language: 'ar',
      credit_limit: '2500',
      notes: 'SEED-IMPORT-CUSTOMERS',
    },
  ],
})
if (error) {
  console.error('create failed — apply imports migration first:', error.message)
  process.exit(2)
}

const { error: confirmErr } = await supabase.rpc('confirm_import', { p_batch_id: batchId })
if (confirmErr) throw confirmErr

console.log(JSON.stringify({ batchId, status: 'confirmed' }, null, 2))
