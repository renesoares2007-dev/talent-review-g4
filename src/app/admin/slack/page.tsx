'use client'
import { useEffect, useState } from 'react'

interface SlackConfigData {
  botToken: string
  webhookUrl: string
  channel: string
  isActive: boolean
}

export default function SlackConfigPage() {
  const [config, setConfig] = useState<SlackConfigData>({ botToken: '', webhookUrl: '', channel: '', isActive: false })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/slack').then(r => r.json()).then(data => {
      setConfig({
        botToken: data.botToken || '',
        webhookUrl: data.webhookUrl || '',
        channel: data.channel || '',
        isActive: data.isActive || false,
      })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await fetch('/api/slack', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (config.webhookUrl) {
        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '✅ Teste de conexao - Talent Review G4' }),
        })
        setTestResult(res.ok ? 'Webhook enviado com sucesso!' : `Erro: ${res.status}`)
      } else if (config.botToken && config.channel) {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel: config.channel, text: '✅ Teste de conexao - Talent Review G4' }),
        })
        const data = await res.json()
        setTestResult(data.ok ? 'Mensagem enviada com sucesso!' : `Erro: ${data.error}`)
      } else {
        setTestResult('Configure o Webhook URL ou Bot Token + Canal primeiro')
      }
    } catch {
      setTestResult('Erro de conexao com o Slack')
    }
    setTesting(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-g4-purple mb-6 flex items-center gap-3">
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
        Integracao Slack
      </h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-g4-dark">Configuracoes</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">{config.isActive ? 'Ativo' : 'Inativo'}</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={config.isActive}
                onChange={e => setConfig({ ...config, isActive: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-0.5 ${config.isActive ? 'translate-x-5.5 ml-[22px]' : 'ml-0.5'}`} />
              </div>
            </div>
          </label>
        </div>

        <div className="space-y-5">
          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (para canal)</label>
            <input
              type="url"
              value={config.webhookUrl}
              onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm"
              placeholder="https://hooks.slack.com/services/T.../B.../xxx"
            />
            <p className="text-xs text-gray-400 mt-1">Crie em: Slack App &gt; Incoming Webhooks. Envia resumo de pendencias para o canal.</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Opcao avancada - DMs individuais</p>
          </div>

          {/* Bot Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token (para DMs)</label>
            <input
              type="password"
              value={config.botToken}
              onChange={e => setConfig({ ...config, botToken: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm"
              placeholder="xoxb-..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Bot User OAuth Token do Slack App. Permissoes necessarias: <code className="bg-gray-100 px-1 rounded">chat:write</code>, <code className="bg-gray-100 px-1 rounded">users:read.email</code>, <code className="bg-gray-100 px-1 rounded">im:write</code>
            </p>
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Canal padrao</label>
            <input
              type="text"
              value={config.channel}
              onChange={e => setConfig({ ...config, channel: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm"
              placeholder="#avaliacoes"
            />
            <p className="text-xs text-gray-400 mt-1">Usado com Bot Token para enviar resumo ao canal (alternativa ao Webhook).</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-g4-purple text-white px-6 py-2 rounded-lg hover:bg-g4-purple-dark disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : null}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>

          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-white border border-g4-purple text-g4-purple px-6 py-2 rounded-lg hover:bg-g4-purple/5 disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            )}
            Testar Conexao
          </button>

          {saved && <span className="text-green-600 text-sm font-medium">Salvo com sucesso!</span>}
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${testResult.includes('sucesso') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {testResult}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-g4-dark mb-4">Como configurar</h3>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-800 mb-1">Opcao 1: Webhook (simples)</h4>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Acesse <strong>api.slack.com/apps</strong> e crie um novo App</li>
              <li>Ative <strong>Incoming Webhooks</strong></li>
              <li>Adicione um webhook ao canal desejado</li>
              <li>Cole a URL acima</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">Opcao 2: Bot Token (DMs individuais)</h4>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Crie um Slack App em <strong>api.slack.com/apps</strong></li>
              <li>Em <strong>OAuth &amp; Permissions</strong>, adicione os scopes: <code className="bg-gray-100 px-1 rounded">chat:write</code>, <code className="bg-gray-100 px-1 rounded">users:read.email</code>, <code className="bg-gray-100 px-1 rounded">users:read</code>, <code className="bg-gray-100 px-1 rounded">im:write</code></li>
              <li>Instale o App no workspace</li>
              <li>Copie o <strong>Bot User OAuth Token</strong> e cole acima</li>
              <li>Os emails dos colaboradores devem ser iguais aos do Slack</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
