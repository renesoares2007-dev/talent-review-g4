// ==================== TYPES ====================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BehaviorInfo {
  id: string
  description: string
  valueName: string
  valueDescription: string
}

export interface ExtractedBehavior {
  behaviorId: string
  example: string
  frequency: number
}

export interface ProjectEntry {
  name: string
  description: string
  deliveryPct: number
  evidenceFile?: string
}

export interface ExtractedResults {
  evidenceText: string
  classification: 'nao_entrega' | 'entrega' | 'acima_expectativa'
  score: number
  projects?: ProjectEntry[]
}

export interface AccumulatedData {
  behaviors: ExtractedBehavior[]
  results?: ExtractedResults
  strengths?: string
  improvements?: string
  tags?: string[]
}

export const TALENT_TAGS: Record<string, { label: string; color: string; description: string }> = {
  risco_turnover: { label: 'Risco de Turn Over', color: '#ef4444', description: 'Risco de saida da empresa' },
  potencial_sucessao: { label: 'Potencial Sucessao', color: '#3b82f6', description: 'Potencial para assumir posicoes superiores' },
  key_talent: { label: 'Key Talent', color: '#8b5cf6', description: 'Talento-chave para a organizacao' },
  high_potential: { label: 'High Potential', color: '#22c55e', description: 'Alto potencial de crescimento' },
}

export type ConversationPhase =
  | 'intro'
  | 'culture'
  | 'culture_checkpoint'
  | 'results'
  | 'strengths'
  | 'improvements'
  | 'tags'
  | 'review'
  | 'complete'

export interface PhaseState {
  phase: ConversationPhase
  currentValueIndex: number
  currentBehaviorIndex: number
  waitingForFollowUp: boolean
  isEditing?: boolean
}

export interface ChatRequest {
  evaluationId: string
  message: string
  phaseState: PhaseState
  accumulatedData: AccumulatedData
  behaviors: BehaviorInfo[]
  evaluationType: string
  subjectName: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  reply: string
  phaseState: PhaseState
  accumulatedData: AccumulatedData
  isComplete: boolean
  quickActions?: string[]
}

// ==================== PHASE LOGIC ====================

export function getInitialPhaseState(): PhaseState {
  return {
    phase: 'intro',
    currentValueIndex: 0,
    currentBehaviorIndex: 0,
    waitingForFollowUp: false,
  }
}

export function getInitialAccumulatedData(): AccumulatedData {
  return { behaviors: [] }
}

// Determine which phase to resume from based on existing evaluation data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getResumeState(evalData: any, evalType: string, allBehaviors: BehaviorInfo[]): { phaseState: PhaseState; accumulatedData: AccumulatedData } | null {
  if (!evalData || evalData.status === 'completed' || evalData.status === 'pending') return null

  const hasCulture = evalData.cultureEvaluations && evalData.cultureEvaluations.length > 0
  const hasResults = evalData.resultsEvaluation
  const hasStrengths = evalData.strengths
  const hasImprovements = evalData.improvements
  const hasTags = evalData.tags

  // Build accumulated data from existing evaluation
  const accData: AccumulatedData = { behaviors: [] }

  if (hasCulture) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accData.behaviors = evalData.cultureEvaluations.map((ce: any) => ({
      behaviorId: ce.behaviorId,
      example: ce.example || '',
      frequency: ce.frequency,
    }))
  }

  if (hasResults) {
    accData.results = {
      evidenceText: evalData.resultsEvaluation.evidenceText || '',
      classification: evalData.resultsEvaluation.classification,
      score: evalData.resultsEvaluation.score,
    }
  }

  if (hasStrengths) accData.strengths = evalData.strengths
  if (hasImprovements) accData.improvements = evalData.improvements
  if (hasTags) {
    try { accData.tags = JSON.parse(evalData.tags) } catch { accData.tags = [] }
  }

  // Determine which phase to start from based on what's missing
  let phase: ConversationPhase = 'culture'

  if (!hasCulture) {
    phase = 'culture'
  } else if (!hasResults) {
    phase = 'results'
  } else if (!hasStrengths && (evalType === 'manager' || evalType === 'stakeholder')) {
    phase = 'strengths'
  } else if (!hasImprovements && (evalType === 'manager' || evalType === 'stakeholder')) {
    phase = 'improvements'
  } else if (!hasTags && evalType === 'manager') {
    phase = 'tags'
  } else {
    // Everything exists but was reset — go to review
    phase = 'review'
  }

  return {
    phaseState: {
      phase,
      currentValueIndex: 0,
      currentBehaviorIndex: 0,
      waitingForFollowUp: false,
    },
    accumulatedData: accData,
  }
}

export function getGroupedBehaviors(behaviors: BehaviorInfo[]): Map<string, BehaviorInfo[]> {
  const grouped = new Map<string, BehaviorInfo[]>()
  for (const b of behaviors) {
    const key = b.valueName
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(b)
  }
  return grouped
}

export function getUniqueValues(behaviors: BehaviorInfo[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const b of behaviors) {
    if (!seen.has(b.valueName)) {
      seen.add(b.valueName)
      result.push(b.valueName)
    }
  }
  return result
}

// ==================== DATA EXTRACTION ====================

