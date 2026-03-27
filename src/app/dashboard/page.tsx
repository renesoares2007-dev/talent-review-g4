'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; isAdmin: boolean; isManager: boolean }
interface Employee { id: string; name: string; role: string; department: string; managerId: string | null; isManager: boolean }
interface Cycle { id: string; name: string; isActive: boolean }
interface Evaluation {
  id: string; cycleId: string; subjectId: string; evaluatorId: string; type: string; status: string
  cultureScore: number | null; resultsScore: number | null
  subject: { id: string; name: string; department: string; role: string }
}

function getSubordinateIds(managerId: string, employees: Employee[]): string[] {
  const direct = employees.filter(e => e.managerId === managerId).map(e => e.id)
  const indirect = direct.flatMap(id => getSubordinateIds(id, employees))
  return [...direct, ...indirect]
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedCycle, setSelectedCycle] = useState('')
  const [consolidating, setConsolidating] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    setUser(u)

    fetch('/api/employees').then(r => r.json()).then(setEmployees)
    fetch('/api/cycles').then(r => r.json()).then(setCycles)
    fetch('/api/evaluations').then(r => r.json()).then(setEvaluations)
  }, [router])

  // For non-admin managers, restrict to their team hierarchy
  const myTeamIds = user && !user.isAdmin
    ? getSubordinateIds(user.id, employees)
    : null // null = admin sees all

  const managers = user?.isAdmin
    ? employees.filter(e => e.isManager)
    : [] // Non-admin managers don't need the manager filter

  const team = (() => {
    if (myTeamIds) {
      // Non-admin: always show own team (direct + indirect)
      return employees.filter(e => myTeamIds.includes(e.id))
    }
    // Admin: filter by selected manager or show all
    return selectedManager ? employees.filter(e => e.managerId === selectedManager) : employees
  })()
  const cycleEvals = selectedCycle ? evaluations.filter(e => e.cycleId === selectedCycle) : evaluations

  const getEmployeeStatus = (empId: string) => {
    const empEvals = cycleEvals.filter(e => e.subjectId === empId)
    const self = empEvals.find(e => e.type === 'self')
    const manager = empEvals.find(e => e.type === 'manager')
    const stakeholders = empEvals.filter(e => e.type === 'stakeholder')
    return { self, manager, stakeholders, total: empEvals.length, completed: empEvals.filter(e => e.status === 'completed').length }
  }

  const consolidateEmployee = async (subjectId: string) => {
    if (!selectedCycle) return alert('Selecione um ciclo')
    setConsolidating(subjectId)
    await fetch('/api/consolidated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId: selectedCycle, subjectId }),
    })
    setConsolidating(null)
    alert('Consolidacao concluida! Veja o resultado no Ninebox ou Relatorio.')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Dashboard do Gestor</h1>

      <div className={`grid grid-cols-1 ${user?.isAdmin ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
        {user?.isAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gestor</label>
            <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
              <option value="">Todos os colaboradores</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo</label>
          <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
            <option value="">Todos os ciclos</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-2xl font-bold text-g4-purple">{team.length}</div>
          <div className="text-sm text-gray-500">Colaboradores</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {team.filter(e => getEmployeeStatus(e.id).completed === getEmployeeStatus(e.id).total && getEmployeeStatus(e.id).total > 0).length}
          </div>
          <div className="text-sm text-gray-500">Completas</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {team.filter(e => { const s = getEmployeeStatus(e.id); return s.completed > 0 && s.completed < s.total }).length}
          </div>
          <div className="text-sm text-gray-500">Em Andamento</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-2xl font-bold text-red-600">
            {team.filter(e => getEmployeeStatus(e.id).total === 0).length}
          </div>
          <div className="text-sm text-gray-500">Sem Avaliacao</div>
        </div>
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Auto</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Gestor</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Stakeholders</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Progresso</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {team.map(emp => {
              const status = getEmployeeStatus(emp.id)
              const statusIcon = (eval_: typeof status.self) => {
                if (!eval_) return <span className="text-gray-300">--</span>
                if (eval_.status === 'completed') return <span className="text-green-600">OK</span>
                return <span className="text-yellow-600">...</span>
              }
              return (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-800 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                  <td className="px-4 py-3 text-center">{statusIcon(status.self)}</td>
                  <td className="px-4 py-3 text-center">{statusIcon(status.manager)}</td>
                  <td className="px-4 py-3 text-center">{status.stakeholders.filter(s => s.status === 'completed').length}/{status.stakeholders.length}</td>
                  <td className="px-4 py-3">
                    {status.total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="bg-g4-purple h-2 rounded-full" style={{ width: `${(status.completed / status.total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{status.completed}/{status.total}</span>
                      </div>
                    ) : <span className="text-xs text-gray-400">N/A</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {status.completed === status.total && status.total > 0 && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => consolidateEmployee(emp.id)} disabled={consolidating === emp.id}
                          className="text-xs bg-g4-purple text-white px-2 py-1 rounded hover:bg-blue-800 disabled:opacity-50">
                          {consolidating === emp.id ? '...' : 'Consolidar'}
                        </button>
                        <a href={`/relatorio?cycleId=${selectedCycle}&subjectId=${emp.id}`}
                          className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700">Relatorio</a>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {team.length === 0 && <p className="text-gray-400 text-center py-8">Nenhum colaborador encontrado.</p>}
      </div>
    </div>
  )
}
