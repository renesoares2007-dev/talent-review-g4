const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callAI(messages: AIMessage[], systemPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return '[IA não configurada - defina ANTHROPIC_API_KEY no .env]'
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API Error: ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}

export async function suggestCultureScore(
  valueName: string,
  behaviorDescription: string,
  example: string,
  frequency: number
): Promise<{ suggestedScore: number; reasoning: string }> {
  const prompt = `Você é um especialista em avaliação de desempenho organizacional.

Analise a seguinte avaliação de cultura e sugira uma nota de 0 a 4:
- 0: Nunca apresenta
- 1: Raramente apresenta
- 2: Às vezes apresenta
- 3: Sempre apresenta
- 4: É uma referência nesse valor

Valor: ${valueName}
Comportamento esperado: ${behaviorDescription}
Exemplo fornecido pelo avaliador: ${example}
Frequência indicada pelo avaliador: ${frequency}

Responda APENAS em JSON no formato: {"suggestedScore": X, "reasoning": "explicação"}`

  const result = await callAI([{ role: 'user', content: prompt }], 'Você é um assistente de RH especialista em avaliação de desempenho.')
  try {
    return JSON.parse(result)
  } catch {
    return { suggestedScore: frequency, reasoning: result }
  }
}

export async function generateFeedbackAndPDI(params: {
  employeeName: string
  selfEvaluation: string
  managerEvaluation: string
  stakeholderEvaluations: string[]
  strengths: string[]
  improvements: string[]
  cultureScore: number
  resultsScore: number
  nineboxPosition: string
  behavioralProfile?: string
}): Promise<{ feedback: string; pdi: string }> {
  const prompt = `Você é um especialista em desenvolvimento organizacional e gestão de pessoas.

Com base nos dados abaixo, gere:
1. Um FEEDBACK estruturado e construtivo para o colaborador
2. Um PLANO DE DESENVOLVIMENTO INDIVIDUAL (PDI) com ações específicas

DADOS DO COLABORADOR:
- Nome: ${params.employeeName}
- Nota Cultura: ${params.cultureScore}/4
- Nota Resultados: ${params.resultsScore}/4
- Posição Ninebox: ${params.nineboxPosition}

AUTOAVALIAÇÃO:
${params.selfEvaluation}

AVALIAÇÃO DO GESTOR:
${params.managerEvaluation}

AVALIAÇÕES DE STAKEHOLDERS:
${params.stakeholderEvaluations.join('\n---\n')}

PONTOS FORTES IDENTIFICADOS:
${params.strengths.join('\n- ')}

PONTOS DE MELHORIA:
${params.improvements.join('\n- ')}

${params.behavioralProfile ? `PERFIL COMPORTAMENTAL:
${params.behavioralProfile}

IMPORTANTE: Correlacione o perfil comportamental com as necessidades de desenvolvimento para sugerir treinamentos personalizados.` : ''}

Responda em JSON no formato:
{
  "feedback": "Texto completo do feedback estruturado...",
  "pdi": "Plano de desenvolvimento individual detalhado com ações, prazos e indicadores..."
}`

  const result = await callAI([{ role: 'user', content: prompt }], 'Você é um consultor de RH e desenvolvimento organizacional.')
  try {
    return JSON.parse(result)
  } catch {
    return {
      feedback: result,
      pdi: 'PDI não pôde ser gerado automaticamente. Revise os dados e tente novamente.'
    }
  }
}

export async function summarizeBehavioralProfile(text: string, employeeName: string): Promise<string> {
  const prompt = `Você é um especialista em análise de perfil comportamental.

Analise o texto do perfil comportamental abaixo e gere um RESUMO ESTRUTURADO em português com os seguintes tópicos:

1. **Perfil Dominante**: Qual é o estilo comportamental principal (ex: Comunicador, Executor, Planejador, Analista, etc.)
2. **Pontos Fortes**: 3-5 características positivas mais marcantes
3. **Pontos de Atenção**: 2-3 áreas que merecem cuidado
4. **Estilo de Trabalho**: Como essa pessoa tende a atuar no ambiente profissional
5. **Dicas de Gestão**: Como melhor liderar e se comunicar com essa pessoa

TEXTO DO PERFIL DE ${employeeName}:
${text.substring(0, 4000)}

Responda de forma clara e objetiva, usando bullet points quando apropriado. Não use formato JSON, responda em texto corrido com os tópicos acima.`

  return callAI([{ role: 'user', content: prompt }], 'Você é um psicólogo organizacional especialista em perfis comportamentais como DISC, MBTI e similares.')
}

export async function generateConsolidatedAnalysis(params: {
  employeeName: string
  evaluations: Array<{
    type: string
    cultureScore: number
    resultsScore: number
    strengths?: string
    improvements?: string
  }>
}): Promise<string> {
  const prompt = `Analise as seguintes avaliações de ${params.employeeName} e forneça uma análise consolidada:

${params.evaluations.map(e => `
Tipo: ${e.type}
Cultura: ${e.cultureScore}/4
Resultados: ${e.resultsScore}/4
Pontos Fortes: ${e.strengths || 'N/A'}
Melhorias: ${e.improvements || 'N/A'}
`).join('\n---\n')}

Forneça uma análise consolidada incluindo:
1. Média ponderada sugerida (gestor peso 2, stakeholders peso 1 cada, auto peso 1)
2. Padrões identificados entre as avaliações
3. Divergências significativas entre avaliadores
4. Recomendações gerais`

  return callAI([{ role: 'user', content: prompt }], 'Você é um analista de RH especialista em avaliação 360.')
}