export function extractDataBlock(aiResponse: string): { cleanMessage: string; data: Record<string, unknown> | null } {
  const dataMatch = aiResponse.match(/<DATA>([\s\S]*?)<\/DATA>/)
  if (!dataMatch) return { cleanMessage: aiResponse, data: null }

  const cleanMessage = aiResponse.replace(/<DATA>[\s\S]*?<\/DATA>/, '').trim()
  try {
    const data = JSON.parse(dataMatch[1])
    return { cleanMessage, data }
  } catch {
    return { cleanMessage, data: null }
  }
}

export function classificationToScore(classification: string): number {
  if (classification === 'nao_entrega') return 1
  if (classification === 'acima_expectativa') return 4
  return 2.5
}

// ==================== SYSTEM PROMPTS ====================

export function buildSystemPrompt(
  phaseState: PhaseState,
  behaviors: BehaviorInfo[],
  evaluationType: string,
  subjectName: string,
  accumulatedData: AccumulatedData
): string {
  const isSelf = evaluationType === 'self'
  const pronoun = isSelf ? 'voce' : subjectName
  const possessive = isSelf ? 'suas' : `de ${subjectName}`

  const baseInstructions = `Voce e um consultor de RH conduzindo uma avaliacao de desempenho${isSelf ? ' (autoavaliacao)' : ''} para ${subjectName}.
Responda sempre em portugues brasileiro, de forma acolhedora e profissional.
Seja conversacional - como um dialogo natural, nao um interrogatorio.
Faca uma pergunta por vez. Mantenha respostas curtas (2-4 frases).

IMPORTANTE: Ao final de cada resposta, inclua um bloco <DATA> com dados estruturados extraidos.
O bloco <DATA> NUNCA deve aparecer na mensagem visivel ao usuario.`

  switch (phaseState.phase) {
    case 'intro':
      return `${baseInstructions}

Voce esta na fase de INTRODUCAO.
Cumprimente o avaliador, confirme que a avaliacao e sobre ${subjectName} (${evaluationType === 'self' ? 'autoavaliacao' : evaluationType === 'manager' ? 'avaliacao como gestor' : 'avaliacao como stakeholder'}).
Explique brevemente que vao conversar sobre valores/cultura e resultados.
Pergunte se esta pronto para comecar.

Inclua ao final:
<DATA>{"action": "ready"}</DATA>`

    case 'culture': {
      const uniqueValues = getUniqueValues(behaviors)
      const currentValue = uniqueValues[phaseState.currentValueIndex]
      const valueBehaviors = currentValue ? behaviors.filter(b => b.valueName === currentValue) : []

      if (!currentValue || phaseState.currentValueIndex >= uniqueValues.length) {
        return `${baseInstructions}\nFase de cultura concluida. Inclua: <DATA>{"action": "phase_complete"}</DATA>`
      }

      const alreadyEvaluated = accumulatedData.behaviors.map(b => b.behaviorId)
      const remainingValues = uniqueValues.length - phaseState.currentValueIndex
      const behaviorsListText = valueBehaviors.map(b => `- ${b.description}`).join('\n')

      return `${baseInstructions}

Voce esta na fase de CULTURA - avaliando valores e comportamentos.
Valor atual: "${currentValue}" (${valueBehaviors[0]?.valueDescription || ''})
Valores restantes: ${remainingValues}

Comportamentos esperados para este valor:
${behaviorsListText}

FLUXO EM 2 ETAPAS:
${!phaseState.waitingForFollowUp
  ? `ETAPA 1: Pergunte como o avaliador avalia ${pronoun} no valor "${currentValue}".
Peca que classifique de 0 a 4:
0 = Nunca apresenta
1 = Raramente apresenta
2 = As vezes apresenta
3 = Sempre apresenta
4 = E uma referencia nesse valor

Inclua ao final:
<DATA>{"moveToNext": false}</DATA>`
  : `ETAPA 2: O avaliador ja deu a nota. Agora peca exemplos concretos de situacoes onde ${pronoun} demonstrou (ou nao) os comportamentos deste valor.
Liste os comportamentos como referencia para o avaliador:
${behaviorsListText}

Com base na resposta, inclua os dados de TODOS os comportamentos deste valor:
<DATA>{"valueBehaviors": [${valueBehaviors.map(b => `{"behaviorId": "${b.id}", "example": "resumo", "frequency": N}`).join(', ')}], "moveToNext": true}</DATA>`
}`
    }

    case 'culture_checkpoint':
      return `${baseInstructions}

FASE DE CHECKPOINT POS-CULTURA.
Parabenize o avaliador por completar a avaliacao de cultura e valores.
Apresente um resumo rapido: ${accumulatedData.behaviors.length} comportamentos avaliados.
Pergunte se deseja continuar para a avaliacao de resultados e entregas agora, ou se prefere salvar o progresso e continuar depois.

Inclua ao final:
<DATA>{"action": "checkpoint"}</DATA>`

    case 'results':
      return `${baseInstructions}

Voce esta na fase de RESULTADOS - avaliando entregas e metas.
Pergunte sobre as entregas ${possessive} no periodo: metas atingidas, projetos concluidos, resultados quantitativos.
Peca comparativos de meta vs real quando possivel.

Com base na resposta, classifique:
- "nao_entrega": Nao entrega resultados ou entrega muito abaixo
- "entrega": Entrega resultados dentro do esperado
- "acima_expectativa": Entrega resultados acima da expectativa

Inclua ao final:
<DATA>{"evidenceText": "resumo das entregas", "classification": "entrega|nao_entrega|acima_expectativa", "ready": true}</DATA>

Se precisar de mais informacoes, inclua:
<DATA>{"ready": false}</DATA>`

    case 'strengths':
      return `${baseInstructions}

Voce esta na fase de PONTOS FORTES.
Pergunte: Quais sao os principais pontos fortes e forcas ${possessive}? O que ${pronoun} faz de melhor?

Inclua ao final:
<DATA>{"value": "resumo dos pontos fortes"}</DATA>`

    case 'improvements':
      return `${baseInstructions}

Voce esta na fase de OPORTUNIDADES DE MELHORIA.
Pergunte: Quais areas ${pronoun} poderia desenvolver? Que oportunidades de melhoria voce identifica?

Inclua ao final:
<DATA>{"value": "resumo das oportunidades"}</DATA>`

    case 'tags':
      return `${baseInstructions}

FASE DE TAGS DE TALENTO.
Peca ao gestor para selecionar as tags que melhor descrevem ${subjectName}. Pode selecionar mais de uma ou nenhuma:

- **Risco de Turn Over**: Colaborador com risco de sair da empresa
- **Potencial Sucessao**: Potencial para assumir posicoes de lideranca
- **Key Talent**: Talento-chave para a organizacao
- **High Potential**: Alto potencial de crescimento e desenvolvimento

Inclua ao final:
<DATA>{"tags": ["risco_turnover", "potencial_sucessao", "key_talent", "high_potential"]}</DATA>
(inclua apenas as tags selecionadas pelo gestor)`

    case 'review':
      return `${baseInstructions}

FASE DE REVISAO.
Apresente um resumo da avaliacao ao usuario:

Cultura (comportamentos avaliados):
${accumulatedData.behaviors.map(b => {
  const info = behaviors.find(bi => bi.id === b.behaviorId)
  const labels = ['Nunca', 'Raramente', 'As vezes', 'Sempre', 'Referencia']
  return `- ${info?.valueName} / ${info?.description}: ${labels[b.frequency]} (${b.frequency}/4)`
}).join('\n')}

Resultados: ${accumulatedData.results?.classification === 'acima_expectativa' ? 'Acima da expectativa' : accumulatedData.results?.classification === 'entrega' ? 'Entrega resultados' : 'Nao entrega'} (${accumulatedData.results?.score}/4)
${accumulatedData.strengths ? `Pontos Fortes: ${accumulatedData.strengths}` : ''}
${accumulatedData.improvements ? `Melhorias: ${accumulatedData.improvements}` : ''}
${accumulatedData.tags && accumulatedData.tags.length > 0 ? `Tags: ${accumulatedData.tags.map(t => TALENT_TAGS[t]?.label || t).join(', ')}` : ''}

Pergunte se o avaliador confirma ou deseja ajustar algo.

<DATA>{"action": "review_shown"}</DATA>`

    default:
      return baseInstructions
  }
}

