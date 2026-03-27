'use client'
import { useEffect, useState, useRef } from 'react'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string
  managerId: string | null
  isAdmin: boolean
  isManager: boolean
  behavioralProfile: string | null
  manager?: { id: string; name: string }
}

interface ImportResult {
  success: boolean
  summary?: { total: number; created: number; updated: number; createdNames: string[]; updatedNames: string[] }
  error?: string
  details?: string[]
}

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: '', department: '', managerId: '', isAdmin: false, isManager: false })
  const [uploading, setUploading] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'individual' | 'planilha'>('individual')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadEmployees = () => fetch('/api/employees').then(r => r.json()).then(setEmployees)
  useEffect(() => { loadEmployees() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    await fetch('/api/employees', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, managerId: body.managerId || null }),
    })
    setForm({ name: '', email: '', role: '', department: '', managerId: '', isAdmin: false, isManager: false })
    setEditing(null)
    loadEmployees()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este colaborador?')) return
    await fetch(`/api/employees?id=${id}`, { method: 'DELETE' })
    loadEmployees()
  }

  const handleUploadProfile = async (employeeId: string, file: File) => {
    setUploading(employeeId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'behavioral_profile')
    formData.append('employeeId', employeeId)
    await fetch('/api/upload', { method: 'POST', body: formData })
    setUploading(null)
    loadEmployees()
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/employees/import', { method: 'POST', body: formData })
      const data = await res.json()
      setImportResult(data)
      if (data.success) loadEmployees()
    } catch {
      setImportResult({ success: false, error: 'Erro de conexão ao importar planilha' })
    }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownloadTemplate = () => {
    const header = ['nome', 'email', 'cargo', 'departamento', 'gestor_email', 'is_admin', 'is_manager']
    const example = ['João Silva', 'joao@empresa.com', 'Analista', 'Tecnologia', 'maria@empresa.com', 'nao', 'nao']
    const csvContent = [header.join(';'), example.join(';')].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-colaboradores.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Gestão de Colaboradores</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'individual' ? 'bg-white text-g4-purple shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Cadastro Individual
          </span>
        </button>
        <button
          onClick={() => setActiveTab('planilha')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'planilha' ? 'bg-white text-g4-purple shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Importar Planilha
          </span>
        </button>
      </div>

      {/* Individual Form */}
      {activeTab === 'individual' && (
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
            <input type="text" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
            <input type="text" required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gestor</label>
            <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800">
              <option value="">Sem gestor</option>
              {employees.filter(e => e.id !== editing?.id).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isManager} onChange={e => setForm({ ...form, isManager: e.target.checked })} />
              <span className="text-sm text-gray-700">Gestor</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isAdmin} onChange={e => setForm({ ...form, isAdmin: e.target.checked })} />
              <span className="text-sm text-gray-700">Admin</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-g4-purple text-white px-6 py-2 rounded-lg hover:bg-g4-purple-dark">
            {editing ? 'Atualizar' : 'Cadastrar'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ name: '', email: '', role: '', department: '', managerId: '', isAdmin: false, isManager: false }) }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-800">Cancelar</button>
          )}
        </div>
      </form>
      )}

      {/* Spreadsheet Import */}
      {activeTab === 'planilha' && (
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Importar Colaboradores via Planilha</h2>
        <p className="text-sm text-gray-600 mb-4">
          Envie um arquivo <strong>.xlsx</strong> ou <strong>.csv</strong> com os dados dos colaboradores.
          Colaboradores com email já existente serão atualizados.
        </p>

        {/* Expected columns */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Colunas esperadas:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-semibold text-g4-purple">nome</span>
              <span className="text-red-500">*</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-semibold text-g4-purple">email</span>
              <span className="text-red-500">*</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-semibold text-g4-purple">cargo</span>
              <span className="text-red-500">*</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-semibold text-g4-purple">departamento</span>
              <span className="text-red-500">*</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-medium text-gray-600">gestor_email</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-medium text-gray-600">is_admin</span>
            </div>
            <div className="bg-white rounded px-2 py-1.5 border">
              <span className="font-medium text-gray-600">is_manager</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <span className="text-red-500">*</span> Obrigatório. Para admin/gestor use: sim, nao, true, false, 1, 0
          </p>
        </div>

        {/* Upload area */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${importing ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-g4-purple hover:bg-blue-50/30'}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importing}
              onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
            {importing ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-8 w-8 text-g4-purple" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-gray-500">Importando...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-600">Clique para selecionar arquivo <strong>.xlsx</strong> ou <strong>.csv</strong></span>
                <span className="text-xs text-gray-400">Ou arraste e solte aqui</span>
              </div>
            )}
          </label>
        </div>

        <button onClick={handleDownloadTemplate} type="button"
          className="text-sm text-g4-purple hover:text-g4-purple-dark flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Baixar modelo de planilha (.csv)
        </button>

        {/* Import Result */}
        {importResult && (
          <div className={`mt-4 rounded-lg p-4 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {importResult.success && importResult.summary ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-green-800">Importação concluída!</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-gray-800">{importResult.summary.total}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{importResult.summary.created}</div>
                    <div className="text-xs text-gray-500">Criados</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-blue-600">{importResult.summary.updated}</div>
                    <div className="text-xs text-gray-500">Atualizados</div>
                  </div>
                </div>
                {importResult.summary.createdNames.length > 0 && (
                  <p className="text-xs text-green-700">
                    <strong>Criados:</strong> {importResult.summary.createdNames.join(', ')}
                  </p>
                )}
                {importResult.summary.updatedNames.length > 0 && (
                  <p className="text-xs text-blue-700 mt-1">
                    <strong>Atualizados:</strong> {importResult.summary.updatedNames.join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-800">{importResult.error}</span>
                </div>
                {importResult.details && (
                  <ul className="text-xs text-red-700 space-y-0.5 mt-1 max-h-32 overflow-y-auto">
                    {importResult.details.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Depto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Gestor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Perfil</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-800">{emp.name} {emp.isManager && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Gestor</span>}</td>
                <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                <td className="px-4 py-3 text-gray-600">{emp.role}</td>
                <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                <td className="px-4 py-3 text-gray-600">{emp.manager?.name || '-'}</td>
                <td className="px-4 py-3">
                  {emp.behavioralProfile ? (
                    <span className="text-green-600 text-xs">Enviado</span>
                  ) : (
                    <label className="cursor-pointer text-xs text-g4-purple hover:text-g4-purple-dark">
                      {uploading === emp.id ? 'Enviando...' : 'Upload'}
                      <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUploadProfile(emp.id, e.target.files[0])} />
                    </label>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setEditing(emp); setForm({ name: emp.name, email: emp.email, role: emp.role, department: emp.department, managerId: emp.managerId || '', isAdmin: emp.isAdmin, isManager: emp.isManager }) }}
                    className="text-g4-purple hover:text-g4-purple-dark mr-2">Editar</button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p className="text-gray-400 text-center py-8">Nenhum colaborador cadastrado.</p>}
      </div>
    </div>
  )
}
