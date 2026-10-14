/**
 * Creates or updates the five demo staff accounts used by the login quick buttons.
 * Run from app/: node --env-file=.env.local scripts/seed-demo-users.mjs
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

const password = 'dentaflow-demo'
const accounts = [
  { role: 'owner', name: 'Demo Owner', email: 'owner@nismile.local' },
  { role: 'branch_manager', name: 'Demo Manager', email: 'manager@nismile.local' },
  { role: 'receptionist', name: 'Demo Receptionist', email: 'receptionist@nismile.local' },
  { role: 'dentist', name: 'Demo Dentist', email: 'dentist@nismile.local' },
  { role: 'storekeeper', name: 'Demo Storekeeper', email: 'storekeeper@nismile.local' },
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

const listed = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
  headers: authHeaders,
})
const list = await listed.json()
const byEmail = new Map((list.users || []).map((user) => [user.email, user]))

const branchRes = await fetch(`${url}/rest/v1/branches?select=id&active=eq.true&limit=1`, {
  headers: restHeaders,
})
const branches = await branchRes.json()
const branchId = branches[0]?.id
if (!branchId) {
  console.error('No active branch in dental.branches')
  process.exit(1)
}

for (const account of accounts) {
  let user = byEmail.get(account.email)
  if (!user) {
    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: account.email,
        password,
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
  } else {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { name: account.name },
      }),
    })
  }

  await fetch(`${url}/rest/v1/profiles?user_id=eq.${user.id}`, {
    method: 'PATCH',
    headers: restHeaders,
    body: JSON.stringify({ role: account.role, name: account.name }),
  })

  const linkCheck = await fetch(
    `${url}/rest/v1/user_branches?user_id=eq.${user.id}&select=branch_id`,
    { headers: restHeaders },
  )
  const links = await linkCheck.json()
  if (!Array.isArray(links) || links.length === 0) {
    await fetch(`${url}/rest/v1/user_branches`, {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify({ user_id: user.id, branch_id: branchId }),
    })
  }

  console.log(`${account.role}: ${account.email}`)
}

console.log('Done. Password for all demo accounts:', password)