// ==================== FALLBACK (sem API key) ====================

export function generateFallbackResponse(
  phaseState: PhaseState,
  behaviors: BehaviorInfo[],
  evaluationType: string,
  subjectName: string,
  accumulatedData: AccumulatedData,
  userMessage: string
): ChatResponse {
  const isSelf = evaluationType === 'self'
  const pronoun = isSelf ? 'voce' : subjectName

  switch (phaseState.phase) {
    case 'intro':
      return {
        reply: `Ola! Vamos iniciar a avaliacao ${isSelf ? 'de autoavaliacao' : `de ${subjectName}`}. Vou te guiar com algumas perguntas sobre cultura e resultados. Vamos comecar?`,
        phaseState: { ...phaseState, phase: 'culture' },
        accumulatedData,
        isComplete: false,
        quickActions: ['Sim, vamos comecar!'],
      }

    case 'culture': {
      // Culture flow per value:
      //   waitingForFollowUp=false → Step 1: present value and ask frequency
      //   waitingForFollowUp=true  → Step 2: ask for examples (frequency stored in currentBehaviorIndex)
      //   After examples → save and move to next value

      const uniqueValues = getUniqueValues(behaviors)
      const currentValue = uniqueValues[phaseState.currentValueIndex]
      const valueBehaviors = currentValue ? behaviors.filter(b => b.valueName === currentValue) : []
      const isEditing = phaseState.isEditing || false

      // Helper: get existing frequency for a value (in edit mode)
      const getExistingFrequency = (valName: string): number | null => {
        const existing = accumulatedData.behaviors.find(b => {
          const info = behaviors.find(bi => bi.id === b.behaviorId)
          return info?.valueName === valName
        })
        return existing ? existing.frequency : null
      }

      // Helper: build frequency quick actions with current selection marked
      const buildFreqActions = (valName: string): string[] => {
        const labels = ['0 - Nunca', '1 - Raramente', '2 - As vezes', '3 - Sempre', '4 - Referencia']
        const existingFreq = getExistingFrequency(valName)
        if (existingFreq !== null && isEditing) {
          return labels.map((l, i) => i === existingFreq ? `${l} (atual)` : l)
        }
        return labels
      }

      // Helper: transition after completing a value in culture
      const cultureValueCompleted = (newBehaviors: ExtractedBehavior[], nextVI: number): ChatResponse => {
        const nextValue = uniqueValues[nextVI]
        if (!nextValue) {
          // Culture complete
          if (isEditing) {
            // In edit mode → skip checkpoint, go to results editing
            return {
              reply: `Revisao de cultura concluida! Agora vamos revisar os **Resultados e Entregas**.\n\nDescreva as entregas e metas${accumulatedData.results?.evidenceText ? `\n\n**Resposta anterior:** ${accumulatedData.results.evidenceText}` : ''}`,
              phaseState: { phase: 'results', currentValueIndex: 0, currentBehaviorIndex: 0, waitingForFollowUp: false, isEditing: true },
              accumulatedData: { ...accumulatedData, behaviors: newBehaviors },
              isComplete: false,
              quickActions: accumulatedData.results ? ['Manter resposta atual'] : undefined,
            }
          }
          return {
            reply: `Excelente! Terminamos a avaliacao de **Cultura e Valores**. Foram avaliados ${newBehaviors.length} comportamentos.\n\nDeseja continuar para a avaliacao de **Resultados e Entregas** agora, ou prefere salvar o progresso e continuar depois?`,
            phaseState: { phase: 'culture_checkpoint', currentValueIndex: 0, currentBehaviorIndex: 0, waitingForFollowUp: false },
            accumulatedData: { ...accumulatedData, behaviors: newBehaviors },
            isComplete: false,
            quickActions: ['Sim, continuar', 'Nao, salvar e voltar depois'],
          }
        }

        const nextValueDesc = behaviors.find(b => b.valueName === nextValue)?.valueDescription || ''
        const existingFreqNext = getExistingFrequency(nextValue)
        const currentLabel = existingFreqNext !== null && isEditing
          ? `\n\n**Nota atual: ${existingFreqNext}/4** - Voce pode manter ou alterar.`
          : ''

        return {
          reply: `Registrado! Agora vamos ${isEditing ? 'revisar' : 'avaliar'} o valor **${nextValue}**${nextValueDesc ? ` - ${nextValueDesc}` : ''}.${currentLabel}\n\nComo ${pronoun === 'voce' ? 'voce avalia a si mesmo(a)' : `voce avalia ${pronoun}`} neste valor?`,
          phaseState: { phase: 'culture', currentValueIndex: nextVI, currentBehaviorIndex: 0, waitingForFollowUp: false, isEditing },
          accumulatedData: { ...accumulatedData, behaviors: newBehaviors },
          isComplete: false,
          quickActions: buildFreqActions(nextValue),
        }
      }

      if (!currentValue || phaseState.currentValueIndex >= uniqueValues.length) {
        return cultureValueCompleted(accumulatedData.behaviors, phaseState.currentValueIndex)
      }

      const valueDescription = valueBehaviors[0]?.valueDescription || ''
      const behaviorsListText = valueBehaviors.map((b, i) => `${i + 1}. ${b.description}`).join('\n')
      const askFrequency = pronoun === 'voce' ? 'voce avalia a si mesmo(a)' : `voce avalia ${pronoun}`
      const existingFreq = getExistingFrequency(currentValue)

      if (phaseState.waitingForFollowUp) {
        // Step 2: We already have the frequency, now we need examples
        if (userMessage) {
          const frequency = phaseState.currentBehaviorIndex
          // In edit mode, remove old behaviors for this value before adding new ones
          const filteredBehaviors = isEditing
            ? accumulatedData.behaviors.filter(b => {
                const info = behaviors.find(bi => bi.id === b.behaviorId)
                return info?.valueName !== currentValue
              })
            : accumulatedData.behaviors

          const newBehaviors = [
            ...filteredBehaviors,
            ...valueBehaviors.map(b => ({
              behaviorId: b.id,
              example: userMessage,
              frequency,
            })),
          ]

          const nextVI = phaseState.currentValueIndex + 1
          return cultureValueCompleted(newBehaviors, nextVI)
        }

        // Get existing example for edit mode
        const existingExample = isEditing
          ? accumulatedData.behaviors.find(b => {
              const info = behaviors.find(bi => bi.id === b.behaviorId)
              return info?.valueName === currentValue
            })?.example
          : null

        return {
          reply: `Considerando os comportamentos esperados para **${currentValue}**:\n\n${behaviorsListText}\n\n${existingExample && isEditing ? `**Exemplo anterior:** ${existingExample}\n\n` : ''}Cite exemplos de situacoes onde ${pronoun === 'voce' ? 'voce demonstrou' : `${pronoun} demonstrou`} (ou nao) esses comportamentos.`,
          phaseState,
          accumulatedData,
          isComplete: false,
          quickActions: existingExample && isEditing ? ['Manter exemplo atual'] : undefined,
        }
      }

      // Step 1: Ask frequency
      if (userMessage) {
        // Handle "Manter exemplo atual" in edit mode
        if (isEditing && userMessage.toLowerCase().includes('manter exemplo')) {
          const existingExample = accumulatedData.behaviors.find(b => {
            const info = behaviors.find(bi => bi.id === b.behaviorId)
            return info?.valueName === currentValue
          })?.example || ''

          const frequency = phaseState.currentBehaviorIndex
          const filteredBehaviors = accumulatedData.behaviors.filter(b => {
            const info = behaviors.find(bi => bi.id === b.behaviorId)
            return info?.valueName !== currentValue
          })
          const newBehaviors = [
            ...filteredBehaviors,
            ...valueBehaviors.map(b => ({
              behaviorId: b.id,
              example: existingExample,
              frequency,
            })),
          ]
          const nextVI = phaseState.currentValueIndex + 1
          return cultureValueCompleted(newBehaviors, nextVI)
        }

        // Parse frequency - handle "(atual)" suffix
        const cleanMsg = userMessage.replace(/\s*\(atual\)\s*/i, '')
        const freq = parseInt(cleanMsg.charAt(0))
        const isFrequencyResponse = !isNaN(freq) && freq >= 0 && freq <= 4

        if (isFrequencyResponse) {
          const frequency = Math.min(Math.max(freq, 0), 4)

          // Get existing example for edit mode
          const existingExample = isEditing
            ? accumulatedData.behaviors.find(b => {
                const info = behaviors.find(bi => bi.id === b.behaviorId)
                return info?.valueName === currentValue
              })?.example
            : null

          return {
            reply: `Entendido! Agora, considerando os comportamentos esperados para **${currentValue}**:\n\n${behaviorsListText}\n\n${existingExample && isEditing ? `**Exemplo anterior:** ${existingExample}\n\n` : ''}Cite exemplos de situacoes onde ${pronoun === 'voce' ? 'voce demonstrou' : `${pronoun} demonstrou`} (ou nao) esses comportamentos.`,
            phaseState: { ...phaseState, waitingForFollowUp: true, currentBehaviorIndex: frequency },
            accumulatedData,
            isComplete: false,
            quickActions: existingExample && isEditing ? ['Manter exemplo atual'] : undefined,
          }
        }
      }

      // No valid frequency yet → present value and ask frequency
      const currentLabel = existingFreq !== null && isEditing
        ? `\n\n**Nota atual: ${existingFreq}/4** - Voce pode manter ou alterar.`
        : ''

      return {
        reply: `${isEditing ? 'Revisando' : 'Vamos avaliar'} o valor **${currentValue}**${valueDescription ? ` - ${valueDescription}` : ''}.${currentLabel}\n\nComo ${askFrequency} neste valor?`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: buildFreqActions(currentValue),
      }
    }

    case 'culture_checkpoint': {
      if (userMessage) {
        const msgLower = userMessage.toLowerCase()
        if (msgLower.includes('sim') || msgLower.includes('continuar')) {
          return {
            reply: `Otimo! Vamos para a avaliacao de **Resultados e Entregas**.\n\nConte-me sobre as principais entregas e metas de ${pronoun} neste periodo. Quais projetos foram concluidos? As metas foram atingidas?`,
            phaseState: { ...phaseState, phase: 'results' },
            accumulatedData,
            isComplete: false,
          }
        }
        // User chose to save and come back later
        return {
          reply: 'Progresso salvo com sucesso! Voce pode voltar a qualquer momento para continuar a avaliacao de onde parou.',
          phaseState: { ...phaseState, phase: 'culture_checkpoint' },
          accumulatedData,
          isComplete: false,
          quickActions: ['__SAVE_DRAFT__'],
        }
      }
      return {
        reply: `Deseja continuar para a avaliacao de **Resultados e Entregas** agora?`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: ['Sim, continuar', 'Nao, salvar e voltar depois'],
      }
    }

    case 'results': {
      const isEditingResults = phaseState.isEditing || false

      if (isSelf) {
        // Self-evaluation: project-based flow
        // waitingForFollowUp=false → ask about projects (user adds via UI panel)
        // waitingForFollowUp=true → projects added, confirm and move on
        if (userMessage) {
          const msgLower = userMessage.toLowerCase()
          if (msgLower.includes('projetos adicionados') || msgLower.includes('continuar sem projetos') || msgLower.includes('pronto')) {
            // Move to next phase (self skips strengths/improvements/tags)
            return {
              reply: generateReviewMessage(accumulatedData, accumulatedData, behaviors, evaluationType),
              phaseState: { ...phaseState, phase: 'review', isEditing: false },
              accumulatedData,
              isComplete: false,
              quickActions: ['Confirmar e finalizar', 'Quero ajustar algo'],
            }
          }
          // User typed a project description as text
          return {
            reply: 'Use o painel **"Meus Projetos"** abaixo para adicionar seus projetos com nome, descricao, percentual de entrega e evidencias. Quando terminar, clique em **"Projetos adicionados"**.',
            phaseState,
            accumulatedData: { ...accumulatedData, results: { ...accumulatedData.results || { classification: 'entrega', score: 2.5 }, evidenceText: userMessage } },
            isComplete: false,
            quickActions: ['Projetos adicionados', 'Continuar sem projetos'],
          }
        }

        return {
          reply: `Agora vamos para a avaliacao de **Resultados e Entregas**.\n\n**Quais os projetos relevantes que gostaria de destacar?**\n\nUse o painel **"Meus Projetos"** abaixo para adicionar cada projeto com:\n- Nome do projeto\n- Descricao das entregas\n- Percentual de entrega (%)\n- Upload de evidencias (opcional)\n\nQuando terminar de adicionar seus projetos, clique em **"Projetos adicionados"**.`,
          phaseState,
          accumulatedData: accumulatedData.results ? accumulatedData : { ...accumulatedData, results: { evidenceText: '', classification: 'entrega', score: 2.5 } },
          isComplete: false,
          quickActions: ['Projetos adicionados', 'Continuar sem projetos'],
        }
      }

      // Manager/stakeholder: existing flow with classification
      if (userMessage) {
        if (isEditingResults && userMessage.toLowerCase().includes('manter resposta')) {
          const classLabels = ['Nao entrega resultados', 'Entrega resultados', 'Acima da expectativa']
          const currentClassLabel = accumulatedData.results?.classification === 'nao_entrega' ? 'Nao entrega resultados'
            : accumulatedData.results?.classification === 'acima_expectativa' ? 'Acima da expectativa' : 'Entrega resultados'
          const actions = classLabels.map(l => l === currentClassLabel ? `${l} (atual)` : l)

          return {
            reply: `Como voce classificaria as entregas no geral?\n\n**Classificacao atual:** ${currentClassLabel}`,
            phaseState,
            accumulatedData,
            isComplete: false,
            quickActions: actions,
          }
        }

        return {
          reply: 'Como voce classificaria as entregas no geral?\n\nConsidere os projetos cadastrados pelo colaborador e o painel de metas (se disponivel).',
          phaseState,
          accumulatedData: { ...accumulatedData, results: { evidenceText: userMessage, classification: 'entrega', score: 2.5 } },
          isComplete: false,
          quickActions: ['Nao entrega resultados', 'Entrega resultados', 'Acima da expectativa'],
        }
      }

      const existingResults = accumulatedData.results?.evidenceText
      return {
        reply: `${isEditingResults ? 'Revisando' : 'Conte-me sobre'} as principais entregas e metas de ${pronoun} neste periodo.${existingResults && isEditingResults ? `\n\n**Resposta anterior:** ${existingResults}` : ' Quais projetos foram concluidos? As metas foram atingidas?'}\n\nVoce pode consultar os **projetos cadastrados** e o **painel de metas** no painel lateral para embasar sua avaliacao.`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: existingResults && isEditingResults ? ['Manter resposta atual'] : undefined,
      }
    }

    case 'strengths': {
      const isEditingStr = phaseState.isEditing || false

      if (userMessage) {
        // "Manter" in edit mode
        if (isEditingStr && userMessage.toLowerCase().includes('manter') && accumulatedData.strengths) {
          return {
            reply: `Mantido! Agora vamos ${isEditingStr ? 'revisar' : 'falar sobre'} as **Oportunidades de Melhoria**.${accumulatedData.improvements && isEditingStr ? `\n\n**Resposta anterior:** ${accumulatedData.improvements}` : `\n\nQuais areas ${pronoun} poderia desenvolver?`}`,
            phaseState: { ...phaseState, phase: 'improvements' },
            accumulatedData,
            isComplete: false,
            quickActions: accumulatedData.improvements && isEditingStr ? ['Manter resposta atual'] : undefined,
          }
        }

        return {
          reply: `Obrigado! Agora vamos ${isEditingStr ? 'revisar' : 'falar sobre'} as **Oportunidades de Melhoria**.${accumulatedData.improvements && isEditingStr ? `\n\n**Resposta anterior:** ${accumulatedData.improvements}` : `\n\nQuais areas ${pronoun} poderia desenvolver? Que oportunidades de melhoria voce identifica?`}`,
          phaseState: { ...phaseState, phase: 'improvements' },
          accumulatedData: { ...accumulatedData, strengths: userMessage },
          isComplete: false,
          quickActions: accumulatedData.improvements && isEditingStr ? ['Manter resposta atual'] : undefined,
        }
      }

      return {
        reply: `${isEditingStr ? 'Revisando os' : 'Agora vamos falar sobre'} **Pontos Fortes**.${accumulatedData.strengths && isEditingStr ? `\n\n**Resposta anterior:** ${accumulatedData.strengths}` : ''}\n\nQuais sao os principais pontos fortes e forcas de ${pronoun}? O que ${pronoun} faz de melhor?`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: accumulatedData.strengths && isEditingStr ? ['Manter resposta atual'] : undefined,
      }
    }

    case 'improvements': {
      const isEditingImp = phaseState.isEditing || false

      if (userMessage) {
        // "Manter" in edit mode
        const updatedData = (isEditingImp && userMessage.toLowerCase().includes('manter') && accumulatedData.improvements)
          ? accumulatedData
          : { ...accumulatedData, improvements: userMessage }

        // Manager goes to tags, others go to review
        if (evaluationType === 'manager') {
          const existingTags = updatedData.tags || []
          const tagActions = isEditingImp && existingTags.length > 0
            ? [...existingTags.map(t => `${TALENT_TAGS[t]?.label || t} (atual)`), ...Object.entries(TALENT_TAGS).filter(([k]) => !existingTags.includes(k)).map(([, v]) => v.label), 'Manter tags atuais', 'Pronto']
            : ['Risco de Turn Over', 'Potencial Sucessao', 'Key Talent', 'High Potential', 'Nenhuma tag', 'Pronto']

          return {
            reply: `Obrigado! Agora, selecione as tags que melhor descrevem **${subjectName}**.${isEditingImp && existingTags.length > 0 ? `\n\n**Tags atuais:** ${existingTags.map(t => TALENT_TAGS[t]?.label || t).join(', ')}` : ''} Voce pode selecionar mais de uma:`,
            phaseState: { ...phaseState, phase: 'tags' },
            accumulatedData: updatedData,
            isComplete: false,
            quickActions: tagActions,
          }
        }
        return {
          reply: generateReviewMessage(accumulatedData, updatedData, behaviors, evaluationType),
          phaseState: { ...phaseState, phase: 'review', isEditing: false },
          accumulatedData: updatedData,
          isComplete: false,
          quickActions: ['Confirmar e finalizar', 'Quero ajustar algo'],
        }
      }

      return {
        reply: `${isEditingImp ? 'Revisando as' : 'Quais'} **Oportunidades de Melhoria**.${accumulatedData.improvements && isEditingImp ? `\n\n**Resposta anterior:** ${accumulatedData.improvements}` : ''}\n\nQuais areas ${pronoun} poderia desenvolver? Que oportunidades de melhoria voce identifica?`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: accumulatedData.improvements && isEditingImp ? ['Manter resposta atual'] : undefined,
      }
    }

    case 'tags': {
      const tagMap: Record<string, string> = {
        'risco de turn over': 'risco_turnover',
        'potencial sucessao': 'potencial_sucessao',
        'key talent': 'key_talent',
        'high potential': 'high_potential',
      }

      if (userMessage) {
        const msgLower = userMessage.toLowerCase()

        // "Manter tags atuais" in edit mode
        if (msgLower.includes('manter tags')) {
          return {
            reply: generateReviewMessage(accumulatedData, accumulatedData, behaviors, evaluationType),
            phaseState: { ...phaseState, phase: 'review', isEditing: false },
            accumulatedData,
            isComplete: false,
            quickActions: ['Confirmar e finalizar', 'Quero ajustar algo'],
          }
        }

        // "Pronto" or "Nenhuma" → move to review
        if (msgLower.includes('pronto') || msgLower.includes('nenhuma')) {
          // If "nenhuma" clear tags
          const finalData = msgLower.includes('nenhuma') ? { ...accumulatedData, tags: [] } : accumulatedData
          return {
            reply: generateReviewMessage(finalData, finalData, behaviors, evaluationType),
            phaseState: { ...phaseState, phase: 'review', isEditing: false },
            accumulatedData: finalData,
            isComplete: false,
            quickActions: ['Confirmar e finalizar', 'Quero ajustar algo'],
          }
        }

        // Match tag from message (strip "(atual)" suffix)
        const cleanMsg = msgLower.replace(/\s*\(atual\)\s*/i, '')
        const currentTags = accumulatedData.tags || []
        let matchedTag = ''
        for (const [key, value] of Object.entries(tagMap)) {
          if (cleanMsg.includes(key)) {
            matchedTag = value
            break
          }
        }

        if (matchedTag) {
          // Toggle: if already selected, remove it; otherwise add it
          const newTags = currentTags.includes(matchedTag)
            ? currentTags.filter(t => t !== matchedTag)
            : [...currentTags, matchedTag]
          const tagLabel = TALENT_TAGS[matchedTag]?.label || matchedTag
          const action = currentTags.includes(matchedTag) ? 'removida' : 'adicionada'
          const selectedLabels = newTags.length > 0 ? newTags.map(t => TALENT_TAGS[t]?.label || t).join(', ') : 'Nenhuma'

          return {
            reply: `Tag **${tagLabel}** ${action}! Selecionadas: ${selectedLabels}.\n\nDeseja adicionar/remover mais alguma tag ou esta pronto?`,
            phaseState,
            accumulatedData: { ...accumulatedData, tags: newTags },
            isComplete: false,
            quickActions: [
              ...Object.entries(TALENT_TAGS)
                .filter(([k]) => !newTags.includes(k))
                .map(([, v]) => v.label),
              'Pronto',
            ],
          }
        }
      }

      return {
        reply: `Selecione as tags que melhor descrevem **${subjectName}**:`,
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: ['Risco de Turn Over', 'Potencial Sucessao', 'Key Talent', 'High Potential', 'Nenhuma tag', 'Pronto'],
      }
    }

    case 'review':
      if (userMessage.toLowerCase().includes('confirmar') || userMessage.toLowerCase().includes('finalizar') || userMessage.toLowerCase().includes('sim')) {
        return {
          reply: 'Avaliacao concluida com sucesso! Os dados foram salvos. Obrigado pela sua participacao!',
          phaseState: { ...phaseState, phase: 'complete' },
          accumulatedData,
          isComplete: true,
        }
      }
      if (userMessage.toLowerCase().includes('ajustar') || userMessage.toLowerCase().includes('alterar') || userMessage.toLowerCase().includes('nao')) {
        // Restart from culture phase in editing mode
        const uniqueValues = getUniqueValues(behaviors)
        const firstValue = uniqueValues[0] || ''
        const firstValueDesc = behaviors.find(b => b.valueName === firstValue)?.valueDescription || ''
        const existingFreq = accumulatedData.behaviors.find(b => {
          const info = behaviors.find(bi => bi.id === b.behaviorId)
          return info?.valueName === firstValue
        })?.frequency

        const labels = ['0 - Nunca', '1 - Raramente', '2 - As vezes', '3 - Sempre', '4 - Referencia']
        const freqActions = existingFreq !== undefined
          ? labels.map((l, i) => i === existingFreq ? `${l} (atual)` : l)
          : labels

        return {
          reply: `Sem problemas! Vamos revisar toda a avaliacao. Os valores atuais estarao sinalizados para facilitar.\n\nRevisando o valor **${firstValue}**${firstValueDesc ? ` - ${firstValueDesc}` : ''}.\n\n**Nota atual: ${existingFreq !== undefined ? existingFreq : '-'}/4** - Voce pode manter ou alterar.\n\nComo voce avalia ${pronoun} neste valor?`,
          phaseState: { phase: 'culture', currentValueIndex: 0, currentBehaviorIndex: 0, waitingForFollowUp: false, isEditing: true },
          accumulatedData,
          isComplete: false,
          quickActions: freqActions,
        }
      }
      return {
        reply: 'Deseja confirmar a avaliacao ou fazer ajustes?',
        phaseState,
        accumulatedData,
        isComplete: false,
        quickActions: ['Confirmar e finalizar', 'Quero ajustar algo'],
      }

    default:
      return {
        reply: 'Avaliacao concluida!',
        phaseState,
        accumulatedData,
        isComplete: true,
      }
  }
}

