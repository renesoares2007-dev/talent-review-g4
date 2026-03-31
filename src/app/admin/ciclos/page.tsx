'use client'
import { useEffect, useState, useRef } from 'react'

interface Cycle {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  isActive: boolean
  selfEvalDeadline: string | null
  stakeholderEvalDeadline: string | null
  managerEvalDeadline: string | null
  calibrationDeadline: string | null
  feedbackDeadline: string | null
  evaluations: { id: string; status: string; type: string; subjectId: string }[]
}

interface ImportResult {
  success: boolean
  summary?: {
    total: number
    imported: number
    skipped: number
    errors: number
    importedNames: string[]
    skippedNames: string[]
    errorDetails: string[]
  }
  error?: string
  details?: string[]
}

export default function CiclosPage() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', selfEvalDeadline: '', stakeholderEvalDeadline: '', managerEvalDeadline: '', calibrationDeadline: '', feedbackDeadline: '' })
  const [editing, setEditing] = useState<Cycle | null>(null)
  const [importCycleId, setImportCycleId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [notifying, setNotifying] = useState<string | null>(null)
  const [notifyResult, setNotifyResult] = useState<{ cycleId: string; message: string; success: boolean } | null>(null)

  const [isBP, setIsBP] = useState(false)

  const loadCycles = () => fetch('/api/cycles').then(r => r.json()).then(setCycles)
  useEffect(() => {
    loadCycles()
    const stored = localStorage.getItem('user')
    if (stored) { const u = JSON.parse(stored); setIsBP(u.isBP && !u.isAdmin) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    await fetch('/api/cycles', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setForm({ name: '', description: '', startDate: '', endDate: '', selfEvalDeadline: '', stakeholderEvalDeadline: '', managerEvalDeadline: '', calibrationDeadline: '', feedbackDeadline: '' })
    setEditing(null)
    loadCycles()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !importCycleId) return
    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('cycleId', importCycleId)

    try {
      const res = await fetch('/api/evaluations/import', { method: 'POST', body: formData })
      const data = await res.json()
      setImportResult(data)
    } catch {
      setImportResult({ success: false, error: 'Erro de conexão' })
    }

    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    loadCycles()
  }

  const handleNotify = async (cycleId: string, mode: 'dm' | 'channel' | 'both') => {
    setNotifying(cycleId)
    setNotifyResult(null)
    try {
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, mode }),
      })
      const data = await res.json()
      if (data.error) {
        setNotifyResult({ cycleId, message: data.error, success: false })
      } else if (data.summary) {
        const s = data.summary
        const parts = []
        if (s.evaluatorsNotified > 0) parts.push(`${s.evaluatorsNotified} DM(s) enviada(s)`)
        if (s.dmsFailed > 0) parts.push(`${s.dmsFailed} DM(s) falharam`)
        if (s.channelSent) parts.push('Resumo enviado ao canal')
        if (s.totalPending === 0) parts.push('Nenhuma avaliação pendente')
        setNotifyResult({ cycleId, message: parts.join('. ') || 'Notificações enviadas', success: true })
      } else {
        setNotifyResult({ cycleId, message: data.message || 'Concluído', success: true })
      }
    } catch {
      setNotifyResult({ cycleId, message: 'Erro de conexão', success: false })
    }
    setNotifying(null)
  }

  const handleDownloadTemplate = () => {
    const header = 'email,nota_cultura,nota_resultados,pontos_fortes,melhorias,tags\n'
    const example = 'colaborador@empresa.com,3.5,4.0,"Liderança; Comunicação","Gestão de tempo","key_talent"\n'
    const blob = new Blob([header + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_historico_avaliacoes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Ciclos de Avaliação</h1>

      {!isBP && <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Ciclo' : 'Novo Ciclo'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" placeholder="Ex: Avaliação 2024 Q1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 mb-3">Prazos por Fase</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Autoavaliação</label>
            <input type="date" value={form.selfEvalDeadline} onChange={e => setForm({ ...form, selfEvalDeadline: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Avaliação Stakeholder</label>
            <input type="date" value={form.stakeholderEvalDeadline} onChange={e => setForm({ ...form, stakeholderEvalDeadline: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Avaliação Gestor</label>
            <input type="date" value={form.managerEvalDeadline} onChange={e => setForm({ ...form, managerEvalDeadline: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Calibração</label>
            <input type="date" value={form.calibrationDeadline} onChange={e => setForm({ ...form, calibrationDeadline: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Feedback</label>
            <input type="date" value={form.feedbackDeadline} onChange={e => setForm({ ...form, feedbackDeadline: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm" />
          </div>
        </div>

        <button type="submit" className="bg-g4-purple text-white px-6 py-2 rounded-lg hover:bg-g4-purple-dark">
          {editing ? 'Atualizar' : 'Criar Ciclo'}
        </button>
      </form>}

      <div className="grid gap-4">
        {cycles.map(c => {
          const total = c.evaluations.length
          const completed = c.evaluations.filter(e => e.status === 'completed').length
          const isImporting = importCycleId === c.id
          return (
            <div key={c.id} className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-g4-dark">{c.name}</h3>
                  {c.description && <p className="text-gray-500 text-sm">{c.description}</p>}
                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(c.startDate).toLocaleDateString('pt-BR')} - {new Date(c.endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    {!isBP && <button
                      onClick={() => { setEditing(c); setForm({ name: c.name, description: c.description || '', startDate: c.startDate.slice(0, 10), endDate: c.endDate.slice(0, 10), selfEvalDeadline: c.selfEvalDeadline?.slice(0, 10) || '', stakeholderEvalDeadline: c.stakeholderEvalDeadline?.slice(0, 10) || '', managerEvalDeadline: c.managerEvalDeadline?.slice(0, 10) || '', calibrationDeadline: c.calibrationDeadline?.slice(0, 10) || '', feedbackDeadline: c.feedbackDeadline?.slice(0, 10) || '' }) }}
                      className="text-xs text-g4-purple hover:text-g4-purple-dark"
                    >Editar</button>}
                    <span className={`text-xs px-2 py-1 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Ativo' : 'Encerrado'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">{completed}/{total} avaliações concluídas</div>
                  {total > 0 && (
                    <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-g4-purple h-2 rounded-full" style={{ width: `${(completed / total) * 100}%` }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Phase Deadlines Timeline */}
              {(c.selfEvalDeadline || c.stakeholderEvalDeadline || c.managerEvalDeadline || c.calibrationDeadline || c.feedbackDeadline) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cronograma de Fases</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Autoavaliação', date: c.selfEvalDeadline, color: 'bg-purple-100 text-purple-700' },
                      { label: 'Stakeholder', date: c.stakeholderEvalDeadline, color: 'bg-amber-100 text-amber-700' },
                      { label: 'Gestor', date: c.managerEvalDeadline, color: 'bg-green-100 text-green-700' },
                      { label: 'Calibração', date: c.calibrationDeadline, color: 'bg-blue-100 text-blue-700' },
                      { label: 'Feedback', date: c.feedbackDeadline, color: 'bg-pink-100 text-pink-700' },
                    ].filter(p => p.date).map(p => {
                      const deadline = new Date(p.date!)
                      const isOverdue = deadline < new Date() && c.isActive
                      return (
                        <div key={p.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isOverdue ? 'bg-red-100 text-red-700' : p.color}`}>
                          <span>{p.label}</span>
                          <span className="opacity-70">até {deadline.toLocaleDateString('pt-BR')}</span>
                          {isOverdue && <span className="font-bold">!</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isBP && <div className="mt-4 pt-4 border-t border-gray-100">
                {!isImporting ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => { setImportCycleId(c.id); setImportResult(null) }}
                      className="inline-flex items-center gap-2 text-sm text-g4-purple hover:text-g4-purple-dark transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Importar Histórico
                    </button>

                    {c.isActive && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleNotify(c.id, 'both')}
                          disabled={notifying === c.id}
                          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                        >
                          {notifying === c.id ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          )}
                          {notifying === c.id ? 'Enviando...' : 'Notificar Pendentes (Slack)'}
                        </button>
                      </div>
                    )}

                    {notifyResult && notifyResult.cycleId === c.id && (
                      <span className={`text-xs px-2 py-1 rounded ${notifyResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {notifyResult.message}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-g4-dark flex items-center gap-2">
                        <svg className="w-4 h-4 text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Importar Histórico - {c.name}
                      </h4>
                      <button onClick={() => { setImportCycleId(null); setImportResult(null) }} className="text-gray-400 hover:text-gray-600 text-xs">
                        Cancelar
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2">
                      <p className="font-medium text-gray-700">Colunas esperadas na planilha:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <span><strong>email</strong> - Email do colaborador</span>
                        <span><strong>nota_cultura</strong> - Nota de cultura (0-4)</span>
                        <span><strong>nota_resultados</strong> - Nota de resultados (0-4)</span>
                        <span><strong>pontos_fortes</strong> - Pontos fortes</span>
                        <span><strong>melhorias</strong> - Pontos de melhoria</span>
                        <span><strong>tags</strong> - Tags (separadas por vírgula)</span>
                      </div>
                      <button onClick={handleDownloadTemplate} className="text-g4-purple hover:underline font-medium mt-1">
                        Baixar modelo CSV
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${importing ? 'bg-gray-100 text-gray-400' : 'bg-g4-purple text-white hover:bg-g4-purple-dark'}`}>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          disabled={importing}
                          onChange={handleImport}
                        />
                        {importing ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Importando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Selecionar Planilha
                          </>
                        )}
                      </label>
                    </div>

                    {/* Import result */}
                    {importResult && (
                      <div className={`rounded-lg p-4 text-sm ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        {importResult.success && importResult.summary ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-green-800">
                              Importação concluída: {importResult.summary.imported} de {importResult.summary.total} avaliações importadas
                            </p>
                            {importResult.summary.importedNames.length > 0 && (
                              <p className="text-green-700">
                                <strong>Importados:</strong> {importResult.summary.importedNames.join(', ')}
                              </p>
                            )}
                            {importResult.summary.skippedNames.length > 0 && (
                              <p className="text-amber-700">
                                <strong>Ignorados:</strong> {importResult.summary.skippedNames.join(', ')}
                              </p>
                            )}
                            {importResult.summary.errorDetails.length > 0 && (
                              <div className="text-red-700">
                                <strong>Erros:</strong>
                                <ul className="list-disc ml-4 mt-1">
                                  {importResult.summary.errorDetails.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-red-800">{importResult.error}</p>
                            {importResult.details && (
                              <ul className="list-disc ml-4 mt-1 text-red-700">
                                {importResult.details.map((d, i) => <li key={i}>{d}</li>)}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>}
            </div>
          )
        })}
        {cycles.length === 0 && <p className="text-gray-400 text-center py-8">Nenhum ciclo criado.</p>}
      </div>
    </div>
  )
}
