import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Logo } from '../components/Logo.tsx'
import { useAuth } from '../lib/auth.tsx'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const error = await signIn(email, password)
    setMessage(error)
    setPending(false)
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
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Staff access for N.I SMILE Oral care & Teeth whitening.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
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
              autoComplete="current-password"
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
            {pending ? 'Please wait…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
