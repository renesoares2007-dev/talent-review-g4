'use client'
import { useEffect, useState } from 'react'

interface Behavior {
  id?: string
  description: string
}

interface CompanyValue {
  id: string
  name: string
  description: string
  behaviors: Behavior[]
}

export default function ValoresPage() {
  const [values, setValues] = useState<CompanyValue[]>([])
  const [editing, setEditing] = useState<CompanyValue | null>(null)
  const [form, setForm] = useState({ name: '', description: '', behaviors: [{ description: '' }] as Behavior[] })

  const loadValues = () => fetch('/api/values').then(r => r.json()).then(setValues)

  useEffect(() => { loadValues() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    await fetch('/api/values', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setForm({ name: '', description: '', behaviors: [{ description: '' }] })
    setEditing(null)
    loadValues()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este valor?')) return
    await fetch(`/api/values?id=${id}`, { method: 'DELETE' })
    loadValues()
  }

  const addBehavior = () => setForm({ ...form, behaviors: [...form.behaviors, { description: '' }] })
  const removeBehavior = (i: number) => setForm({ ...form, behaviors: form.behaviors.filter((_, idx) => idx !== i) })
  const updateBehavior = (i: number, desc: string) => {
    const behaviors = [...form.behaviors]
    behaviors[i] = { ...behaviors[i], description: desc }
    setForm({ ...form, behaviors })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6">Gestão de Valores da Empresa</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Valor' : 'Novo Valor'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Valor</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" placeholder="Ex: Inovação" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800" placeholder="Descrição do valor" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Comportamentos Esperados</label>
          {form.behaviors.map((b, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" required value={b.description} onChange={e => updateBehavior(i, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-800" placeholder={`Comportamento ${i + 1}`} />
              {form.behaviors.length > 1 && (
                <button type="button" onClick={() => removeBehavior(i)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">Remover</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addBehavior} className="text-sm text-g4-purple hover:text-g4-purple-dark">+ Adicionar Comportamento</button>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-g4-purple text-white px-6 py-2 rounded-lg hover:bg-g4-purple-dark">
            {editing ? 'Atualizar' : 'Cadastrar'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm({ name: '', description: '', behaviors: [{ description: '' }] }) }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-800">Cancelar</button>
          )}
        </div>
      </form>

      <div className="grid gap-4">
        {values.map(v => (
          <div key={v.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-g4-dark">{v.name}</h3>
                <p className="text-gray-500 text-sm">{v.description}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(v); setForm({ name: v.name, description: v.description, behaviors: v.behaviors.map(b => ({ description: b.description })) }) }}
                  className="text-sm text-g4-purple hover:text-g4-purple-dark">Editar</button>
                <button onClick={() => handleDelete(v.id)} className="text-sm text-red-600 hover:text-red-800">Excluir</button>
              </div>
            </div>
            {v.behaviors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-600 mb-1">Comportamentos:</p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {v.behaviors.map(b => <li key={b.id}>{b.description}</li>)}
                </ul>
              </div>
            )}
          </div>
        ))}
        {values.length === 0 && <p className="text-gray-400 text-center py-8">Nenhum valor cadastrado ainda.</p>}
      </div>
    </div>
  )
}
