'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
// jsPDF loaded dynamically in downloadPDF to avoid SSR issues

interface User {
  id: string
  name: string
  email: string
  role: string
  department: string
  isAdmin: boolean
  isManager: boolean
  photo?: string
  aboutMe?: string
  achievements?: string
  recognitions?: string
  education?: string
  careerInterests?: string
  behavioralProfileText?: string
}

interface ConsolidatedResult {
  cycleId: string
  cultureScore: number
  resultsScore: number
  nineboxPosition: string
  aiAnalysis?: string
  aiFeedback?: string
  aiPDI?: string
}

interface Evaluation {
  id: string
  type: string
  status: string
  cycleId: string
  cultureScore?: number
  resultsScore?: number
  strengths?: string
  improvements?: string
  evaluator: { name: string }
  cycle: { name: string }
}

const nineboxLabels: Record<string, { label: string; color: string; description: string }> = {
  talento_g4: { label: 'Talento G4', color: '#22c55e', description: 'Referencia em Cultura e Resultados' },
  game_changer: { label: 'Game Changer', color: '#3b82f6', description: 'Alto desempenho em um ou ambos os eixos' },
  expert: { label: 'Expert', color: '#8b5cf6', description: 'Bom desempenho consistente em ambos os eixos' },
  recover: { label: 'Recover', color: '#f59e0b', description: 'Precisa de desenvolvimento em um dos eixos' },
  dismissal: { label: 'Dismissal', color: '#ef4444', description: 'Desempenho abaixo do esperado em ambos os eixos' },
}

