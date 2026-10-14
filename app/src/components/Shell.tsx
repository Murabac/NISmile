import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { screenByPath } from '../lib/navigation.ts'
import { Header } from './Header.tsx'
import { Sidebar } from './Sidebar.tsx'

export function Shell() {
  const { session, loading, profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const screen = screenByPath(location.pathname)

  if (loading) {
    return <p className="p-8 text-muted">Loading…</p>
  }

  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <main className="p-8 text-main">
        <p>Could not load your staff profile.</p>
        <button type="button" onClick={() => void signOut()} className="mt-3 text-sm font-semibold text-flow-teal">
          Sign out
        </button>
      </main>
    )
  }

  if (screen && !screen.roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-canvas text-main">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-col lg:ms-64">
        <Header onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
