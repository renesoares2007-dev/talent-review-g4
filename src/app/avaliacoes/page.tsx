'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; name: string; isAdmin: boolean; isManager: boolean; isBP: boolean }
interface Employee { id: string; name: string; email: string; department: string; role: string; managerId: string | null }
interface Cycle { id: string; name: string; isActive: boolean }
interface Evaluation {
  id: string; cycleId: string; subjectId: string; evaluatorId: string; type: string; status: string
  subject: { id: string; name: string; department: string; role: string }
  evaluator: { id: string; name: string }
  cycle: { id: string; name: string }
}

function getSubordinateIds(managerId: string, employees: Employee[]): string[] {
  const direct = employees.filter(e => e.managerId === managerId).map(e => e.id)
  const indirect = direct.flatMap(id => getSubordinateIds(id, employees))
  return [...direct, ...indirect]
}

const RESET_OPTIONS = [
  { value: 'pending', label: 'Início (Pendente)', desc: 'Limpa tudo, volta ao início' },
  { value: 'culture', label: 'Cultura', desc: 'Refazer cultura e tudo depois' },
  { value: 'results', label: 'Resultados', desc: 'Manter cultura, refazer resultados em diante' },
  { value: 'strengths_improvements', label: 'Pontos Fortes/Melhorias', desc: 'Manter cultura e resultados, refazer pontos fortes/melhorias' },
  { value: 'tags', label: 'Tags', desc: 'Manter tudo, refazer apenas tags' },
]