function EditableList({ items, onSave, placeholder }: { items: string[]; onSave: (items: string[]) => void; placeholder: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items)

  const addItem = () => setDraft([...draft, ''])
  const removeItem = (i: number) => setDraft(draft.filter((_, idx) => idx !== i))
  const updateItem = (i: number, val: string) => { const d = [...draft]; d[i] = val; setDraft(d) }

  const save = () => {
    const filtered = draft.filter(s => s.trim())
    onSave(filtered)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        {items.length > 0 ? (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-g4-purple mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">Nenhum item cadastrado</p>
        )}
        <button onClick={() => { setDraft(items.length > 0 ? items : ['']); setEditing(true) }}
          className="text-xs text-g4-purple hover:text-g4-purple-dark mt-2">
          Editar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {draft.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input value={item} onChange={e => updateItem(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800" />
          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={addItem} className="text-xs text-g4-purple hover:text-g4-purple-dark">+ Adicionar</button>
        <button onClick={save} className="text-xs bg-g4-purple text-white px-3 py-1 rounded-lg hover:bg-g4-purple-dark">Salvar</button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
      </div>
    </div>
  )
}

function EditableText({ value, onSave, placeholder, multiline }: { value: string; onSave: (val: string) => void; placeholder: string; multiline?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <div>
        {value ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">{placeholder}</p>
        )}
        <button onClick={() => { setDraft(value); setEditing(true) }}
          className="text-xs text-g4-purple hover:text-g4-purple-dark mt-2">
          Editar
        </button>
      </div>
    )
  }

  return (
    <div>
      {multiline ? (
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={placeholder} rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800" />
      ) : (
        <input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800" />
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={() => { onSave(draft); setEditing(false) }}
          className="text-xs bg-g4-purple text-white px-3 py-1 rounded-lg hover:bg-g4-purple-dark">Salvar</button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
      </div>
    </div>
  )
}

export default function TalentCardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [result, setResult] = useState<ConsolidatedResult | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleName, setCycleName] = useState('')
  const [cycleActive, setCycleActive] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const profileFileRef = useRef<HTMLInputElement>(null)

  const refreshUser = async (userId: string) => {
    const employees = await fetch('/api/employees').then(r => r.json())
    const emp = employees.find((e: User) => e.id === userId)
    if (emp) {
      setUser(emp)
      localStorage.setItem('user', JSON.stringify(emp))
    }
  }

  const updateProfile = async (field: string, value: string) => {
    if (!user) return
    await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, [field]: value }),
    })
    await refreshUser(user.id)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'photo')
    formData.append('employeeId', user.id)
    await fetch('/api/upload', { method: 'POST', body: formData })
    await refreshUser(user.id)
    setUploading(false)
  }

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingProfile(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'behavioral_profile')
    formData.append('employeeId', user.id)
    await fetch('/api/upload', { method: 'POST', body: formData })
    await refreshUser(user.id)
    setUploadingProfile(false)
  }

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) { router.push('/login'); return }

    const u = JSON.parse(stored) as User
    setUser(u)

    // Fetch fresh user data + all evaluations (full history)
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/cycles').then(r => r.json()),
      fetch('/api/evaluations').then(r => r.json()),
    ]).then(([employees, cycles, allEvals]) => {
      const freshUser = employees.find((e: User) => e.id === u.id)
      if (freshUser) {
        setUser(freshUser)
        localStorage.setItem('user', JSON.stringify(freshUser))
      }

      // Find the most recent cycle (active or most recently finalized)
      const activeCycle = cycles.find((c: { isActive: boolean }) => c.isActive)
        || cycles.sort((a: { updatedAt: string }, b: { updatedAt: string }) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      if (activeCycle) {
        setCycleName(activeCycle.name)
        setCycleActive(activeCycle.isActive)
        fetch(`/api/consolidated?cycleId=${activeCycle.id}&subjectId=${u.id}`)
          .then(r => r.json())
          .then(consolidated => {
            if (consolidated && consolidated.cultureScore !== undefined) {
              setResult(consolidated)
            }
          })
      }

      // All evaluations where user is the subject (full history, all cycles)
      const myEvals = (allEvals as (Evaluation & { subjectId: string })[]).filter(e => e.subjectId === u.id)
      setEvaluations(myEvals)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [router])

  const downloadPDF = useCallback(async () => {
    if (!user) return

    const jsPDF = (await import('jspdf')).default
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = 15

    const G4 = {
      purple: [26, 39, 68] as [number, number, number],
      green: [66, 135, 20] as [number, number, number],
      gold: [201, 169, 110] as [number, number, number],
      magenta: [180, 0, 130] as [number, number, number],
      burgundy: [42, 58, 92] as [number, number, number],
      dark: [13, 21, 32] as [number, number, number],
      gray: [107, 114, 128] as [number, number, number],
      lightGray: [229, 231, 235] as [number, number, number],
    }

    const checkPageBreak = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage()
        y = 15
      }
    }

    const addSectionTitle = (title: string, color: [number, number, number]) => {
      checkPageBreak(15)
      doc.setFillColor(...color)
      doc.rect(margin, y, 3, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...G4.dark)
      doc.text(title, margin + 6, y + 6)
      y += 12
    }

    const addWrappedText = (text: string, fontSize: number = 10, color: [number, number, number] = G4.dark) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(fontSize)
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(text, contentWidth - 6)
      checkPageBreak(lines.length * (fontSize * 0.5) + 4)
      doc.text(lines, margin + 6, y)
      y += lines.length * (fontSize * 0.5) + 4
    }

    const addBulletList = (items: string[]) => {
      items.forEach(item => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...G4.dark)
        const lines = doc.splitTextToSize(item, contentWidth - 12)
        checkPageBreak(lines.length * 5 + 2)
        doc.setTextColor(...G4.purple)
        doc.text('•', margin + 6, y)
        doc.setTextColor(...G4.dark)
        doc.text(lines, margin + 11, y)
        y += lines.length * 5 + 2
      })
    }

    // Header bar
    doc.setFillColor(...G4.purple)
    doc.rect(0, 0, pageWidth, 28, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text('Talent Card', margin, 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Talent Review G4', margin, 20)

    // Ninebox badge (top right)
    const posData = result ? nineboxLabels[result.nineboxPosition] : null
    if (posData) {
      const badgeText = posData.label
      const badgeW = doc.getTextWidth(badgeText) + 10
      const hex = posData.color
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      doc.setFillColor(r, g, b)
      doc.roundedRect(pageWidth - margin - badgeW, 8, badgeW, 10, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(badgeText, pageWidth - margin - badgeW + 5, 15)
    }

    y = 35

    // Profile info
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...G4.dark)
    doc.text(user.name, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...G4.gray)
    doc.text(`${user.role} - ${user.department}`, margin, y)
    y += 5
    doc.text(user.email, margin, y)
    y += 10

    // Scores
    if (result) {
      checkPageBreak(30)
      const boxW = (contentWidth - 8) / 3
      const boxes = [
        { label: 'Cultura', score: result.cultureScore, color: G4.purple },
        { label: 'Resultados', score: result.resultsScore, color: G4.green },
        { label: 'Media Geral', score: (result.cultureScore + result.resultsScore) / 2, color: G4.magenta },
      ]
      boxes.forEach((box, i) => {
        const bx = margin + i * (boxW + 4)
        doc.setDrawColor(...G4.lightGray)
        doc.setFillColor(250, 250, 252)
        doc.roundedRect(bx, y, boxW, 24, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(...box.color)
        doc.text(box.score.toFixed(1), bx + boxW / 2, y + 12, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...G4.gray)
        doc.text(box.label, bx + boxW / 2, y + 20, { align: 'center' })
      })
      y += 30
    }

    // Sobre Mim
    if (user.aboutMe) {
      addSectionTitle('Sobre Mim', G4.purple)
      addWrappedText(user.aboutMe)
      y += 4
    }

    // Conquistas
    const achs: string[] = user.achievements ? JSON.parse(user.achievements) : []
    if (achs.length > 0) {
      addSectionTitle('Conquistas', G4.gold)
      addBulletList(achs)
      y += 4
    }

    // Reconhecimentos
    const recs: string[] = user.recognitions ? JSON.parse(user.recognitions) : []
    if (recs.length > 0) {
      addSectionTitle('Reconhecimentos', G4.green)
      addBulletList(recs)
      y += 4
    }

    // Formacao
    const educ: string[] = user.education ? JSON.parse(user.education) : []
    if (educ.length > 0) {
      addSectionTitle('Formacao', G4.magenta)
      addBulletList(educ)
      y += 4
    }

    // Interesse de Carreira
    if (user.careerInterests) {
      addSectionTitle('Interesse de Carreira', G4.burgundy)
      addWrappedText(user.careerInterests)
      y += 4
    }

    // Avaliacoes Recebidas
    const completedEvals = evaluations.filter(ev => ev.status === 'completed')
    if (completedEvals.length > 0) {
      addSectionTitle('Avaliacoes Recebidas', G4.purple)

      const tableData = completedEvals.map(ev => [
        ev.cycle?.name || '-',
        ev.type === 'self' ? 'Auto' : ev.type === 'manager' ? 'Gestor' : 'Stakeholder',
        ev.evaluator.name,
        ev.cultureScore?.toFixed(1) || '-',
        ev.resultsScore?.toFixed(1) || '-',
      ])

      autoTable(doc, {
        startY: y,
        margin: { left: margin + 3, right: margin },
        head: [['Ciclo', 'Tipo', 'Avaliador', 'Cultura', 'Resultados']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3, textColor: G4.dark },
        headStyles: { fillColor: G4.purple, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 244, 250] },
      })

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

      // Pontos fortes e melhorias de cada avaliacao
      completedEvals.forEach(ev => {
        if (ev.strengths || ev.improvements) {
          checkPageBreak(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(...G4.gray)
          const typeLabel = ev.type === 'self' ? 'Auto' : ev.type === 'manager' ? 'Gestor' : 'Stakeholder'
          doc.text(`${ev.cycle?.name} - ${typeLabel} (${ev.evaluator.name})`, margin + 6, y)
          y += 5

          if (ev.strengths) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(22, 163, 74)
            doc.text('Pontos Fortes:', margin + 6, y)
            y += 4
            addWrappedText(ev.strengths, 9, G4.dark)
          }
          if (ev.improvements) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(217, 119, 6)
            doc.text('Oportunidades de Melhoria:', margin + 6, y)
            y += 4
            addWrappedText(ev.improvements, 9, G4.dark)
          }
          y += 3
        }
      })
    }

    // AI Feedback & PDI - only in PDF when cycle is finalized
    if (!cycleActive && result?.aiFeedback) {
      addSectionTitle('Feedback IA', G4.purple)
      addWrappedText(result.aiFeedback)
      y += 4
    }

    if (!cycleActive && result?.aiPDI) {
      addSectionTitle('Plano de Desenvolvimento Individual (PDI)', G4.green)
      addWrappedText(result.aiPDI)
      y += 4
    }

    // Perfil Comportamental
    if (user.behavioralProfileText && !user.behavioralProfileText.startsWith('[IA não configurada')) {
      addSectionTitle('Perfil Comportamental', G4.magenta)
      addWrappedText(user.behavioralProfileText)
      y += 4
    }

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...G4.gray)
      const pageH = doc.internal.pageSize.getHeight()
      doc.text(`Talent Review G4 - Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, pageH - 8)
      doc.text(`Pagina ${i} de ${totalPages}`, pageWidth - margin, pageH - 8, { align: 'right' })
    }

    doc.save(`talent-card-${user.name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }, [user, result, evaluations])

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Carregando seu Talent Card...</div>
  }

  if (!user) return null

  const pos = result ? nineboxLabels[result.nineboxPosition] || { label: '-', color: '#999', description: '' } : null

  // Parse JSON arrays from string fields
  const achievements: string[] = user.achievements ? JSON.parse(user.achievements) : []
  const recognitions: string[] = user.recognitions ? JSON.parse(user.recognitions) : []
  const education: string[] = user.education ? JSON.parse(user.education) : []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-g4-purple">Talent Card</h1>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 bg-g4-purple text-white px-4 py-2 rounded-lg hover:bg-g4-purple-dark transition-colors text-sm font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Profile Header with Photo */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {user.photo ? (
              <img src={user.photo} alt={user.name}
                className="w-20 h-20 rounded-full object-cover border-3 border-g4-purple/20" />
            ) : (
              <div className="w-20 h-20 bg-g4-purple text-white rounded-full flex items-center justify-center text-3xl font-bold">
                {user.name.charAt(0)}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
            >
              {uploading ? '...' : 'Foto'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-g4-dark">{user.name}</h2>
            <p className="text-gray-500">{user.role} - {user.department}</p>
            <p className="text-gray-400 text-sm">{user.email}</p>
          </div>
          {pos && (
            <div className="text-right">
              <span
                className="inline-block px-4 py-2 rounded-lg text-white text-sm font-bold"
                style={{ backgroundColor: pos.color }}
              >
                {pos.label}
              </span>
              <p className="text-xs text-gray-400 mt-1">{pos.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scores */}
      {result ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <div className="text-3xl font-bold text-g4-purple">{result.cultureScore.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">Cultura</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="bg-g4-purple h-2 rounded-full" style={{ width: `${(result.cultureScore / 4) * 100}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <div className="text-3xl font-bold text-g4-green">{result.resultsScore.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">Resultados</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="bg-g4-green h-2 rounded-full" style={{ width: `${(result.resultsScore / 4) * 100}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <div className="text-3xl font-bold" style={{ color: pos?.color || '#999' }}>
              {((result.cultureScore + result.resultsScore) / 2).toFixed(1)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Media Geral</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="h-2 rounded-full" style={{ width: `${((result.cultureScore + result.resultsScore) / 8) * 100}%`, backgroundColor: pos?.color || '#999' }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 mb-6 text-center">
          <p className="text-gray-400">Seus resultados ainda nao foram consolidados{cycleName ? ` para o ciclo "${cycleName}"` : ''}.</p>
          <p className="text-sm text-gray-400 mt-1">Aguarde a consolidacao pelo administrador.</p>
        </div>
      )}

      {/* Sobre Mim */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-purple">
        <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Sobre Mim
        </h3>
        <EditableText
          value={user.aboutMe || ''}
          onSave={val => updateProfile('aboutMe', val)}
          placeholder="Conte um pouco sobre voce, sua trajetoria e o que te motiva..."
          multiline
        />
      </div>

      {/* Conquistas */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-gold">
        <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Conquistas
        </h3>
        <EditableList
          items={achievements}
          onSave={items => updateProfile('achievements', JSON.stringify(items))}
          placeholder="Ex: Lideranca do projeto X, Certificacao Y..."
        />
      </div>

      {/* Reconhecimentos */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-lime-dark">
        <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-lime-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          Reconhecimentos
        </h3>
        <EditableList
          items={recognitions}
          onSave={items => updateProfile('recognitions', JSON.stringify(items))}
          placeholder="Ex: Funcionario do mes, Destaque no trimestre..."
        />
      </div>

      {/* Formacao */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-magenta">
        <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
          </svg>
          Formacao
        </h3>
        <EditableList
          items={education}
          onSave={items => updateProfile('education', JSON.stringify(items))}
          placeholder="Ex: MBA em Gestao de Projetos - FGV (2024)..."
        />
      </div>

      {/* Interesse de Carreira */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-burgundy">
        <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-burgundy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Interesse de Carreira
        </h3>
        <EditableText
          value={user.careerInterests || ''}
          onSave={val => updateProfile('careerInterests', val)}
          placeholder="Descreva seus objetivos de carreira, areas de interesse, posicoes que almeja..."
          multiline
        />
      </div>

      {/* Evaluations - Full History */}
      {evaluations.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-g4-dark mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Avaliacoes Recebidas (Historico)
          </h3>
          <div className="space-y-4">
            {evaluations.filter(ev => ev.status === 'completed').map((ev) => (
              <div key={ev.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      ev.type === 'self' ? 'bg-g4-purple/10 text-g4-purple' :
                      ev.type === 'manager' ? 'bg-green-100 text-green-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {ev.type === 'self' ? 'Autoavaliacao' : ev.type === 'manager' ? 'Avaliacao do Gestor' : 'Stakeholder'}
                    </span>
                    <span className="text-xs text-gray-400">{ev.cycle?.name || ''}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    C: {ev.cultureScore?.toFixed(1) || '-'} | R: {ev.resultsScore?.toFixed(1) || '-'}
                  </span>
                </div>
                {ev.strengths && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-green-700">Pontos Fortes:</span>
                    <p className="text-sm text-gray-600 mt-1">{ev.strengths}</p>
                  </div>
                )}
                {ev.improvements && (
                  <div>
                    <span className="text-xs font-medium text-amber-700">Oportunidades de Melhoria:</span>
                    <p className="text-sm text-gray-600 mt-1">{ev.improvements}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Feedback & PDI - only visible after cycle is finalized */}
      {cycleActive && result && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-amber-400">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Feedback e PDI</h3>
              <p className="text-sm text-gray-500">Os relatorios de Feedback e Plano de Desenvolvimento Individual (PDI) serao exibidos apos a finalizacao do ciclo de avaliacao pelo administrador.</p>
            </div>
          </div>
        </div>
      )}

      {!cycleActive && result?.aiFeedback && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-purple">
          <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Feedback
          </h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{result.aiFeedback}</div>
        </div>
      )}

      {!cycleActive && result?.aiPDI && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-green">
          <h3 className="text-lg font-semibold text-g4-dark mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7v4m0 0l-2-2m2 2l2-2" />
            </svg>
            Plano de Desenvolvimento Individual (PDI)
          </h3>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{result.aiPDI}</div>
        </div>
      )}

      {/* Behavioral Profile */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-g4-magenta">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-g4-dark flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-g4-magenta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Perfil Comportamental
          </h3>
          <div className="flex items-center gap-2">
            {user.behavioralProfileText?.startsWith('[IA não configurada') && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Texto bruto (sem IA)</span>
            )}
            <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${uploadingProfile ? 'border-gray-200 text-gray-400' : 'border-g4-purple/30 text-g4-purple hover:bg-g4-purple/5'}`}>
              <input
                ref={profileFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                disabled={uploadingProfile}
                onChange={handleProfileUpload}
              />
              {uploadingProfile ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {user.behavioralProfileText ? 'Atualizar perfil' : 'Enviar perfil'}
                </>
              )}
            </label>
          </div>
        </div>
        {user.behavioralProfileText ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none
            [&>p]:mb-2 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-5">{user.behavioralProfileText}</div>
        ) : (
          <div className="text-center py-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-400 mb-1">Nenhum perfil comportamental enviado</p>
            <p className="text-xs text-gray-400">Faca upload do seu perfil DISC, MBTI ou similar (.pdf, .doc, .txt)</p>
          </div>
        )}
      </div>

      {cycleName && (
        <p className="text-center text-xs text-gray-400 mt-4">Ciclo ativo: {cycleName}</p>
      )}
    </div>
  )
}
