'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from './components/Logo'

interface User {
  id: string
  name: string
  role: string
  isAdmin: boolean
  isManager: boolean
  isBP: boolean
}

const icons: Record<string, React.ReactNode> = {
  Valores: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" /></svg>,
  Colaboradores: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Ciclos: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Avaliações: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  Dashboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-2a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" /></svg>,
  Ninebox: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 9h16M4 13h16M4 17h16M9 3v18M15 3v18" /></svg>,
  'Talent Card': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>,
  Slack: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
}

const adminLinks = [
  { href: '/admin/valores', label: 'Valores' },
  { href: '/admin/colaboradores', label: 'Colaboradores' },
  { href: '/admin/ciclos', label: 'Ciclos' },
  { href: '/avaliacoes', label: 'Avaliações' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ninebox', label: 'Ninebox' },
  { href: '/admin/slack', label: 'Slack' },
]

const managerLinks = [
  { href: '/avaliacoes', label: 'Avaliações' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ninebox', label: 'Ninebox' },
  { href: '/talent-card', label: 'Talent Card' },
]

const userLinks = [
  { href: '/avaliacoes', label: 'Avaliações' },
  { href: '/talent-card', label: 'Talent Card' },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [pathname])

  if (pathname === '/login' || pathname === '/') return null

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  const bpLinks = adminLinks.filter(l => l.label !== 'Slack')

  const links = user?.isAdmin ? adminLinks : user?.isBP ? bpLinks : user?.isManager ? managerLinks : userLinks

  return (
    <nav className="bg-g4-purple text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          <a href="/home" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="hidden sm:inline text-lg font-bold">Talent Review</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-3 lg:gap-6 text-sm flex-shrink-0">
            {links.map(link => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1 p-2 sm:p-0 rounded-lg sm:rounded-none ${isActive ? 'text-g4-lime font-medium bg-white/10 sm:bg-transparent' : 'text-white/70 hover:text-white hover:bg-white/10 sm:hover:bg-transparent'}`}
                  title={link.label}
                >
                  <span className="sm:hidden">{icons[link.label]}</span>
                  <span className="hidden sm:inline">{link.label}</span>
                </a>
              )
            })}
            {user && (
              <button
                onClick={handleLogout}
                className="ml-1 sm:ml-2 bg-white/10 hover:bg-white/20 p-2 sm:px-3 sm:py-1 rounded-lg transition-colors"
                title="Sair"
              >
                <span className="sm:hidden"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></span>
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
