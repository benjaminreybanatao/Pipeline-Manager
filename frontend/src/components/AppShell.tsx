import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useUsers } from '../api/hooks'
import { setCurrentUserId, useCurrentUserId } from '../store/currentUser'
import { setTheme, useTheme, type Theme } from '../store/theme'
import { BrandMark } from './BrandMark'
import { DemoBanner } from './DemoBanner'
import { Select, cx } from './ui'

const NAV = [
  { to: '/', label: 'Pipeline', end: true },
  { to: '/deals', label: 'Deals' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  const { data: users } = useUsers()
  const currentUserId = useCurrentUserId()
  const theme = useTheme()

  // No auth yet: default to the first user so the activity log has an author.
  useEffect(() => {
    if (users?.length && (currentUserId === null || !users.some((u) => u.id === currentUserId))) {
      setCurrentUserId(users[0].id)
    }
  }, [users, currentUserId])

  return (
    <div className="flex min-h-full flex-col">
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-5 w-auto shrink-0" />
            <span className="callout hidden text-xs text-muted sm:inline">Pipeline Manager</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-md border-b-2 px-2.5 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'border-brand text-ink'
                      : 'border-transparent text-ink-2 hover:bg-surface-2',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="theme">
              Theme
            </label>
            <Select
              id="theme"
              className="w-28"
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
            <label className="text-xs text-muted" htmlFor="acting-as">
              Acting as
            </label>
            <Select
              id="acting-as"
              className="w-48"
              value={currentUserId ?? ''}
              onChange={(event) => setCurrentUserId(Number(event.target.value))}
            >
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
