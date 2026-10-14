import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { screenByPath } from '../lib/navigation.ts'

export function ScreenPage() {
  const location = useLocation()
  const screen = screenByPath(location.pathname)
  const { branchId, branches, profile } = useAuth()
  const branch = branches.find((item) => item.id === branchId)
  const unassigned = profile?.role !== 'owner' && branches.length === 0
  const needsBranch = screen && !screen.allowsAllBranches && branchId === 'all'

  return (
    <section className="rounded-dentaflow border border-line bg-surface p-6">
      <p className="text-sm font-medium text-muted">
        {branchId === 'all' ? 'All branches' : (branch?.name ?? 'No branch')}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{screen?.label ?? 'N.I SMILE'}</h1>
      {unassigned ? (
        <p className="mt-3 max-w-xl text-muted">An owner has not assigned you to a branch yet.</p>
      ) : needsBranch ? (
        <p className="mt-3 max-w-xl text-muted">Choose one branch in the header to use this screen.</p>
      ) : (
        <p className="mt-3 max-w-xl text-muted">This screen is ready for the next build step.</p>
      )}
    </section>
  )
}
