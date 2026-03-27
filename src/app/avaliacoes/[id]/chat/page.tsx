'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  ChatMessage,
  BehaviorInfo,
  AccumulatedData,
  PhaseState,
  ProjectEntry,
  getInitialPhaseState,
  getInitialAccumulatedData,
  getResumeState,
  buildFinalPayload,
} from '@/lib/chat-evaluation'

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const PHASE_LABELS: Record<string, string> = {
  intro: 'Introducao',
  culture: 'Cultura e Valores',
  culture_checkpoint: 'Cultura Concluida',
  results: 'Resultados e Entregas',
  strengths: 'Pontos Fortes',
  improvements: 'Oportunidades de Melhoria',
  tags: 'Tags de Talento',
  review: 'Revisao Final',
  complete: 'Concluido',
}

const PHASE_ORDER_MANAGER = ['intro', 'culture', 'culture_checkpoint', 'results', 'strengths', 'improvements', 'tags', 'review', 'complete']
const PHASE_ORDER_SELF = ['intro', 'culture', 'culture_checkpoint', 'results', 'review', 'complete']
const PHASE_ORDER_OTHER = ['intro', 'culture', 'culture_checkpoint', 'results', 'strengths', 'improvements', 'review', 'complete']

export default function ChatEvaluationPage() {
  const params = useParams()
  const evaluationId = params.id as string

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [phaseState, setPhaseState] = useState<PhaseState>(getInitialPhaseState())
  const [accumulatedData, setAccumulatedData] = useState<AccumulatedData>(getInitialAccumulatedData())
  const [behaviors, setBehaviors] = useState<BehaviorInfo[]>([])
  const [evaluation, setEvaluation] = useState<Record<string, unknown> | null>(null)
  const [quickActions, setQuickActions] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [evidenceFile, setEvidenceFile] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', description: '', deliveryPct: 100 })
  const [projectEvidenceFile, setProjectEvidenceFile] = useState<string>('')
  const [uploadingProjectEvidence, setUploadingProjectEvidence] = useState(false)
  const projectFileRef = useRef<HTMLInputElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  // Check for Speech Recognition support
  useEffect(() => {
    setSpeechSupported(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    )
  }, [])

  const startRecording = useCallback(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'

    let finalTranscript = ''

    recognition.onstart = () => {
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interim += transcript
        }
      }
      setInputText(finalTranscript + interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        alert('Permissao de microfone negada. Verifique as configuracoes do navegador.')
        setSpeechSupported(false)
      }
      setIsRecording(false)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }

    recognition.onend = () => {
      setIsRecording(false)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (finalTranscript.trim()) {
        setInputText(finalTranscript.trim())
      }
      inputRef.current?.focus()
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  // Load evaluation and behaviors on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/evaluations?id=${evaluationId}`).then(r => r.json()),
      fetch('/api/values').then(r => r.json()),
    ]).then(([evalData, values]) => {
      setEvaluation(evalData)

      const allBehaviors: BehaviorInfo[] = []
      for (const v of values) {
        for (const b of v.behaviors) {
          allBehaviors.push({
            id: b.id,
            description: b.description,
            valueName: v.name,
            valueDescription: v.description,
          })
        }
      }
      setBehaviors(allBehaviors)

      // Check if we should resume from a specific phase (admin reset)
      const resumeState = getResumeState(evalData, evalData.type as string, allBehaviors)
      if (resumeState) {
        // Resume from where the admin reset to
        setPhaseState(resumeState.phaseState)
        setAccumulatedData(resumeState.accumulatedData)
        sendMessage('', resumeState.phaseState, resumeState.accumulatedData, allBehaviors, evalData)
      } else {
        // Fresh start
        sendMessage('', getInitialPhaseState(), getInitialAccumulatedData(), allBehaviors, evalData)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId])

  const sendMessage = async (
    text: string,
    currentPhaseState: PhaseState,
    currentData: AccumulatedData,
    currentBehaviors: BehaviorInfo[],
    evalData?: Record<string, unknown>
  ) => {
    const ev = evalData || evaluation
    if (!ev) return

    const subject = ev.subject as Record<string, string>
    const evalType = ev.type as string

    if (text) {
      setMessages(prev => [...prev, { role: 'user', content: text }])
    }

    setIsLoading(true)
    setQuickActions([])
    setInputText('')

    try {
      const res = await fetch('/api/chat-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId,
          message: text,
          phaseState: currentPhaseState,
          accumulatedData: currentData,
          behaviors: currentBehaviors,
          evaluationType: evalType,
          subjectName: subject?.name || 'Colaborador',
          messages: text ? [...messages, { role: 'user', content: text }] : messages,
        }),
      })

      const data = await res.json()

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setPhaseState(data.phaseState)
      setAccumulatedData(data.accumulatedData)
      setQuickActions(data.quickActions || [])

      if (data.isComplete) {
        setIsComplete(true)
        await saveEvaluation(data.accumulatedData, 'completed')
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, houve um erro. Tente novamente.' }])
    }

    setIsLoading(false)
    inputRef.current?.focus()
  }

  const handleSend = () => {
    if (!inputText.trim() || isLoading || isComplete) return
    sendMessage(inputText.trim(), phaseState, accumulatedData, behaviors)
  }

  const handleQuickAction = async (action: string) => {
    if (isLoading || isComplete) return
    if (action === '__SAVE_DRAFT__') {
      await saveEvaluation(accumulatedData, 'in_progress')
      setDraftSaved(true)
      setQuickActions([])
      return
    }
    sendMessage(action, phaseState, accumulatedData, behaviors)
  }

  const saveEvaluation = async (data: AccumulatedData, status: 'in_progress' | 'completed') => {
    setSaving(true)
    // Include projects in accumulated data
    const dataWithProjects = {
      ...data,
      results: data.results ? { ...data.results, projects } : undefined,
    }
    const payload = buildFinalPayload(evaluationId, dataWithProjects, status)
    if (payload.resultsEvaluation && evidenceFile) {
      payload.resultsEvaluation.evidenceFile = evidenceFile
    }
    await fetch('/api/evaluations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
  }

  const addProject = () => {
    if (!projectForm.name.trim()) return
    const newProject: ProjectEntry = {
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      deliveryPct: Math.max(0, Math.min(200, projectForm.deliveryPct)),
      evidenceFile: projectEvidenceFile || undefined,
    }
    setProjects(prev => [...prev, newProject])
    setProjectForm({ name: '', description: '', deliveryPct: 100 })
    setProjectEvidenceFile('')
    setShowProjectForm(false)
  }

  const removeProject = (index: number) => {
    setProjects(prev => prev.filter((_, i) => i !== index))
  }

  const handleProjectEvidenceUpload = async (file: File) => {
    setUploadingProjectEvidence(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'evidence')
    formData.append('employeeId', '')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setProjectEvidenceFile(data.path)
    } catch { /* ignore */ }
    setUploadingProjectEvidence(false)
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'evidence')
    formData.append('employeeId', '')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setEvidenceFile(data.path)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Arquivo "${file.name}" enviado com sucesso! Este sera anexado como evidencia dos resultados.`
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Houve um erro ao enviar o arquivo. Tente novamente.'
      }])
    }
    setUploading(false)
  }

  const handleSaveDraft = async () => {
    await saveEvaluation(accumulatedData, 'in_progress')
    alert('Rascunho salvo com sucesso!')
  }

  const subject = evaluation?.subject as Record<string, string> | undefined
  const evalType = evaluation?.type as string | undefined

  const PHASE_ORDER = evalType === 'manager' ? PHASE_ORDER_MANAGER : evalType === 'self' ? PHASE_ORDER_SELF : PHASE_ORDER_OTHER
  const currentPhaseIndex = PHASE_ORDER.indexOf(phaseState.phase)
  const progress = ((currentPhaseIndex) / (PHASE_ORDER.length - 1)) * 100

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-g4-purple">
            {evalType === 'self' ? 'Autoavaliacao' : evalType === 'manager' ? 'Avaliacao do Gestor' : 'Avaliacao Stakeholder'}
          </h1>
          <p className="text-gray-500 text-sm">
            Avaliado: <strong>{subject?.name}</strong> - {subject?.role}
          </p>
        </div>
        <a href="/avaliacoes" className="text-g4-purple hover:text-g4-purple-dark text-sm">Voltar</a>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow p-3 mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{PHASE_LABELS[phaseState.phase] || phaseState.phase}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-g4-purple h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {PHASE_ORDER.slice(0, -1).map((phase, i) => (
            <div key={phase} className={`text-xs ${i <= currentPhaseIndex ? 'text-g4-purple font-medium' : 'text-gray-400'}`}>
              {i < currentPhaseIndex ? '\u2713' : i === currentPhaseIndex ? '\u25CF' : '\u25CB'}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-xl shadow overflow-y-auto p-4 mb-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-g4-purple text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 bg-g4-purple/10 text-g4-purple rounded-full flex items-center justify-center text-xs font-bold">RH</span>
                    <span className="text-xs text-gray-500">Consultor</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">
                  {msg.content.split('**').map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Draft Saved Banner */}
      {draftSaved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Progresso salvo com sucesso!</p>
              <p className="text-xs text-green-600">Voce pode retomar a avaliacao a qualquer momento.</p>
            </div>
            <a href="/avaliacoes" className="bg-g4-purple text-white px-5 py-2 rounded-lg hover:bg-g4-purple-dark text-sm font-medium transition-colors">
              Voltar para avaliacoes
            </a>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && !isComplete && !draftSaved && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {quickActions.filter(a => a !== '__SAVE_DRAFT__').map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className="bg-white border-2 border-g4-purple/20 text-g4-purple px-4 py-2 rounded-full text-sm hover:bg-g4-purple/5 hover:border-g4-purple/40 transition-colors disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Projects Panel - visible during results phase for self-evaluation */}
      {evalType === 'self' && (phaseState.phase === 'results' || phaseState.phase === 'review') && !isComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Meus Projetos ({projects.length})
            </h4>
            {!showProjectForm && (
              <button onClick={() => setShowProjectForm(true)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">
                + Adicionar Projeto
              </button>
            )}
          </div>

          {/* Project list */}
          {projects.length > 0 && (
            <div className="space-y-2 mb-3">
              {projects.map((p, i) => (
                <div key={i} className="bg-white rounded-lg p-3 text-sm flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.deliveryPct >= 100 ? 'bg-green-100 text-green-700' :
                        p.deliveryPct >= 80 ? 'bg-blue-100 text-blue-700' :
                        p.deliveryPct >= 60 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{p.deliveryPct}%</span>
                    </div>
                    {p.description && <p className="text-gray-500 text-xs mt-1">{p.description}</p>}
                    {p.evidenceFile && <p className="text-blue-600 text-xs mt-1">Evidencia anexada</p>}
                  </div>
                  <button onClick={() => removeProject(i)} className="text-gray-400 hover:text-red-500 ml-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add project form */}
          {showProjectForm && (
            <div className="bg-white rounded-lg p-3 space-y-2">
              <input
                type="text"
                placeholder="Nome do projeto *"
                value={projectForm.name}
                onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800"
              />
              <textarea
                placeholder="Descricao das entregas"
                value={projectForm.description}
                onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none"
                rows={2}
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">% de Entrega</label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={projectForm.deliveryPct}
                    onChange={e => setProjectForm({ ...projectForm, deliveryPct: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">Evidencia</label>
                  <input
                    ref={projectFileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={e => e.target.files?.[0] && handleProjectEvidenceUpload(e.target.files[0])}
                  />
                  <button
                    onClick={() => projectFileRef.current?.click()}
                    disabled={uploadingProjectEvidence}
                    className={`w-full px-3 py-2 rounded-lg text-sm border transition-colors ${
                      projectEvidenceFile ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {uploadingProjectEvidence ? 'Enviando...' : projectEvidenceFile ? 'Anexado' : 'Upload'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => { setShowProjectForm(false); setProjectEvidenceFile('') }} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancelar</button>
                <button onClick={addProject} disabled={!projectForm.name.trim()} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">Salvar Projeto</button>
              </div>
            </div>
          )}

          {projects.length === 0 && !showProjectForm && (
            <p className="text-xs text-blue-600">Nenhum projeto adicionado. Clique em &quot;+ Adicionar Projeto&quot; para comecar.</p>
          )}
        </div>
      )}

      {/* Evidence Upload - visible AFTER results description (review phase or when results are filled) */}
      {evalType !== 'self' && accumulatedData.results?.evidenceText && phaseState.phase !== 'complete' && !isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Evidencias de Resultados</p>
              <p className="text-xs text-amber-600">
                {evidenceFile
                  ? `Arquivo anexado: ${evidenceFile.split('/').pop()}`
                  : 'Envie planilhas, graficos ou documentos que comprovem os resultados'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                evidenceFile
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              } disabled:opacity-50`}
            >
              {uploading ? 'Enviando...' : evidenceFile ? 'Trocar arquivo' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-700 font-medium">Gravando audio...</span>
          <span className="text-xs text-red-500">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
          <span className="text-xs text-red-400 ml-auto">Fale sua resposta e clique no microfone para parar</span>
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isLoading || isComplete}
          placeholder={isComplete ? 'Avaliacao concluida!' : 'Digite ou grave um audio...'}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-g4-purple focus:border-transparent disabled:bg-gray-100"
        />
        {speechSupported && (
          <button
            onClick={toggleRecording}
            disabled={isLoading || isComplete}
            title={isRecording ? 'Parar gravacao' : 'Gravar audio'}
            className={`px-4 py-3 rounded-xl transition-colors disabled:opacity-50 ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-g4-purple'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                </>
              )}
            </svg>
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={isLoading || isComplete || !inputText.trim()}
          className="bg-g4-purple text-white px-6 py-3 rounded-xl hover:bg-g4-purple-dark disabled:opacity-50 transition-colors"
        >
          Enviar
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-between mt-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving || isComplete || accumulatedData.behaviors.length === 0}
          className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar rascunho'}
        </button>
        <div className="flex gap-2">
          {phaseState.phase === 'review' && !isComplete && (
            <button
              onClick={() => handleQuickAction('Confirmar e finalizar')}
              disabled={isLoading}
              className="text-sm bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              Finalizar Avaliacao
            </button>
          )}
          {isComplete && (
            <a href="/avaliacoes" className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              Voltar para avaliacoes
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
