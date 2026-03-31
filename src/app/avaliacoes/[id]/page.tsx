'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface BehaviorEval {
  behaviorId: string
  behaviorDescription: string
  valueName: string
  example: string
  frequency: number
  aiSuggestion?: number
}

interface ResultsEval {
  evidenceText: string
  evidenceFile: string
  classification: string
  score: number
}

export default function EvaluationFormPage() {
  const params = useParams()
  const router = useRouter()
  const evaluationId = params.id as string
  const [evaluation, setEvaluation] = useState<Record<string, unknown> | null>(null)
  const [behaviors, setBehaviors] = useState<BehaviorEval[]>([])
  const [results, setResults] = useState<ResultsEval>({ evidenceText: '', evidenceFile: '', classification: 'entrega', score: 2.5 })
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/evaluations?id=${evaluationId}`).then(r => r.json()).then(data => {
      // If evaluation is not completed, redirect to chat
      if (data && data.status !== 'completed') {
        router.replace(`/avaliacoes/${evaluationId}/chat`)
        return
      }
      setEvaluation(data)
      if (data.strengths) setStrengths(data.strengths)
      if (data.improvements) setImprovements(data.improvements)
      if (data.resultsEvaluation) {
        setResults({
          evidenceText: data.resultsEvaluation.evidenceText || '',
          evidenceFile: data.resultsEvaluation.evidenceFile || '',
          classification: data.resultsEvaluation.classification,
          score: data.resultsEvaluation.score,
        })
      }
      // Load existing culture evaluations or initialize from values
      if (data.cultureEvaluations && data.cultureEvaluations.length > 0) {
        setBehaviors(data.cultureEvaluations.map((ce: Record<string, unknown>) => ({
          behaviorId: ce.behaviorId,
          behaviorDescription: (ce.behavior as Record<string, unknown>)?.description || '',
          valueName: ((ce.behavior as Record<string, unknown>)?.value as Record<string, unknown>)?.name || '',
          example: ce.example || '',
          frequency: ce.frequency as number,
          aiSuggestion: ce.aiSuggestion as number | undefined,
        })))
      } else {
        // Load all values/behaviors
        fetch('/api/values').then(r => r.json()).then(values => {
          const allBehaviors: BehaviorEval[] = []
          for (const v of values) {
            for (const b of v.behaviors) {
              allBehaviors.push({
                behaviorId: b.id,
                behaviorDescription: b.description,
                valueName: v.name,
                example: '',
                frequency: 2,
              })
            }
          }
          setBehaviors(allBehaviors)
        })
      }
    })
  }, [evaluationId])

  const classificationToScore = (c: string) => {
    if (c === 'nao_entrega') return 1
    if (c === 'entrega') return 2.5
    return 4
  }

  const askAISuggestion = async (index: number) => {
    const b = behaviors[index]
    setAiLoading(b.behaviorId)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_score',
          valueName: b.valueName,
          behaviorDescription: b.behaviorDescription,
          example: b.example,
          frequency: b.frequency,
        }),
      })
      const data = await res.json()
      const updated = [...behaviors]
      updated[index] = { ...updated[index], aiSuggestion: data.suggestedScore }
      setBehaviors(updated)
    } catch (err) {
      console.error(err)
    }
    setAiLoading(null)
  }

  const handleSave = async (complete: boolean) => {
    setSaving(true)
    await fetch('/api/evaluations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: evaluationId,
        cultureEvaluations: behaviors.map(b => ({
          behaviorId: b.behaviorId,
          example: b.example,
          frequency: b.frequency,
          aiSuggestion: b.aiSuggestion,
        })),
        resultsEvaluation: {
          evidenceText: results.evidenceText,
          evidenceFile: results.evidenceFile,
          classification: results.classification,
          score: results.score,
        },
        strengths,
        improvements,
        status: complete ? 'completed' : 'in_progress',
      }),
    })
    setSaving(false)
    if (complete) window.location.href = '/avaliacoes'
  }

  const handleFileUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'evidence')
    formData.append('employeeId', '')
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    setResults({ ...results, evidenceFile: data.path })
  }

  const handleDownloadPDF = async () => {
    if (!evaluation) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    let y = 20

    const addText = (text: string, size: number, color: [number, number, number], bold = false) => {
      doc.setFontSize(size)
      doc.setTextColor(...color)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, maxWidth)
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += size * 0.5
      }
    }

    const subj = evaluation.subject as Record<string, string>
    const eType = evaluation.type as string
    const typeLabel = eType === 'self' ? 'Autoavaliação' : eType === 'manager' ? 'Avaliação do Gestor' : 'Avaliação Stakeholder'

    // Header
    doc.setFillColor(26, 39, 68)
    doc.rect(0, 0, pageWidth, 30, 'F')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(typeLabel, margin, 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Avaliado: ${subj?.name} - ${subj?.role} (${subj?.department})`, margin, 24)
    y = 40

    // Culture
    addText('Eixo 1: Cultura (Valores e Comportamentos)', 13, [26, 39, 68], true)
    y += 4
    const freqLabels = ['Nunca', 'Raramente', 'Às vezes', 'Sempre', 'Referência']
    for (const b of behaviors) {
      addText(`${b.valueName} - ${b.behaviorDescription}: ${freqLabels[b.frequency]} (${b.frequency}/4)`, 9, [50, 50, 50])
      if (b.example) { addText(`  Exemplo: ${b.example}`, 8, [100, 100, 100]) }
      y += 1
    }

    // Results
    y += 4
    addText('Eixo 2: Resultados', 13, [26, 39, 68], true)
    y += 2
    const classLabel = results.classification === 'acima_expectativa' ? 'Acima da expectativa' : results.classification === 'entrega' ? 'Entrega resultados' : 'Não entrega'
    addText(`Classificação: ${classLabel} (${results.score}/4)`, 10, [50, 50, 50], true)
    if (results.evidenceText) { y += 2; addText(results.evidenceText, 9, [80, 80, 80]) }

    // Strengths & Improvements
    if (strengths || improvements) {
      y += 6
      addText('Pontos Fortes e Oportunidades', 13, [26, 39, 68], true)
      y += 2
      if (strengths) { addText(`Pontos Fortes: ${strengths}`, 9, [34, 120, 34]) }
      if (improvements) { y += 2; addText(`Oportunidades: ${improvements}`, 9, [180, 120, 0]) }
    }

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Talent Review G4`, margin, 290)
      doc.text(`Página ${i}/${totalPages}`, pageWidth - margin - 20, 290)
    }

    const empName = (subj?.name || 'avaliacao').toLowerCase().replace(/\s+/g, '-')
    doc.save(`avaliacao-${empName}.pdf`)
  }

  if (!evaluation) return <div className="text-center py-12 text-gray-400">Carregando...</div>

  const subject = evaluation.subject as Record<string, string>
  const evalType = evaluation.type as string
  const isReadOnly = (evaluation.status as string) === 'completed'
  const frequencyLabels = ['Nunca apresenta', 'Raramente apresenta', 'Às vezes apresenta', 'Sempre apresenta', 'É uma referência']

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-g4-purple">
            {evalType === 'self' ? 'Autoavaliação' : evalType === 'manager' ? 'Avaliação do Gestor' : 'Avaliação Stakeholder'}
          </h1>
          <p className="text-gray-500">Avaliado: <strong>{subject?.name}</strong> - {subject?.role} ({subject?.department})</p>
        </div>
        <div className="flex items-center gap-3">
          {isReadOnly && (
            <button onClick={handleDownloadPDF}
              className="bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark flex items-center gap-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          )}
          <a href="/avaliacoes" className="text-g4-purple hover:text-g4-purple-dark">Voltar</a>
        </div>
      </div>

      {/* Eixo de Cultura */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-g4-dark mb-4">Eixo 1: Cultura (Valores e Comportamentos)</h2>

        {behaviors.length === 0 && <p className="text-gray-400">Nenhum valor/comportamento cadastrado.</p>}

        {behaviors.map((b, i) => (
          <div key={b.behaviorId} className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">{b.valueName}</span>
                <p className="text-sm text-gray-700 mt-1 font-medium">{b.behaviorDescription}</p>
              </div>
              {b.aiSuggestion !== undefined && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">IA sugere: {b.aiSuggestion}</span>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">Descreva exemplos de quando o valor foi ou não atendido:</label>
              <textarea rows={2} value={b.example} readOnly={isReadOnly}
                onChange={e => { const u = [...behaviors]; u[i] = { ...u[i], example: e.target.value }; setBehaviors(u) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800" placeholder="Descreva situações concretas..." />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">Frequência:</label>
              <select value={b.frequency} disabled={isReadOnly}
                onChange={e => { const u = [...behaviors]; u[i] = { ...u[i], frequency: parseInt(e.target.value) }; setBehaviors(u) }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800">
                {frequencyLabels.map((label, val) => (
                  <option key={val} value={val}>{val} - {label}</option>
                ))}
              </select>

              {!isReadOnly && b.example && (
                <button onClick={() => askAISuggestion(i)} disabled={aiLoading === b.behaviorId}
                  className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded hover:bg-blue-800 disabled:opacity-50">
                  {aiLoading === b.behaviorId ? 'Consultando IA...' : 'Sugestão IA'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Eixo de Resultados */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-g4-dark mb-4">Eixo 2: Resultados (Entregas e Metas)</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição das entregas e resultados</label>
          <textarea rows={4} value={results.evidenceText} readOnly={isReadOnly}
            onChange={e => setResults({ ...results, evidenceText: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
            placeholder="Descreva as entregas, metas atingidas, comparativos meta vs real..." />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload de Evidências (planilhas, gráficos, etc)</label>
          {!isReadOnly && (
            <input type="file" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="text-sm text-gray-800" />
          )}
          {results.evidenceFile && (
            <p className="text-sm text-green-600 mt-1">Arquivo: {results.evidenceFile}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Classificação</label>
          <div className="flex gap-4">
            {[
              { value: 'nao_entrega', label: 'Não entrega resultados', score: 1 },
              { value: 'entrega', label: 'Entrega resultados', score: 2.5 },
              { value: 'acima_expectativa', label: 'Acima da expectativa', score: 4 },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer ${results.classification === opt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                <input type="radio" name="classification" value={opt.value} checked={results.classification === opt.value}
                  disabled={isReadOnly}
                  onChange={() => setResults({ ...results, classification: opt.value, score: classificationToScore(opt.value) })} />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Pontos Fortes e Melhorias (para gestor e stakeholder) */}
      {evalType !== 'self' && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-g4-dark mb-4">Pontos Fortes e Oportunidades</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pontos Fortes (Fortalezas)</label>
              <textarea rows={4} value={strengths} readOnly={isReadOnly}
                onChange={e => setStrengths(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
                placeholder="Descreva os pontos fortes do colaborador..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Oportunidades de Desenvolvimento</label>
              <textarea rows={4} value={improvements} readOnly={isReadOnly}
                onChange={e => setImprovements(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
                placeholder="Descreva os pontos de melhoria..." />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-3">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Concluir Avaliação'}
          </button>
        </div>
      )}
    </div>
  )
}
