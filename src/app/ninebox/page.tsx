'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; isAdmin: boolean; isManager: boolean }
interface ConsolidatedResult {
  id: string; cycleId: string; subjectId: string
  cultureScore: number; resultsScore: number; nineboxPosition: string
}
interface Cycle { id: string; name: string }
interface Employee { id: string; name: string; department: string; role: string; managerId: string | null }

const NINEBOX_LABELS: Record<string, { label: string; color: string }> = {
  talento_g4: { label: 'Talento G4', color: '#22c55e' },
  game_changer: { label: 'Game Changer', color: '#3b82f6' },
  expert: { label: 'Expert', color: '#8b5cf6' },
  recover: { label: 'Recover', color: '#f59e0b' },
  dismissal: { label: 'Dismissal', color: '#ef4444' },
}

function getSubordinateIds(managerId: string, employees: Employee[]): string[] {
  const direct = employees.filter(e => e.managerId === managerId).map(e => e.id)
  const indirect = direct.flatMap(id => getSubordinateIds(id, employees))
  return [...direct, ...indirect]
}

export default function NineboxPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [results, setResults] = useState<ConsolidatedResult[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedCycle, setSelectedCycle] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    setUser(JSON.parse(stored))

    fetch('/api/cycles').then(r => r.json()).then(setCycles)
    fetch('/api/employees').then(r => r.json()).then(setEmployees)
  }, [router])

  useEffect(() => {
    if (selectedCycle) {
      fetch(`/api/consolidated?cycleId=${selectedCycle}`).then(r => r.json()).then(setResults)
    }
  }, [selectedCycle])

  const getEmployee = (id: string) => employees.find(e => e.id === id)

  // Filter results by hierarchy for non-admin users
  const teamIds = user && !user.isAdmin ? getSubordinateIds(user.id, employees) : null
  const visibleResults = teamIds ? results.filter(r => teamIds.includes(r.subjectId)) : results

  // Build 5x5 grid (culture 0-4 on Y axis, results 0-4 on X axis)
  const grid: ConsolidatedResult[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []))
  visibleResults.forEach(r => {
    const row = 4 - Math.min(Math.max(Math.round(r.cultureScore), 0), 4)
    const col = Math.min(Math.max(Math.round(r.resultsScore), 0), 4)
    grid[row][col].push(r)
  })

  const getCellColor = (cultureLevel: number, resultsLevel: number) => {
    if (cultureLevel >= 4 && resultsLevel >= 4) return 'bg-green-100 border-green-300'
    if ((cultureLevel >= 4 && resultsLevel >= 3) || (resultsLevel >= 4 && cultureLevel >= 3) || (cultureLevel >= 3 && resultsLevel >= 3)) return 'bg-blue-100 border-blue-300'
    if ((cultureLevel >= 2 && resultsLevel >= 3) || (resultsLevel >= 2 && cultureLevel >= 3)) return 'bg-yellow-100 border-yellow-300'
    return 'bg-red-100 border-red-300'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Matriz Ninebox</h1>

      <div className="mb-6">
        <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
          <option value="">Selecione um ciclo</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {Object.entries(NINEBOX_LABELS).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
            <span className="text-sm text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Ninebox Grid */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex">
          {/* Y Axis Label */}
          <div className="flex flex-col justify-center mr-4">
            <div className="transform -rotate-90 whitespace-nowrap font-semibold text-gray-600 text-sm">
              CULTURA
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-5 gap-1">
              {grid.map((row, rowIdx) =>
                row.map((cell, colIdx) => {
                  const cultureLevel = 4 - rowIdx
                  const resultsLevel = colIdx
                  return (
                    <div key={`${rowIdx}-${colIdx}`}
                      className={`border-2 rounded-lg p-2 min-h-[100px] ${getCellColor(cultureLevel, resultsLevel)}`}>
                      <div className="text-xs text-gray-400 mb-1">C:{cultureLevel} R:{resultsLevel}</div>
                      {cell.map(r => {
                        const emp = getEmployee(r.subjectId)
                        const pos = NINEBOX_LABELS[r.nineboxPosition]
                        return (
                          <a key={r.id} href={`/relatorio?cycleId=${selectedCycle}&subjectId=${r.subjectId}`}
                            className="block text-xs mb-1 px-1 py-0.5 rounded hover:opacity-80"
                            style={{ backgroundColor: pos?.color + '33', color: pos?.color }}>
                            {emp?.name || r.subjectId.slice(0, 8)}
                          </a>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
            {/* X Axis Label */}
            <div className="text-center mt-2 font-semibold text-gray-600 text-sm">RESULTADOS</div>
          </div>
        </div>
      </div>

      {/* Summary List */}
      {visibleResults.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Cultura</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Resultados</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Classificação</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleResults.map(r => {
                const emp = getEmployee(r.subjectId)
                const pos = NINEBOX_LABELS[r.nineboxPosition]
                return (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-800 font-medium">{emp?.name || '-'}</td>
                    <td className="px-4 py-3 text-center">{r.cultureScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center">{r.resultsScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: pos?.color }}>
                        {pos?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a href={`/relatorio?cycleId=${selectedCycle}&subjectId=${r.subjectId}`}
                        className="text-g4-purple hover:text-g4-purple-dark text-xs">Ver Relatório</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedCycle && visibleResults.length === 0 && (
        <p className="text-gray-400 text-center py-8 mt-4">Nenhum resultado consolidado para este ciclo. Consolide as avaliações no Dashboard primeiro.</p>
      )}
    </div>
  )
}
