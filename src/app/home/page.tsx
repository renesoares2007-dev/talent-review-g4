'use client'
import { useEffect, useState } from 'react'

interface User {
  id: string
  name: string
  role: string
  department: string
  isAdmin: boolean
  isManager: boolean
}

export default function HomePage() {
  const [stats, setStats] = useState({ employees: 0, cycles: 0, evaluations: 0 })
  const [pendingCount, setPendingCount] = useState(0)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      const u = JSON.parse(stored)
      setUser(u)

      if (u.isAdmin) {
        Promise.all([
          fetch('/api/employees').then(r => r.json()),
          fetch('/api/cycles').then(r => r.json()),
          fetch('/api/evaluations').then(r => r.json()),
        ]).then(([employees, cycles, evaluations]) => {
          setStats({
            employees: employees.length,
            cycles: cycles.length,
            evaluations: evaluations.length,
          })
        }).catch(() => {})
      } else {
        fetch('/api/evaluations')
          .then(r => r.json())
          .then((evals: { evaluatorId: string; status: string }[]) => {
            const pending = evals.filter(e => e.evaluatorId === u.id && e.status !== 'completed').length
            setPendingCount(pending)
          })
          .catch(() => {})
      }
    }
  }, [])

  // SVG icons as inline components
  const icons: Record<string, React.ReactNode> = {
    valores: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    colaboradores: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    ciclos: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" /></svg>,
    avaliacoes: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>,
    dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>,
    ninebox: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
    talentcard: <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  }

  const adminCards = [
    { href: '/admin/valores', title: 'Gestao de Valores', desc: 'Cadastre valores e comportamentos da empresa', icon: 'valores', color: 'text-g4-gold' },
    { href: '/admin/colaboradores', title: 'Colaboradores', desc: 'Gerencie colaboradores e estrutura organizacional', icon: 'colaboradores', color: 'text-g4-purple' },
    { href: '/admin/ciclos', title: 'Ciclos de Avaliacao', desc: 'Crie e gerencie ciclos de avaliacao', icon: 'ciclos', color: 'text-g4-green' },
    { href: '/avaliacoes', title: 'Avaliacoes', desc: 'Realize autoavaliacoes e avaliacoes de equipe', icon: 'avaliacoes', color: 'text-g4-purple' },
    { href: '/dashboard', title: 'Dashboard do Gestor', desc: 'Visao consolidada da equipe', icon: 'dashboard', color: 'text-g4-burgundy' },
    { href: '/ninebox', title: 'Matriz Ninebox', desc: 'Posicionamento de colaboradores na matriz', icon: 'ninebox', color: 'text-g4-magenta' },
  ]

  const managerCards = [
    { href: '/avaliacoes', title: 'Avaliacoes', desc: pendingCount > 0 ? `Voce tem ${pendingCount} avaliacao(oes) pendente(s)` : 'Realize avaliacoes da sua equipe', icon: 'avaliacoes', color: 'text-g4-purple' },
    { href: '/dashboard', title: 'Dashboard do Gestor', desc: 'Visao consolidada da sua equipe', icon: 'dashboard', color: 'text-g4-burgundy' },
    { href: '/ninebox', title: 'Matriz Ninebox', desc: 'Posicionamento da equipe na matriz', icon: 'ninebox', color: 'text-g4-green' },
    { href: '/talent-card', title: 'Talent Card', desc: 'Veja seus resultados e plano de desenvolvimento', icon: 'talentcard', color: 'text-g4-gold' },
  ]

  const userCards = [
    { href: '/avaliacoes', title: 'Avaliacoes', desc: pendingCount > 0 ? `Voce tem ${pendingCount} avaliacao(oes) pendente(s)` : 'Realize suas avaliacoes', icon: 'avaliacoes', color: 'text-g4-purple' },
    { href: '/talent-card', title: 'Talent Card', desc: 'Veja seus resultados e plano de desenvolvimento', icon: 'talentcard', color: 'text-g4-gold' },
  ]

  const cards = user?.isAdmin ? adminCards : user?.isManager ? managerCards : userCards

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-g4-purple">
          {user ? `Ola, ${user.name.split(' ')[0]}!` : 'Talent Review G4'}
        </h1>
        <p className="text-g4-burgundy mt-1">{user?.role || ''}</p>
      </div>

      {user?.isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-4xl font-bold text-g4-purple">{stats.employees}</div>
            <div className="text-gray-500 mt-1">Colaboradores</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-4xl font-bold text-g4-green">{stats.cycles}</div>
            <div className="text-gray-500 mt-1">Ciclos de Avaliacao</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <div className="text-4xl font-bold text-g4-magenta">{stats.evaluations}</div>
            <div className="text-gray-500 mt-1">Avaliacoes</div>
          </div>
        </div>
      )}

      {!user?.isAdmin && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div>
            <p className="font-medium text-amber-800">Avaliacao(oes) pendente(s)</p>
            <p className="text-sm text-amber-600">Complete suas avaliacoes para o ciclo ativo</p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${user?.isAdmin ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {cards.map(item => (
          <a key={item.href} href={item.href}
            className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow border border-gray-100 flex items-start gap-4">
            <div className={`${item.color} mt-0.5 flex-shrink-0`}>
              {icons[item.icon]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
