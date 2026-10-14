import { X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Logo } from './Logo.tsx'
import { screensForRole } from '../lib/navigation.ts'
import { useAuth } from '../lib/auth.tsx'

type SidebarProps = {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { profile } = useAuth()
  const items = profile ? screensForRole(profile.role) : []

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-[#144959] bg-sidebar text-sidebar-text transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#144959] px-4">
          <Logo size="sm" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-dentaflow p-1.5 text-sidebar-text lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-dentaflow px-3 py-2.5 text-xs font-medium ${
                    isActive
                      ? 'bg-flow-teal font-bold text-marine'
                      : 'text-[#C7DFDC] hover:bg-[#144959] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-marine' : item.promo ? 'text-coral' : 'text-flow-teal'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="shrink-0 border-t border-[#144959] bg-[#092B36] p-3 text-[11px] text-[#A6C2C7]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-green" />
            N.I SMILE
          </span>
        </div>
      </aside>
    </>
  )
}
