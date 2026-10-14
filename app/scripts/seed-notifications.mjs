/**
 * Seed so/ar message templates + one queued reminder (step 20).
 * Requires migration 20261014120000_dental_notification_queue.sql.
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

const templates = [
  {
    kind: 'appointment_confirmation',
    language: 'so',
    name: 'Appointment confirmation (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nBallantaada ilkaha ee N.I SMILE Oral care & Teeth whitening waa la qabtay.\nTaariikhda: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.\n\nJawab 1 si aad u xaqiijiso, ama 2 si aad u joojiso.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_confirmation',
    language: 'ar',
    name: 'Appointment confirmation (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nتم حجز موعدكم لدى N.I SMILE Oral care & Teeth whitening.\nالتاريخ: {{2}}، الساعة: {{3}}.\nالطبيب: {{4}}.\n\nيرجى الرد بـ 1 للتأكيد أو 2 للإلغاء.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reminder_24h',
    language: 'so',
    name: '24h appointment reminder (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nWaxaan kugu xusuusinaynaa ballantaada ilkaha ee N.I SMILE Oral care & Teeth whitening: {{2}}.\nTaariikhda: {{3}} saacadda {{4}}.\nDhakhtarka: {{5}}.\n\nJawab 1 si aad u xaqiijiso, ama 2 si aad u joojiso.',
    variables: ['patient_name', 'branch_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reminder_24h',
    language: 'ar',
    name: '24h appointment reminder (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nنود تذكيركم بموعدكم الطبي لدى N.I SMILE Oral care & Teeth whitening ({{2}}).\nالتاريخ: {{3}}، الساعة: {{4}}.\nالطبيب المعالج: {{5}}.\n\nيرجى الرد بـ 1 للتأكيد أو 2 للإلغاء.',
    variables: ['patient_name', 'branch_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reminder_2h',
    language: 'so',
    name: '2h appointment reminder (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nBallantaada ee N.I SMILE waxay ku ag tahay 2 saacadood: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.\n\nJawab 1 xaqiiji / 2 jooji.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reminder_2h',
    language: 'ar',
    name: '2h appointment reminder (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nموعدكم لدى N.I SMILE بعد ساعتين تقريباً: {{2}} الساعة {{3}}.\nالطبيب: {{4}}.\n\nالرد 1 للتأكيد / 2 للإلغاء.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reschedule',
    language: 'so',
    name: 'Reschedule notice (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nBallantaada waa la beddelay.\nWaqtiga cusub: {{2}} saacadda {{3}}.\nDhakhtarka: {{4}}.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_reschedule',
    language: 'ar',
    name: 'Reschedule notice (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nتم تغيير موعدكم.\nالوقت الجديد: {{2}} الساعة {{3}}.\nالطبيب: {{4}}.',
    variables: ['patient_name', 'date', 'time', 'dentist_name'],
  },
  {
    kind: 'appointment_cancel',
    language: 'so',
    name: 'Cancel notice (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nBallantaada ee {{2}} saacadda {{3}} waa la joojiyay. Nala soo xiriir si aad u qabsato mid cusub.',
    variables: ['patient_name', 'date', 'time'],
  },
  {
    kind: 'appointment_cancel',
    language: 'ar',
    name: 'Cancel notice (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nتم إلغاء موعدكم بتاريخ {{2}} الساعة {{3}}. تواصلوا معنا لحجز موعد جديد.',
    variables: ['patient_name', 'date', 'time'],
  },
  {
    kind: 'receipt_notice',
    language: 'so',
    name: 'Receipt notice (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nMahadsanid. Rasiidkaaga N.I SMILE #{{2}} lacagtiisu waa ${{3}}. PDF-ka waa Ingiriis.',
    variables: ['customer_name', 'receipt_number', 'amount'],
  },
  {
    kind: 'receipt_notice',
    language: 'ar',
    name: 'Receipt notice (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nشكراً لكم. إيصال N.I SMILE رقم {{2}} بمبلغ ${{3}}. ملف PDF بالإنجليزية.',
    variables: ['customer_name', 'receipt_number', 'amount'],
  },
  {
    kind: 'invoice_notice',
    language: 'so',
    name: 'Invoice notice (Somali)',
    body_text:
      'Mudane/Marwo {{1}},\n\nFakturaddaada N.I SMILE #{{2}} lacagtiisu waa ${{3}}. PDF-ka waa Ingiriis.',
    variables: ['customer_name', 'invoice_number', 'amount'],
  },
  {
    kind: 'invoice_notice',
    language: 'ar',
    name: 'Invoice notice (Arabic)',
    body_text:
      'عزيزي/عزيزتي {{1}}،\n\nفاتورتكم من N.I SMILE رقم {{2}} بمبلغ ${{3}}. ملف PDF بالإنجليزية.',
    variables: ['customer_name', 'invoice_number', 'amount'],
  },
]

for (const tpl of templates) {
  const { data: existing } = await supabase
    .from('message_templates')
    .select('id')
    .eq('kind', tpl.kind)
    .eq('language', tpl.language)
    .maybeSingle()
  if (existing) continue
  const { error } = await supabase.from('message_templates').insert({
    ...tpl,
    category: 'utility',
    status: 'draft',
  })
  if (error) throw error
}

const { data: existingQueue } = await supabase
  .from('notification_queue')
  .select('id')
  .contains('params', { seed: 'SEED-NOTIFICATION-QUEUE' })
  .limit(1)
  .maybeSingle()

if (existingQueue) {
  console.log(JSON.stringify({ templates: 'ok', queue: 'exists' }, null, 2))
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

let { data: customer } = await supabase
  .from('customers')
  .select('id, phone, language')
  .eq('notes', 'SEED-APPOINTMENT-PATIENT')
  .maybeSingle()

if (!customer) {
  const { data: retail } = await supabase
    .from('customers')
    .select('id, phone, language')
    .eq('customer_type', 'retail')
    .eq('whatsapp_opt_in', true)
    .not('phone', 'is', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  customer = retail
}

if (!customer) {
  console.log(JSON.stringify({ templates: 'ok', queue: 'skipped-no-patient' }, null, 2))
  process.exit(0)
}

const scheduled = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)

const { data: queueId, error } = await supabase.rpc('enqueue_notification', {
  p_branch_id: branch.id,
  p_kind: 'appointment_reminder_24h',
  p_phone: null,
  p_language: null,
  p_customer_id: customer.id,
  p_params: {
    seed: 'SEED-NOTIFICATION-QUEUE',
    '1': 'Ayaan Abdi Mohamed',
    '2': 'N.I SMILE',
    '3': tomorrow.toISOString().slice(0, 10),
    '4': '10:30',
    '5': 'Demo Dentist',
  },
  p_scheduled_at: scheduled,
  p_related_type: 'seed',
  p_related_id: null,
})
if (error) throw error

console.log(JSON.stringify({ templates: 'ok', queue_id: queueId }, null, 2))
