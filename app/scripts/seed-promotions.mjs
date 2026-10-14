/**
 * Apply promotions sample seed (step 23) via service role SQL file contents.
 * Prefer: supabase db execute -f supabase/seed/20261014171000_seed_promotions_sample.sql
 * This script upserts the three sample promos if the migration is already applied.
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

const { data: existing, error: listErr } = await supabase
  .from('promotions')
  .select('code')
  .in('code', ['WS-BOX10-FREE1', 'RETAIL-HYG-15', 'CHECKUP-FLAT18'])

if (listErr) {
  console.error(listErr)
  console.error('Apply migration 20261014170000_dental_promotions.sql first.')
  process.exit(1)
}

if ((existing ?? []).length >= 3) {
  console.log(JSON.stringify({ ok: true, skipped: 'sample promotions already present', codes: existing }, null, 2))
  process.exit(0)
}

const { data: branch } = await supabase.from('branches').select('id').eq('active', true).order('created_at').limit(1).maybeSingle()
const { data: gloves } = await supabase.from('items').select('id').eq('sku', 'CON-GLV-M100').eq('active', true).maybeSingle()
const { data: srv1 } = await supabase.from('services').select('id').eq('code', 'SRV-001').eq('active', true).maybeSingle()
const { data: srv2 } = await supabase.from('services').select('id').eq('code', 'SRV-002').eq('active', true).maybeSingle()

if (!branch?.id) {
  console.error('No active branch')
  process.exit(1)
}

const samples = [
  {
    code: 'WS-BOX10-FREE1',
    name: 'Wholesale: Buy 10 Boxes, Get 1 Free',
    description: 'Automatic complimentary box on qualifying bulk glove orders.',
    promo_type: 'buy_x_get_y',
    audience: 'wholesale',
    scope: 'items',
    buy_qty: 10,
    get_qty: 1,
    starts_at: '2026-10-01T00:00:00+03:00',
    ends_at: '2026-11-30T23:59:59+03:00',
    status: 'active',
    notify_whatsapp: true,
    whatsapp_message_en:
      'Wholesale Special: Buy 10 boxes of clinical consumables and receive 1 box completely FREE! Valid until Nov 30.',
    whatsapp_message_so:
      'Dalab gaar ah oo Jumlo ah: Iibso 10 sanduuq oo qalabka ilkaha ah, waxaadna helaysaa 1 sanduuq oo BILAASH ah! Ku habboon rugaha iyo farmasiyada.',
    whatsapp_message_ar:
      'عرض خاص لعملاء الجملة: اشترِ 10 علب من المستلزمات الطبية واحصل على علبة واحدة مجاناً! العرض سارٍ حتى 30 نوفمبر.',
    published_at: new Date().toISOString(),
    targets: gloves?.id ? [{ target_kind: 'item', item_id: gloves.id }] : [],
    branches: [],
  },
  {
    code: 'RETAIL-HYG-15',
    name: 'Dental Hygiene Month - 15% Off Cleaning & Whitening',
    description: '15% discount at checkout on scaling, polishing and in-clinic whitening.',
    promo_type: 'percentage',
    audience: 'retail',
    scope: 'services',
    percent_off: 15,
    starts_at: '2026-10-05T00:00:00+03:00',
    ends_at: '2026-10-31T23:59:59+03:00',
    status: 'active',
    notify_whatsapp: true,
    whatsapp_message_en:
      'Smile brighter this month! Enjoy 15% off professional dental cleaning and laser whitening at N.I SMILE Oral care & Teeth whitening.',
    whatsapp_message_so:
      "Bisha Nadaafadda Ilkaha! Ka faa'iidayso 15% qiimo dhimis ah nadiifinta iyo caddaynta ilkaha ee N.I SMILE Oral care & Teeth whitening.",
    whatsapp_message_ar:
      'شهر صحة الفم والأسنان! استمتع بخصم 15% على تنظيف وتبييض الأسنان لدى N.I SMILE Oral care & Teeth whitening.',
    published_at: new Date().toISOString(),
    targets: [
      ...(srv1?.id ? [{ target_kind: 'service', service_id: srv1.id }] : []),
      ...(srv2?.id ? [{ target_kind: 'service', service_id: srv2.id }] : []),
    ],
    branches: [],
  },
  {
    code: 'CHECKUP-FLAT18',
    name: 'Student & Senior Check-up Package ($7 Off)',
    description: 'Fixed amount off diagnostic consultation services at checkout.',
    promo_type: 'fixed_amount',
    audience: 'retail',
    scope: 'services',
    amount_off: 7,
    starts_at: '2026-09-15T00:00:00+03:00',
    ends_at: '2026-12-31T23:59:59+03:00',
    status: 'active',
    notify_whatsapp: false,
    whatsapp_message_en: 'Special consultation discount now available at N.I SMILE Oral care & Teeth whitening.',
    whatsapp_message_so: 'Qiimo dhimis baaritaan ilko ah ee N.I SMILE Oral care & Teeth whitening.',
    whatsapp_message_ar: 'خصم خاص على الاستشارة لدى N.I SMILE Oral care & Teeth whitening.',
    published_at: new Date().toISOString(),
    targets: srv1?.id ? [{ target_kind: 'service', service_id: srv1.id }] : [],
    branches: [branch.id],
  },
]

const have = new Set((existing ?? []).map((r) => r.code))
const created = []

for (const sample of samples) {
  if (have.has(sample.code)) continue
  const { targets, branches, ...row } = sample
  const { data: promo, error } = await supabase.from('promotions').insert(row).select('id, code').single()
  if (error) {
    console.error(sample.code, error)
    process.exit(1)
  }
  if (targets.length) {
    const { error: tErr } = await supabase
      .from('promotion_targets')
      .insert(targets.map((t) => ({ ...t, promotion_id: promo.id })))
    if (tErr) {
      console.error('targets', tErr)
      process.exit(1)
    }
  }
  if (branches.length) {
    const { error: bErr } = await supabase
      .from('promotion_branches')
      .insert(branches.map((branch_id) => ({ promotion_id: promo.id, branch_id })))
    if (bErr) {
      console.error('branches', bErr)
      process.exit(1)
    }
  }
  created.push(promo.code)
}

console.log(JSON.stringify({ ok: true, created }, null, 2))
