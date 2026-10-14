/**
 * Seeds products and services from the N.I SMILE Excel catalog.
 *
 * From app/: node --env-file=.env.local scripts/seed-nismile-catalog.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const root = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync(join(root, '../.env.local'), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=')
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
        }),
    )
  } catch {
    return process.env
  }
}

const env = { ...process.env, ...loadEnv() }
const url = env.VITE_SUPABASE_URL
const service = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'dental',
  'Content-Profile': 'dental',
  Prefer: 'return=representation',
}

async function dental(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${text}`)
  }
  return body
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function unitFor(type, sku) {
  if (type === 'Package') return 'Kit'
  if (type === 'Wholesale') return sku === 'WHL-001' ? 'Carton' : 'Kit'
  return 'Unit'
}

function pricesFor(base, type) {
  const basePrice = Number(base)
  // Clinical services: patient (retail) price only — no wholesale list.
  if (type === 'Service') {
    return [{ price_list: 'retail', min_qty: 1, price: roundMoney(basePrice) }]
  }
  if (type === 'Wholesale') {
    return [
      { price_list: 'wholesale', min_qty: 1, price: roundMoney(basePrice) },
      { price_list: 'retail', min_qty: 1, price: roundMoney(basePrice) },
    ]
  }
  // Products and packages: retail + wholesale quantity tiers.
  return [
    { price_list: 'retail', min_qty: 1, price: roundMoney(basePrice) },
    { price_list: 'retail', min_qty: 10, price: roundMoney(basePrice * 0.9) },
    { price_list: 'retail', min_qty: 50, price: roundMoney(basePrice * 0.8) },
    { price_list: 'wholesale', min_qty: 1, price: roundMoney(basePrice * 0.9) },
    { price_list: 'wholesale', min_qty: 50, price: roundMoney(basePrice * 0.8) },
  ]
}

const workbook = XLSX.readFile(join(root, 'data/NI_Smile_Products_and_Services_Catalog.xlsx'))
const sheet = workbook.Sheets['Products & Services Catalog']
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
const headerIndex = rows.findIndex((row) => row[0] === 'Item ID')
if (headerIndex < 0) {
  console.error('Could not find Item ID header row')
  process.exit(1)
}

const catalog = rows
  .slice(headerIndex + 1)
  .filter((row) => row[0] && row[2])
  .map((row) => ({
    sku: String(row[0]).trim(),
    category: String(row[1]).trim(),
    name: String(row[2]).trim(),
    type: String(row[3]).trim(),
    base: Number(row[4]),
    taxRate: Number(row[5] ?? 0),
    description: row[9] ? String(row[9]).trim() : null,
  }))

const productRows = catalog.filter((row) => row.type !== 'Service')
const serviceRows = catalog.filter((row) => row.type === 'Service')

const taxRatesNeeded = [
  { name: 'Goods sales tax', rate: 0.05 },
  { name: 'Exempt', rate: 0 },
]

const existingTaxes = await dental('tax_rates?select=id,name,rate')
const taxByName = new Map(existingTaxes.map((row) => [row.name.toLowerCase(), row]))
for (const tax of taxRatesNeeded) {
  const key = tax.name.toLowerCase()
  if (taxByName.has(key)) continue
  const created = await dental('tax_rates', {
    method: 'POST',
    body: JSON.stringify({ name: tax.name, rate: tax.rate, active: true }),
  })
  taxByName.set(key, created[0])
  console.log('tax rate:', tax.name)
}

function taxIdFor(rate) {
  const match = [...taxByName.values()].find((row) => Number(row.rate) === Number(rate))
  if (match) return match.id
  return taxByName.get(rate === 0 ? 'exempt' : 'goods sales tax')?.id ?? null
}

const categoryNames = [...new Set(catalog.map((row) => row.category))]
const existingCategories = await dental('categories?select=id,name')
const categoryByName = new Map(existingCategories.map((row) => [row.name.toLowerCase(), row]))
for (const name of categoryNames) {
  const key = name.toLowerCase()
  if (categoryByName.has(key)) continue
  const created = await dental('categories', {
    method: 'POST',
    body: JSON.stringify({ name, active: true }),
  })
  categoryByName.set(key, created[0])
  console.log('category:', name)
}

const existingItems = await dental('items?select=id,sku')
const itemBySku = new Map(existingItems.map((row) => [row.sku, row]))

for (const row of productRows) {
  const category = categoryByName.get(row.category.toLowerCase())
  if (!category) throw new Error(`Missing category ${row.category}`)
  const payload = {
    sku: row.sku,
    barcode: null,
    name: row.name,
    category_id: category.id,
    unit: unitFor(row.type, row.sku),
    cost: 0,
    reorder_level: row.type === 'Wholesale' ? 1 : 5,
    tax_rate_id: taxIdFor(row.taxRate),
    active: true,
  }

  let itemId = itemBySku.get(row.sku)?.id
  if (itemId) {
    await dental(`items?id=eq.${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  } else {
    const created = await dental('items', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    itemId = created[0].id
    itemBySku.set(row.sku, created[0])
  }

  await dental(`item_prices?item_id=eq.${itemId}`, { method: 'DELETE' })
  await dental('item_prices', {
    method: 'POST',
    body: JSON.stringify(
      pricesFor(row.base, row.type).map((tier) => ({
        item_id: itemId,
        ...tier,
      })),
    ),
  })
  console.log(`item ${row.sku}: ${row.name}`)
}

const existingServices = await dental('services?select=id,code')
const serviceByCode = new Map(existingServices.map((row) => [row.code, row]))

for (const row of serviceRows) {
  const category = categoryByName.get(row.category.toLowerCase())
  if (!category) throw new Error(`Missing category ${row.category}`)
  const payload = {
    code: row.sku,
    name: row.name,
    category_id: category.id,
    description: row.description,
    duration_minutes: null,
    tax_rate_id: taxIdFor(row.taxRate),
    active: true,
  }

  let serviceId = serviceByCode.get(row.sku)?.id
  if (serviceId) {
    await dental(`services?id=eq.${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  } else {
    const created = await dental('services', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    serviceId = created[0].id
    serviceByCode.set(row.sku, created[0])
  }

  await dental(`service_prices?service_id=eq.${serviceId}`, { method: 'DELETE' })
  await dental('service_prices', {
    method: 'POST',
    body: JSON.stringify(
      pricesFor(row.base, 'Service').map((tier) => ({
        service_id: serviceId,
        ...tier,
      })),
    ),
  })
  console.log(`service ${row.sku}: ${row.name}`)
}

console.log(`Seeded ${productRows.length} items and ${serviceRows.length} services.`)
