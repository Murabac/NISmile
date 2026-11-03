/**
 * Ensures the four operational staff accounts.
 *
 * - owner@nismile.com — owner123 — all branches
 * - reception.hargeisa@nismile.com — receptionist123 — Hargeisa
 * - reception.jigjiga@nismile.com — receptionist123 — Jigjiga
 * - wholesale@nismile.com — wholesale123 — Wholesale + Hargeisa + Jigjiga
 *   (POS/wholesale sales, stock, transfers to clinics, Customers/AR WhatsApp)
 *
 * Run from app/: node scripts/seed-demo-users.mjs
 */
import { readFileSync } from 'node:fs'

function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
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

const CLINIC = 'N.I SMILE Oral care & Teeth whitening'
const WHOLESALE = 'N.I SMILE Wholesale'
const JIGJIGA = 'N.I SMILE Jigjiga'

/** @type {{ role: string, name: string, email: string, password: string, previousEmails: string[], branches: string[] }[]} */
const accounts = [
  {
    role: 'owner',
    name: 'N.I SMILE Owner',
    email: 'owner@nismile.com',
    password: 'owner123',
    previousEmails: ['owner@nismile.local'],
    branches: [CLINIC, WHOLESALE, JIGJIGA],
  },
  {
    role: 'receptionist',
    name: 'Reception Hargeisa',
    email: 'reception.hargeisa@nismile.com',
    password: 'receptionist123',
    previousEmails: ['reception.hargeisa@nismile.local'],
    branches: [CLINIC],
  },
  {
    role: 'receptionist',
    name: 'Reception Jigjiga',
    email: 'reception.jigjiga@nismile.com',
    password: 'receptionist123',
    previousEmails: ['reception.jigjiga@nismile.local'],
    branches: [JIGJIGA],
  },
  {
    role: 'branch_manager',
    name: 'Wholesale Manager',
    email: 'wholesale@nismile.com',
    password: 'wholesale123',
    previousEmails: ['wholesale@nismile.local'],
    // Wholesale stock/sales/AR + both clinics so they can transfer stock in
    branches: [WHOLESALE, CLINIC, JIGJIGA],
  },
]

const obsoleteDemoEmails = [
  'manager@nismile.local',
  'dentist@nismile.local',
  'storekeeper@nismile.local',
  'receptionist@nismile.local',
  'owner@nismile.local',
  'reception.hargeisa@nismile.local',
  'reception.jigjiga@nismile.local',
  'wholesale@nismile.local',
]

const authHeaders = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  'Content-Type': 'application/json',
}
const restHeaders = {
  ...authHeaders,
  'Accept-Profile': 'dental',
  'Content-Profile': 'dental',
  Prefer: 'return=representation',
}

async function listAllUsers() {
  const users = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: authHeaders,
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.msg || body.message || `list users ${res.status}`)
    const batch = body.users || []
    users.push(...batch)
    if (batch.length < 200) break
  }
  return users
}

const listed = await listAllUsers()
const byEmail = new Map(listed.map((user) => [user.email, user]))

const branchRes = await fetch(
  `${url}/rest/v1/branches?select=id,name&active=eq.true`,
  { headers: restHeaders },
)
const branchRows = await branchRes.json()
if (!Array.isArray(branchRows)) {
  console.error('Failed to load branches', branchRows)
  process.exit(1)
}
const branchByName = new Map(branchRows.map((b) => [b.name, b.id]))

for (const name of [CLINIC, WHOLESALE, JIGJIGA]) {
  if (!branchByName.has(name)) {
    console.error(`Missing active branch: ${name}`)
    process.exit(1)
  }
}

const keepUserIds = new Set()

for (const account of accounts) {
  let user = byEmail.get(account.email)
  if (!user) {
    for (const prev of account.previousEmails) {
      const legacy = byEmail.get(prev)
      if (legacy) {
        user = legacy
        break
      }
    }
  }

  if (!user) {
    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { name: account.name },
      }),
    })
    const body = await created.json()
    if (!created.ok) {
      console.error(account.email, body.msg || body.message || created.status)
      continue
    }
    user = body
    byEmail.set(account.email, user)
  } else {
    const updated = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: { name: account.name },
      }),
    })
    const body = await updated.json()
    if (!updated.ok) {
      console.error(account.email, body.msg || body.message || updated.status)
      continue
    }
    user = body
    byEmail.set(account.email, user)
  }

  keepUserIds.add(user.id)

  const profilePatch = await fetch(`${url}/rest/v1/profiles?user_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: restHeaders,
    body: JSON.stringify({ role: account.role, name: account.name }),
  })
  const patched = await profilePatch.json()
  if (!Array.isArray(patched) || patched.length === 0) {
    await fetch(`${url}/rest/v1/profiles`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify({
        user_id: user.id,
        role: account.role,
        name: account.name,
      }),
    })
  }

  await fetch(`${url}/rest/v1/user_branches?user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers: restHeaders,
  })
  const branchIds = account.branches.map((n) => branchByName.get(n))
  await fetch(`${url}/rest/v1/user_branches`, {
    method: 'POST',
    headers: restHeaders,
    body: JSON.stringify(branchIds.map((branch_id) => ({ user_id: user.id, branch_id }))),
  })

  console.log(`${account.email} / ${account.password} → ${account.branches.join(' | ')}`)
}

for (const email of obsoleteDemoEmails) {
  const user = byEmail.get(email)
  if (!user || keepUserIds.has(user.id)) continue
  await fetch(`${url}/rest/v1/user_branches?user_id=eq.${user.id}`, {
    method: 'DELETE',
    headers: restHeaders,
  })
  const del = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (!del.ok) {
    const body = await del.json().catch(() => ({}))
    console.error('Failed to delete', email, body.msg || body.message || del.status)
  } else {
    console.log(`deleted obsolete: ${email}`)
  }
}

console.log('Done.')