function generateReviewMessage(oldData: AccumulatedData, newData: AccumulatedData, behaviors: BehaviorInfo[], evaluationType?: string): string {
  const data = { ...oldData, ...newData }
  const labels = ['Nunca', 'Raramente', 'As vezes', 'Sempre', 'Referencia']
  let msg = 'Aqui esta o resumo da avaliacao:\n\n**Cultura:**\n'
  for (const b of data.behaviors) {
    const info = behaviors.find(bi => bi.id === b.behaviorId)
    msg += `- ${info?.valueName} / ${info?.description}: ${labels[b.frequency]} (${b.frequency}/4)\n`
  }
  msg += `\n**Resultados:** ${data.results?.classification === 'acima_expectativa' ? 'Acima da expectativa' : data.results?.classification === 'entrega' ? 'Entrega resultados' : 'Nao entrega'} (${data.results?.score}/4)`
  if (data.strengths) msg += `\n\n**Pontos Fortes:** ${data.strengths}`
  if (data.improvements) msg += `\n\n**Melhorias:** ${data.improvements}`
  if (evaluationType === 'manager' && data.tags && data.tags.length > 0) {
    msg += `\n\n**Tags:** ${data.tags.map(t => TALENT_TAGS[t]?.label || t).join(', ')}`
  }
  msg += '\n\nConfirma esses dados ou deseja ajustar algo?'
  return msg
}

