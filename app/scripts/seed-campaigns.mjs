/**
 * Seed a sample promotion campaign (step 25).
 * Prefers RETAIL-HYG-15, else WS-BOX10-FREE1. Opt-in audience only.
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
  .from('campaigns')
  .select('id, name')
  .like('name', 'SEED-CAMPAIGN:%')
  .limit(1)
  .maybeSingle()

if (existing) {
  console.log(JSON.stringify({ ok: true, skipped: existing }, null, 2))
  process.exit(0)
}

let { data: promo } = await supabase
  .from('promotions')
  .select('id, code, name')
  .eq('code', 'RETAIL-HYG-15')
  .eq('notify_whatsapp', true)
  .maybeSingle()

if (!promo) {
  const res = await supabase
    .from('promotions')
    .select('id, code, name')
    .eq('code', 'WS-BOX10-FREE1')
    .eq('notify_whatsapp', true)
    .maybeSingle()
  promo = res.data
}

if (!promo) {
  console.log(JSON.stringify({ ok: true, skipped: 'no sample promotion with notify_whatsapp' }, null, 2))
  process.exit(0)
}

const { data: audience, error: audErr } = await supabase.rpc('list_promotion_audience', {
  p_promotion_id: promo.id,
})
if (audErr) {
  console.error(audErr)
  console.error('Apply migration 20261014190000_dental_campaigns.sql first.')
  process.exit(1)
}

if (!audience?.length) {
  const { data: draft, error } = await supabase
    .from('campaigns')
    .insert({
      name: 'SEED-CAMPAIGN: preview empty audience',
      promotion_id: promo.id,
      kind: 'promotion_announcement',
      status: 'draft',
      scheduled_at: new Date().toISOString(),
      target_count: 0,
      enqueued_count: 0,
    })
    .select('id')
    .single()
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, draft: draft.id, audience: 0 }, null, 2))
  process.exit(0)
}

const { data: campaignId, error } = await supabase.rpc('enqueue_promotion_campaign', {
  p_promotion_id: promo.id,
  p_kind: 'promotion_announcement',
  p_scheduled_at: new Date().toISOString(),
  p_name: 'SEED-CAMPAIGN: Hygiene / wholesale announce',
})
if (error) {
  console.error(error)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      campaign_id: campaignId,
      promotion: promo.code,
      audience: audience.length,
      note: 'Process due on /whatsapp to send via Meta (test allowlist).',
    },
    null,
    2,
  ),
)
