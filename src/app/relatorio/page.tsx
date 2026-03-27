'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ReportContent() {
  const searchParams = useSearchParams()
  const cycleId = searchParams.get('cycleId')
  const subjectId = searchParams.get('subjectId')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null)
  const [evaluations, setEvaluations] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cycleId || !subjectId) { setLoading(false); return }
    Promise.all([
      fetch(`/api/consolidated?cycleId=${cycleId}&subjectId=${subjectId}`).then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
      fetch(`/api/evaluations?cycleId=${cycleId}&subjectId=${subjectId}`).then(r => r.json()),
    ]).then(([consolidated, employees, evals]) => {
      setResult(consolidated)
      const empList = Array.isArray(employees) ? employees : []
      setEmployee(empList.find((e: Record<string, string>) => e.id === subjectId))
      setEvaluations(Array.isArray(evals) ? evals : [])
      setLoading(false)
    }).catch(err => {
      console.error('Error loading report:', err)
      setLoading(false)
    })
  }, [cycleId, subjectId])

  const nineboxLabels: Record<string, { label: string; color: string }> = {
    talento_g4: { label: 'Talento G4', color: '#22c55e' },
    game_changer: { label: 'Game Changer', color: '#3b82f6' },
    expert: { label: 'Expert', color: '#8b5cf6' },
    recover: { label: 'Recover', color: '#f59e0b' },
    dismissal: { label: 'Dismissal', color: '#ef4444' },
  }

  const pos = result ? (nineboxLabels[(result.nineboxPosition as string) || ''] || { label: '-', color: '#999' }) : { label: '-', color: '#999' }

  const handleDownloadPDF = async () => {
    if (!result || !employee) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    let y = 20

    const addText = (text: string, size: number, color: [number, number, number], bold = false, maxW = maxWidth) => {
      doc.setFontSize(size)
      doc.setTextColor(...color)
      if (bold) doc.setFont('helvetica', 'bold')
      else doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(text, maxW)
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += size * 0.5
      }
    }

    const addSection = (title: string, content: string) => {
      y += 4
      if (y > 260) { doc.addPage(); y = 20 }
      addText(title, 13, [26, 39, 68], true)
      y += 2
      addText(content, 10, [60, 60, 60])
      y += 4
    }

    // Header
    doc.setFillColor(26, 39, 68)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('Relatorio de Avaliacao', margin, 15)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`${(employee as Record<string, string>)?.name || ''} - ${(employee as Record<string, string>)?.role || ''}`, margin, 25)
    doc.text(`Departamento: ${(employee as Record<string, string>)?.department || ''}`, margin, 31)
    y = 45

    // Scores
    addText(`Cultura: ${(result.cultureScore as number)?.toFixed(2)}/4    |    Resultados: ${(result.resultsScore as number)?.toFixed(2)}/4    |    Ninebox: ${pos.label}`, 11, [30, 30, 30], true)
    y += 8

    // Evaluations
    for (const ev of evaluations) {
      const typeLabel = (ev.type as string) === 'self' ? 'Autoavaliacao' : (ev.type as string) === 'manager' ? 'Gestor' : 'Stakeholder'
      const evalName = (ev.evaluator as Record<string, string>)?.name || ''
      addText(`${typeLabel} - ${evalName}  (C: ${(ev.cultureScore as number)?.toFixed(1) || '-'} | R: ${(ev.resultsScore as number)?.toFixed(1) || '-'})`, 11, [26, 39, 68], true)
      y += 2
      if (ev.strengths) { addText(`Pontos Fortes: ${ev.strengths as string}`, 9, [34, 120, 34]) }
      if (ev.improvements) { addText(`Oportunidades: ${ev.improvements as string}`, 9, [180, 120, 0]) }
      y += 4
    }

    if (result.aiAnalysis) addSection('Analise Consolidada', result.aiAnalysis as string)
    if (result.aiFeedback) addSection('Feedback (IA)', result.aiFeedback as string)
    if (result.aiPDI) addSection('PDI (IA)', result.aiPDI as string)

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Talent Review G4`, margin, 290)
      doc.text(`Pagina ${i}/${totalPages}`, pageWidth - margin - 20, 290)
    }

    const empName = ((employee as Record<string, string>)?.name || 'relatorio').toLowerCase().replace(/\s+/g, '-')
    doc.save(`relatorio-${empName}.pdf`)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Carregando relatorio...</div>
  if (!result) return <div className="text-center py-12 text-gray-400">Nenhum resultado consolidado encontrado.</div>

  return (
    <div className="max-w-4xl mx-auto" id="report">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-g4-purple">Relatorio de Avaliacao</h1>
        <button onClick={handleDownloadPDF}
          className="bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-g4-dark mb-4">{(employee as Record<string, string>)?.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Cargo:</span> <strong className="text-gray-800">{(employee as Record<string, string>)?.role}</strong></div>
          <div><span className="text-gray-500">Departamento:</span> <strong className="text-gray-800">{(employee as Record<string, string>)?.department}</strong></div>
          <div><span className="text-gray-500">Cultura:</span> <strong className="text-gray-800">{(result.cultureScore as number)?.toFixed(2)}/4</strong></div>
          <div><span className="text-gray-500">Resultados:</span> <strong className="text-gray-800">{(result.resultsScore as number)?.toFixed(2)}/4</strong></div>
        </div>
        <div className="mt-4">
          <span className="text-sm text-gray-500">Classificacao Ninebox:</span>
          <span className="ml-2 px-3 py-1 rounded text-white text-sm font-semibold" style={{ backgroundColor: pos.color }}>
            {pos.label}
          </span>
        </div>
      </div>

      {/* Evaluations Summary */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-g4-dark mb-4">Resumo das Avaliacoes</h3>
        <div className="space-y-4">
          {evaluations.map((ev, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${(ev.type as string) === 'self' ? 'bg-blue-100 text-blue-800' : (ev.type as string) === 'manager' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {(ev.type as string) === 'self' ? 'Autoavaliacao' : (ev.type as string) === 'manager' ? 'Gestor' : 'Stakeholder'}
                  {' - '}{((ev.evaluator as Record<string, string>)?.name)}
                </span>
                <span className="text-sm text-gray-500">
                  C: {(ev.cultureScore as number)?.toFixed(1) || '-'} | R: {(ev.resultsScore as number)?.toFixed(1) || '-'}
                </span>
              </div>
              {(ev.strengths as string) && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-green-700">Pontos Fortes:</span>
                  <p className="text-sm text-gray-600 mt-1">{ev.strengths as string}</p>
                </div>
              )}
              {(ev.improvements as string) && (
                <div>
                  <span className="text-xs font-medium text-amber-700">Oportunidades:</span>
                  <p className="text-sm text-gray-600 mt-1">{ev.improvements as string}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      {(result.aiAnalysis as string) && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-g4-dark mb-3">Analise Consolidada</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.aiAnalysis as string}</p>
        </div>
      )}

      {/* AI Feedback */}
      {(result.aiFeedback as string) && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-blue-600">
          <h3 className="text-lg font-semibold text-g4-dark mb-3">Feedback (Gerado por IA)</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{result.aiFeedback as string}</div>
        </div>
      )}

      {/* AI PDI */}
      {(result.aiPDI as string) && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-g4-dark mb-3">Plano de Desenvolvimento Individual - PDI (Gerado por IA)</h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{result.aiPDI as string}</div>
        </div>
      )}
    </div>
  )
}

export default function RelatorioPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">Carregando...</div>}>
      <ReportContent />
    </Suspense>
  )
}