// ==================== FALLBACK RESULT HANDLER ====================

export function handleResultsQuickAction(action: string, accumulatedData: AccumulatedData): AccumulatedData {
  let classification: 'nao_entrega' | 'entrega' | 'acima_expectativa' = 'entrega'
  if (action.toLowerCase().includes('nao entrega')) classification = 'nao_entrega'
  else if (action.toLowerCase().includes('acima')) classification = 'acima_expectativa'

  return {
    ...accumulatedData,
    results: {
      evidenceText: accumulatedData.results?.evidenceText || '',
      classification,
      score: classificationToScore(classification),
    },
  }
}

// ==================== BUILD FINAL PAYLOAD ====================

export function buildFinalPayload(evaluationId: string, accumulatedData: AccumulatedData, status: 'in_progress' | 'completed' = 'completed') {
  return {
    id: evaluationId,
    cultureEvaluations: accumulatedData.behaviors.map(b => ({
      behaviorId: b.behaviorId,
      example: b.example,
      frequency: b.frequency,
      aiSuggestion: b.frequency,
    })),
    resultsEvaluation: accumulatedData.results ? {
      evidenceText: accumulatedData.results.evidenceText,
      evidenceFile: '',
      classification: accumulatedData.results.classification,
      score: accumulatedData.results.score,
    } : undefined,
    projects: accumulatedData.results?.projects || [],
    strengths: accumulatedData.strengths || '',
    improvements: accumulatedData.improvements || '',
    tags: accumulatedData.tags && accumulatedData.tags.length > 0 ? JSON.stringify(accumulatedData.tags) : null,
    status,
  }
}

// Calculate results score from projects and goals
export function calculateResultsScore(projectAvgPct: number, goalsAvgPct: number): { score: number; classification: 'nao_entrega' | 'entrega' | 'acima_expectativa' } {
  // Average of project delivery % and goals achievement %
  const sources: number[] = []
  if (projectAvgPct > 0) sources.push(projectAvgPct)
  if (goalsAvgPct > 0) sources.push(goalsAvgPct)
  const avgPct = sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0

  // Map percentage to score and classification
  if (avgPct < 60) return { score: 1, classification: 'nao_entrega' }
  if (avgPct < 80) return { score: 2, classification: 'nao_entrega' }
  if (avgPct <= 100) return { score: 3, classification: 'entrega' }
  return { score: 4, classification: 'acima_expectativa' }
}
