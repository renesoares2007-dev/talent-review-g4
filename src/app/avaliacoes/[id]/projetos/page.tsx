'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  description: string
  deliveryPct: number
  evidenceFile: string | null
  validated: boolean
  validatedAt: string | null
}

interface GoalItem {
  id: string
  goalName: string
  target: number
  actual: number
  percentage: number
}

interface EvalData {
  id: string
  cycleId: string
  subjectId: string
  type: string
  status: string
  subject: { id: string; name: string; role: string; department: string }
  evaluator: { id: string; name: string }
  cycle: { id: string; name: string }
  projects: Project[]
}

interface User {
  id: string
  isAdmin: boolean
  isManager: boolean
}

export default function ProjetosPage() {
  const params = useParams()
  const router = useRouter()
  const evaluationId = params.id as string

  const [evaluation, setEvaluation] = useState<EvalData | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [])

  useEffect(() => {
    if (!evaluationId) return
    fetch(`/api/evaluations?id=${evaluationId}`)
      .then(r => r.json())
      .then((data: EvalData) => {
        setEvaluation(data)
        setProjects(data.projects || [])
        // Load goals
        if (data.cycleId && data.subjectId) {
          fetch(`/api/goals?cycleId=${data.cycleId}&subjectId=${data.subjectId}`)
            .then(r => r.json())
            .then(setGoals)
        }
      })
  }, [evaluationId])

  const canManage = user?.isAdmin || user?.isManager

  const handleValidate = async (projectId: string, validated: boolean) => {
    await fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectId, validated }),
    })
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, validated, validatedAt: validated ? new Date().toISOString() : null } : p))
  }

  const handleGoalsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !evaluation) return
    setUploading(true)
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('cycleId', evaluation.cycleId)
    formData.append('subjectId', evaluation.subjectId)

    try {
      const res = await fetch('/api/goals', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        setGoals(data.goals)
        setUploadResult(`${data.summary.imported} metas importadas com sucesso`)
      } else {
        setUploadResult(`Erro: ${data.error}`)
      }
    } catch {
      setUploadResult('Erro de conexao')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDownloadTemplate = () => {
    const header = 'meta,alvo,realizado\n'
    const example = 'Receita Trimestral,100000,95000\nNovos Clientes,50,62\nNPS,85,78\n'
    const blob = new Blob([header + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_painel_metas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const projectAvgPct = projects.length > 0
    ? projects.reduce((sum, p) => sum + p.deliveryPct, 0) / projects.length
    : 0
  const goalsAvgPct = goals.length > 0
    ? goals.reduce((sum, g) => sum + g.percentage, 0) / goals.length
    : 0
  const sources: number[] = []
  if (projectAvgPct > 0) sources.push(projectAvgPct)
  if (goalsAvgPct > 0) sources.push(goalsAvgPct)
  const overallPct = sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0

  const getScoreLabel = (pct: number) => {
    if (pct < 60) return { label: 'Abaixo da expectativa', color: 'text-red-600', bg: 'bg-red-50' }
    if (pct < 80) return { label: 'Parcialmente atendeu', color: 'text-amber-600', bg: 'bg-amber-50' }
    if (pct <= 100) return { label: 'Atendeu a expectativa', color: 'text-green-600', bg: 'bg-green-50' }
    return { label: 'Acima da expectativa', color: 'text-blue-600', bg: 'bg-blue-50' }
  }

  if (!evaluation) return <div className="text-center py-8 text-gray-400">Carregando...</div>

  const scoreInfo = getScoreLabel(overallPct)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-g4-purple">Projetos e Metas</h1>
          <p className="text-gray-500 text-sm">
            {evaluation.subject.name} - {evaluation.subject.role} | {evaluation.cycle.name}
          </p>
        </div>
        <button onClick={() => router.back()} className="text-g4-purple hover:text-g4-purple-dark text-sm">Voltar</button>
      </div>

      {/* Score Summary */}
      {(projects.length > 0 || goals.length > 0) && (
        <div className={`${scoreInfo.bg} rounded-xl p-4 mb-6 border`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Nota de Resultado Consolidada</p>
              <p className={`text-2xl font-bold ${scoreInfo.color}`}>{overallPct.toFixed(1)}%</p>
              <p className={`text-sm font-medium ${scoreInfo.color}`}>{scoreInfo.label}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              {projects.length > 0 && <p>Projetos: {projectAvgPct.toFixed(1)}% ({projects.length} projetos)</p>}
              {goals.length > 0 && <p>Metas: {goalsAvgPct.toFixed(1)}% ({goals.length} metas)</p>}
            </div>
          </div>
        </div>
      )}

      {/* Projects Section */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-g4-dark mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          Projetos do Colaborador
        </h2>

        {projects.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum projeto cadastrado pelo colaborador.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.deliveryPct >= 100 ? 'bg-green-100 text-green-700' :
                        p.deliveryPct >= 80 ? 'bg-blue-100 text-blue-700' :
                        p.deliveryPct >= 60 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{p.deliveryPct}% entregue</span>
                      {p.validated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Validado
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
                    {p.evidenceFile && (
                      <a href={p.evidenceFile} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        Ver evidencia
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleValidate(p.id, !p.validated)}
                      className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                        p.validated
                          ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {p.validated ? 'Remover Validacao' : 'Validar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goals Panel Section */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-g4-dark flex items-center gap-2">
            <svg className="w-5 h-5 text-g4-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Painel de Metas
          </h2>
          {canManage && (
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadTemplate} className="text-xs text-g4-purple hover:underline">
                Baixar modelo CSV
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleGoalsUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-sm bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark disabled:opacity-50"
              >
                {uploading ? 'Importando...' : 'Upload Painel de Metas'}
              </button>
            </div>
          )}
        </div>

        {uploadResult && (
          <div className={`text-sm p-3 rounded-lg mb-4 ${uploadResult.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {uploadResult}
          </div>
        )}

        {goals.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400 text-sm">Nenhum painel de metas importado.</p>
            {canManage && (
              <p className="text-xs text-gray-400 mt-2">
                Colunas esperadas: <strong>meta</strong> (nome), <strong>alvo</strong> (valor alvo), <strong>realizado</strong> (valor realizado)
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 font-medium">Meta</th>
                  <th className="pb-2 font-medium text-right">Alvo</th>
                  <th className="pb-2 font-medium text-right">Realizado</th>
                  <th className="pb-2 font-medium text-right">Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {goals.map(g => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-800">{g.goalName}</td>
                    <td className="py-2 text-right text-gray-600">{g.target.toLocaleString('pt-BR')}</td>
                    <td className="py-2 text-right text-gray-600">{g.actual.toLocaleString('pt-BR')}</td>
                    <td className="py-2 text-right">
                      <span className={`font-medium ${
                        g.percentage >= 100 ? 'text-green-600' :
                        g.percentage >= 80 ? 'text-blue-600' :
                        g.percentage >= 60 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>{g.percentage.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="pt-2 font-semibold text-gray-800">Media</td>
                  <td></td>
                  <td></td>
                  <td className="pt-2 text-right">
                    <span className={`font-bold ${
                      goalsAvgPct >= 100 ? 'text-green-600' :
                      goalsAvgPct >= 80 ? 'text-blue-600' :
                      goalsAvgPct >= 60 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>{goalsAvgPct.toFixed(1)}%</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
