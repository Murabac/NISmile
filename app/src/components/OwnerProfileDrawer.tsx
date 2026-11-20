import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth.tsx'
import { roleLabel } from '../lib/navigation.ts'
import {
  updateOwnAuthCredentials,
  updateOwnProfileNames,
} from '../lib/staff/api.ts'
import { Drawer } from './Drawer.tsx'

type Props = {
  open: boolean
  onClose: () => void
}

export function OwnerProfileDrawer({ open, onClose }: Props) {
  const { profile, session, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !profile) return
    setName(profile.name)
    setDisplayName(profile.display_name ?? '')
    setEmail(session?.user.email ?? '')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setInfo(null)
  }, [open, profile, session?.user.email])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile || profile.role !== 'owner') {
      setError('Owner access only.')
      return
    }
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email is required.')
      return
    }
    if (password || confirmPassword) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Password and confirmation do not match.')
        return
      }
    }

    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      await updateOwnProfileNames({ name, displayName })

      const currentEmail = (session?.user.email ?? '').toLowerCase()
      const nextEmail = email.trim().toLowerCase()
      const emailChanged = nextEmail !== currentEmail
      const { emailChangePending } = await updateOwnAuthCredentials({
        email: emailChanged ? nextEmail : null,
        password: password || null,
      })

      await refreshProfile()
      setPassword('')
      setConfirmPassword('')

      if (emailChanged && emailChangePending) {
        setInfo(
          'Profile saved. Check the new email inbox to confirm the address change before it becomes active.',
        )
      } else if (emailChanged) {
        setInfo('Profile saved. Email updated.')
      } else {
        setInfo('Profile saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Your profile"
      subtitle="Update your staff details, login email, and password."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-dentaflow border border-line px-4 text-sm font-bold"
          >
            Close
          </button>
          <button
            type="submit"
            form="owner-profile-form"
            disabled={saving}
            className="h-10 rounded-dentaflow bg-marine px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <form id="owner-profile-form" onSubmit={onSubmit} className="space-y-4">
        <p className="rounded-dentaflow bg-canvas px-3 py-2 text-xs text-muted">
          Role: <span className="font-semibold text-main">{roleLabel('owner')}</span> (read-only)
        </p>

        <label className="block text-sm font-semibold">
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
        </label>

        <label className="block text-sm font-semibold">
          Name shown to patients
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={60}
            placeholder="Used on WhatsApp as dentist / team name"
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
          <span className="mt-1 block text-[11px] font-normal text-muted">
            Blank uses your staff name (or team wording) on patient messages.
          </span>
        </label>

        <label className="block text-sm font-semibold">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
          />
          <span className="mt-1 block text-[11px] font-normal text-muted">
            Changing email may require clicking a confirmation link before it is active.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to keep"
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat new password"
              className="mt-1 h-10 w-full rounded-dentaflow border border-line bg-canvas px-3 font-normal"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-status-red">{error}</p> : null}
        {info ? <p className="text-sm text-status-green">{info}</p> : null}
      </form>
    </Drawer>
  )
}
