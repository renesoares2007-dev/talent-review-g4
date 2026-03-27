'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function StakeholderEvalPage() {
  const params = useParams()
  const token = params.token as string
  const [linkData, setLinkData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/stakeholder-links?token=${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Link invalido ou expirado')
        return r.json()
      })
      .then(setLinkData)
      .catch(err => setError(err.message))
  }, [token])

  if (error) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Link Invalido</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }

  if (!linkData) return <div className="text-center py-12 text-gray-400">Carregando...</div>

  const evaluation = linkData.evaluation as Record<string, unknown>
  const evaluationId = evaluation?.id as string

  if (linkData.isCompleted) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-green-600 mb-2">Avaliacao ja Concluida</h1>
        <p className="text-gray-500">Voce ja respondeu esta avaliacao. Obrigado!</p>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-blue-900">
          Voce foi indicado como stakeholder para avaliar <strong>{(evaluation?.subject as Record<string, string>)?.name}</strong>.
          Preencha a avaliacao abaixo.
        </p>
      </div>
      {/* Redirect to the evaluation form */}
      <meta httpEquiv="refresh" content={`0;url=/avaliacoes/${evaluationId}`} />
      <p className="text-gray-500">Redirecionando para o formulario de avaliacao...</p>
    </div>
  )
}
