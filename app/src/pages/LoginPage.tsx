import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Logo } from '../components/Logo.tsx'
import { useAuth } from '../lib/auth.tsx'
import { demoAccounts, type DemoAccount } from '../lib/demoAccounts.ts'

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [pendingRole, setPendingRole] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const error =
      mode === 'sign-in'
        ? await signIn(email, password)
        : await signUp(name.trim(), email, password)
    setMessage(error)
    setPending(false)
  }

  async function quickLogin(account: DemoAccount) {
    setPending(true)
    setPendingRole(account.role)
    setMessage(null)
    setEmail(account.email)
    setPassword(account.password)
    setMode('sign-in')
    const error = await signIn(account.email, account.password)
    setMessage(error)
    setPending(false)
    setPendingRole(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8 text-main">
      <div className="w-full max-w-md rounded-dentaflow border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo size="md" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-base font-extrabold tracking-tight text-marine dark:text-[#E8F2F0]">
              N.I SMILE
            </p>
            <p className="truncate text-[10px] font-medium tracking-[0.04em] text-muted uppercase">
              Oral care & Teeth whitening
            </p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h1>
        <p className="mt-1 text-sm text-muted">
          Staff access for N.I SMILE Oral care & Teeth whitening.
        </p>

        {mode === 'sign-in' ? (
          <div className="mt-5">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Quick login</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  disabled={pending}
                  onClick={() => void quickLogin(account)}
                  className="rounded-dentaflow border border-line bg-canvas px-3 py-2.5 text-start disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-main">
                    {pendingRole === account.role ? 'Signing in…' : account.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
          <span className="h-px flex-1 bg-line" />
          or email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'create' ? (
            <label className="block text-sm font-semibold">
              Name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
              />
            </label>
          ) : null}
          <label className="block text-sm font-semibold">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              required
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          {message ? <p className="text-sm text-status-red">{message}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full rounded-dentaflow bg-marine text-sm font-bold text-white disabled:opacity-60"
          >
            {pending && !pendingRole
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === 'sign-in' ? 'create' : 'sign-in'))
            setMessage(null)
          }}
          className="mt-4 text-sm font-semibold text-flow-teal"
        >
          {mode === 'sign-in' ? 'Create a staff account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}