export default function AvaliacoesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedCycle, setSelectedCycle] = useState('')
  const [stakeholderForm, setStakeholderForm] = useState<{ subjectId: string; stakeholders: { employeeId: string; name: string; email: string }[] } | null>(null)
  const [resetModal, setResetModal] = useState<{ evalId: string; evalName: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [projectValidation, setProjectValidation] = useState<Record<string, { total: number; validated: number }>>({})

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    setUser(JSON.parse(stored))

    fetch('/api/employees').then(r => r.json()).then(setEmployees)
    fetch('/api/cycles').then(r => r.json()).then(setCycles)
    fetch('/api/evaluations').then(r => r.json()).then((evals: Evaluation[]) => {
      setEvaluations(evals)
      // Load project validation status for manager evaluations
      const managerEvals = evals.filter((e: Evaluation) => e.type === 'manager' && e.status !== 'completed')
      managerEvals.forEach((ev: Evaluation) => {
        // Find the self-evaluation for same subject+cycle to get its projects
        const selfEval = evals.find((se: Evaluation) => se.subjectId === ev.subjectId && se.cycleId === ev.cycleId && se.type === 'self')
        if (selfEval) {
          fetch(`/api/projects?evaluationId=${selfEval.id}`)
            .then(r => r.json())
            .then((projects: { id: string; validated: boolean }[]) => {
              setProjectValidation(prev => ({
                ...prev,
                [ev.id]: { total: projects.length, validated: projects.filter(p => p.validated).length }
              }))
            })
        }
      })
    })
  }, [router])

  const createEvaluation = async (type: string, subjectId: string, evaluatorId: string) => {
    if (!selectedCycle) return alert('Selecione um ciclo')
    await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId: selectedCycle, subjectId, evaluatorId, type }),
    })
    const evals = await fetch('/api/evaluations').then(r => r.json())
    setEvaluations(evals)
  }

  const createStakeholderLinks = async () => {
    if (!stakeholderForm || !selectedCycle) return
    await fetch('/api/stakeholder-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId: selectedCycle, subjectId: stakeholderForm.subjectId, stakeholders: stakeholderForm.stakeholders }),
    })
    setStakeholderForm(null)
    const evals = await fetch('/api/evaluations').then(r => r.json())
    setEvaluations(evals)
  }

  const handleResetEvaluation = async (evalId: string, resetTo: string) => {
    setResetting(true)
    try {
      const res = await fetch('/api/evaluations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evalId, resetTo }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Erro ao resetar: ' + (err.error || 'Erro desconhecido'))
        setResetting(false)
        return
      }
      const evals = await fetch('/api/evaluations').then(r => r.json())
      setEvaluations(evals)
      setResetModal(null)
      alert('Avaliação retornada com sucesso!')
    } catch (err) {
      console.error(err)
      alert('Erro de conexão ao resetar avaliação')
    }
    setResetting(false)
  }

  const activeCycle = cycles.find(c => c.id === selectedCycle)

  // Hierarchy-based filtering
  const teamIds = user && !user.isAdmin && !user.isBP
    ? [user.id, ...getSubordinateIds(user.id, employees)]
    : null // null = show all (admin/BP)

  // Employees visible for creating evaluations
  const visibleEmployees = teamIds
    ? employees.filter(e => teamIds.includes(e.id))
    : employees

  // Evaluations visible: admin sees all, manager sees own + team's
  const visibleEvaluations = teamIds
    ? evaluations.filter(e => teamIds.includes(e.subjectId) || e.evaluatorId === user!.id)
    : evaluations

  // For regular employees: only show evaluations where they are the evaluator
  // For managers: only show pending/in_progress evaluations from their team
  const myPendingEvaluations = !user?.isAdmin && !user?.isBP && !user?.isManager
    ? visibleEvaluations.filter(e => e.evaluatorId === user!.id)
    : user?.isManager && !user?.isAdmin && !user?.isBP
      ? visibleEvaluations.filter(e => e.status !== 'completed')
      : visibleEvaluations

  // Subordinates only (excluding self) for manager team evaluation
  const subordinates = user ? employees.filter(e => getSubordinateIds(user.id, employees).includes(e.id)) : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Avaliações</h1>

      {/* Admin: full control panel */}
      {user?.isAdmin && !user?.isBP && (
        <>
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo</label>
                <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                  <option value="">Selecione um ciclo</option>
                  {cycles.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                  <option value="">Selecione</option>
                  {visibleEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => selectedEmployee && createEvaluation('self', selectedEmployee, selectedEmployee)}
                disabled={!selectedCycle || !selectedEmployee}
                className="bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark disabled:opacity-50">
                Iniciar Autoavaliação
              </button>
              <button onClick={() => {
                const emp = employees.find(e => e.id === selectedEmployee)
                if (emp?.managerId) createEvaluation('manager', selectedEmployee, emp.managerId)
                else alert('Colaborador não possui gestor definido')
              }}
                disabled={!selectedCycle || !selectedEmployee}
                className="bg-g4-green text-white px-4 py-2 rounded-lg hover:bg-g4-green-light disabled:opacity-50">
                Criar Avaliação do Gestor
              </button>
              <button onClick={() => selectedEmployee && setStakeholderForm({ subjectId: selectedEmployee, stakeholders: [{ employeeId: '', name: '', email: '' }, { employeeId: '', name: '', email: '' }] })}
                disabled={!selectedCycle || !selectedEmployee}
                className="bg-g4-gold text-g4-dark px-4 py-2 rounded-lg hover:bg-g4-gold-light disabled:opacity-50">
                Indicar Stakeholders
              </button>
            </div>
          </div>

        </>
      )}

      {/* Stakeholder form - available to all roles */}
      {stakeholderForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-8 border-2 border-amber-200">
          <h2 className="text-lg font-semibold text-g4-dark mb-4">Indicar 2 Stakeholders</h2>
          {stakeholderForm.stakeholders.map((sh, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 mb-3">
              <select value={sh.employeeId} onChange={e => {
                const emp = employees.find(emp => emp.id === e.target.value)
                const shs = [...stakeholderForm.stakeholders]
                shs[i] = { employeeId: e.target.value, name: emp?.name || '', email: emp?.email || '' }
                setStakeholderForm({ ...stakeholderForm, stakeholders: shs })
              }} className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                <option value="">Selecione stakeholder {i + 1}</option>
                {employees.filter(e => e.id !== stakeholderForm.subjectId).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input value={sh.name} readOnly className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-800" placeholder="Nome" />
              <input value={sh.email} readOnly className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-800" placeholder="Email" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={createStakeholderLinks} disabled={stakeholderForm.stakeholders.some(s => !s.employeeId)}
              className="bg-g4-gold text-g4-dark px-4 py-2 rounded-lg hover:bg-g4-gold-light disabled:opacity-50">
              Enviar Links
            </button>
            <button onClick={() => setStakeholderForm(null)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-800">Cancelar</button>
          </div>
        </div>
      )}

      {/* Regular user: stakeholder indication */}
      {user && !user.isAdmin && !user.isBP && !user.isManager && (
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo</label>
              <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                <option value="">Selecione um ciclo</option>
                {cycles.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => user && setStakeholderForm({ subjectId: user.id, stakeholders: [{ employeeId: '', name: '', email: '' }, { employeeId: '', name: '', email: '' }] })}
              disabled={!selectedCycle}
              className="bg-g4-gold text-g4-dark px-4 py-2 rounded-lg hover:bg-g4-gold-light disabled:opacity-50">
              Indicar Stakeholders
            </button>
          </div>
        </div>
      )}

      {/* Manager: self-evaluation + team evaluations */}
      {user && !user.isAdmin && !user.isBP && user.isManager && (
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo</label>
              <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                <option value="">Selecione um ciclo</option>
                {cycles.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador do Time</label>
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
                <option value="">Selecione</option>
                {subordinates.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => user && createEvaluation('self', user.id, user.id)}
              disabled={!selectedCycle}
              className="bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark disabled:opacity-50">
              Fazer Minha Autoavaliação
            </button>
            <button onClick={() => {
              if (!selectedEmployee) return alert('Selecione um colaborador do time')
              createEvaluation('manager', selectedEmployee, user.id)
            }}
              disabled={!selectedCycle || !selectedEmployee}
              className="bg-g4-green text-white px-4 py-2 rounded-lg hover:bg-g4-green-light disabled:opacity-50">
              Avaliar Colaborador
            </button>
            <button onClick={() => user && setStakeholderForm({ subjectId: user.id, stakeholders: [{ employeeId: '', name: '', email: '' }, { employeeId: '', name: '', email: '' }] })}
              disabled={!selectedCycle}
              className="bg-g4-gold text-g4-dark px-4 py-2 rounded-lg hover:bg-g4-gold-light disabled:opacity-50">
              Indicar Stakeholders
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-g4-dark mb-4">
        {!user?.isAdmin && !user?.isBP && !user?.isManager ? 'Minhas Avaliações' : 'Avaliações'} {activeCycle ? `- ${activeCycle.name}` : ''}
      </h2>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Avaliado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Avaliador</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ação</th>
            </tr>
          </thead>
          <tbody>
            {myPendingEvaluations.filter(e => !selectedCycle || e.cycleId === selectedCycle).map(ev => (
              <tr key={ev.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-800">{ev.subject.name}</td>
                <td className="px-4 py-3 text-gray-600">{ev.evaluator.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${ev.type === 'self' ? 'bg-g4-purple/10 text-g4-purple' : ev.type === 'manager' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ev.type === 'self' ? 'Auto' : ev.type === 'manager' ? 'Gestor' : 'Stakeholder'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${ev.status === 'completed' ? 'bg-green-100 text-green-700' : ev.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ev.status === 'completed' ? 'Concluída' : ev.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {ev.status !== 'completed' && (() => {
                      const pv = projectValidation[ev.id]
                      const blocked = ev.type === 'manager' && pv && pv.total > 0 && pv.validated < pv.total
                      return blocked ? (
                        <span className="text-xs text-amber-600" title={`${pv.validated}/${pv.total} projetos validados`}>
                          Validar projetos ({pv.validated}/{pv.total})
                        </span>
                      ) : (
                        <a href={`/avaliacoes/${ev.id}/chat`} className="text-g4-purple hover:text-g4-purple-dark text-sm">Responder</a>
                      )
                    })()}
                    {ev.status === 'completed' && (
                      <a href={`/avaliacoes/${ev.id}`} className="text-gray-500 hover:text-gray-700 text-sm">Ver</a>
                    )}
                    {(user?.isAdmin || user?.isManager) && (
                      <a href={`/avaliacoes/${ev.id}/projetos`} className="text-blue-600 hover:text-blue-800 text-sm" title="Ver projetos e metas">
                        Projetos
                      </a>
                    )}
                    {user?.isAdmin && !user?.isBP && ev.status !== 'pending' && (
                      <button
                        onClick={() => setResetModal({ evalId: ev.id, evalName: `${ev.subject.name} (${ev.type === 'self' ? 'Auto' : ev.type === 'manager' ? 'Gestor' : 'Stakeholder'})` })}
                        className="text-amber-600 hover:text-amber-800 text-sm ml-1"
                        title="Voltar avaliação para etapa anterior"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                        </svg>
                        Voltar etapa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {myPendingEvaluations.length === 0 && <p className="text-gray-400 text-center py-8">Nenhuma avaliação encontrada.</p>}
      </div>

      {/* Admin Reset Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-g4-purple">Voltar Avaliação para Etapa</h3>
              <p className="text-sm text-gray-500 mt-1">{resetModal.evalName}</p>
            </div>
            <div className="p-4 space-y-2">
              {RESET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={resetting}
                  onClick={() => handleResetEvaluation(resetModal.evalId, opt.value)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 border border-gray-100 hover:border-blue-200 transition-colors disabled:opacity-50 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-g4-purple">{opt.label}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 group-hover:text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setResetModal(null)}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
