import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { roleLabel, screenByPath } from '../lib/navigation.ts'

type HeaderProps = {
  onOpenMenu: () => void
}

export function Header({ onOpenMenu }: HeaderProps) {
  const { profile, branches, branchId, setBranchId, signOut } = useAuth()
  const location = useLocation()
  const screen = screenByPath(location.pathname)
  const allowAll = Boolean(
    screen?.allowsAllBranches && profile?.role === 'owner' && branches.length > 1,
  )
  const [branchOpen, setBranchOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const branchRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!branchRef.current?.contains(event.target as Node)) setBranchOpen(false)
      if (!userRef.current?.contains(event.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const currentBranch = branches.find((branch) => branch.id === branchId)
  const branchLabel =
    branchId === 'all' ? 'All branches' : (currentBranch?.name ?? 'No branch')

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="rounded-dentaflow p-2 text-main lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative" ref={branchRef}>
          <button
            type="button"
            onClick={() => setBranchOpen((open) => !open)}
            className="flex max-w-[240px] items-center gap-2 rounded-dentaflow border border-line bg-canvas px-3 py-1.5 text-sm font-semibold text-main"
          >
            <Building2 className="h-4 w-4 shrink-0 text-flow-teal" />
            <span className="truncate">{branchLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>
          {branchOpen ? (
            <div className="absolute start-0 z-50 mt-1.5 w-72 rounded-dentaflow border border-line bg-surface py-1.5 shadow-lg">
              <p className="px-3 py-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Branch
              </p>
              {allowAll ? (
                <BranchOption
                  label="All branches"
                  detail="Combined view"
                  selected={branchId === 'all'}
                  onSelect={() => {
                    setBranchId('all')
                    setBranchOpen(false)
                  }}
                />
              ) : null}
              {branches.map((branch) => (
                <BranchOption
                  key={branch.id}
                  label={branch.name}
                  detail={branch.address ?? ''}
                  selected={branch.id === branchId}
                  onSelect={() => {
                    setBranchId(branch.id)
                    setBranchOpen(false)
                  }}
                />
              ))}
              {branches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No branch is assigned yet.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen((open) => !open)}
            className="rounded-dentaflow border border-line px-3 py-1.5 text-start"
          >
            <span className="block text-sm font-semibold text-main">{profile?.name}</span>
            <span className="block text-[11px] text-muted">
              {profile ? roleLabel(profile.role) : ''}
            </span>
          </button>
          {userOpen ? (
            <div className="absolute end-0 z-50 mt-1.5 w-44 rounded-dentaflow border border-line bg-surface py-1 shadow-lg">
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full px-3 py-2 text-start text-sm text-main hover:bg-subtle"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function BranchOption({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string
  detail: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm ${
        selected ? 'bg-flow-teal/10 font-semibold text-action' : 'text-main hover:bg-subtle'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {detail ? <span className="block truncate text-[11px] text-muted">{detail}</span> : null}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-flow-teal" /> : null}
    </button>
  )
}
