import { NextRequest, NextResponse } from 'next/server'
import {
  ChatRequest,
  ChatResponse,
  buildSystemPrompt,
  extractDataBlock,
  generateFallbackResponse,
  handleResultsQuickAction,
  classificationToScore,
  getUniqueValues,
} from '@/lib/chat-evaluation'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

async function callAI(messages: Array<{ role: string; content: string }>, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API Error: ${await response.text()}`)
  }

  const data = await response.json()
  return data.content[0].text
}

export async function POST(request: NextRequest) {
  const body: ChatRequest = await request.json()
  const { message, phaseState, accumulatedData, behaviors, evaluationType, subjectName, messages } = body

  // Fallback mode without API key
  if (!ANTHROPIC_API_KEY) {
    // Handle quick actions for results classification (strip "(atual)" suffix)
    const cleanMessage = message.replace(/\s*\(atual\)\s*/i, '')
    if (phaseState.phase === 'results' && accumulatedData.results?.evidenceText &&
      (cleanMessage.includes('Nao entrega') || cleanMessage.includes('Entrega resultados') || cleanMessage.includes('Acima da expectativa'))) {
      const updatedData = handleResultsQuickAction(cleanMessage, accumulatedData)
      const nextPhase = evaluationType !== 'self'
        ? 'strengths'
        : 'review'

      const fallback = generateFallbackResponse(
        { ...phaseState, phase: nextPhase },
        behaviors,
        evaluationType,
        subjectName,
        updatedData,
        ''
      )
      return NextResponse.json(fallback)
    }

    const fallbackResponse = generateFallbackResponse(
      phaseState,
      behaviors,
      evaluationType,
      subjectName,
      accumulatedData,
      message
    )
    return NextResponse.json(fallbackResponse)
  }

  // AI-powered mode
  try {
    const systemPrompt = buildSystemPrompt(phaseState, behaviors, evaluationType, subjectName, accumulatedData)

    const aiMessages = [...messages]
    if (message) {
      aiMessages.push({ role: 'user', content: message })
    }

    // If no messages yet, add a trigger
    if (aiMessages.length === 0) {
      aiMessages.push({ role: 'user', content: 'Olá, estou pronto para iniciar a avaliação.' })
    }

    const aiResponse = await callAI(aiMessages, systemPrompt)
    const { cleanMessage, data } = extractDataBlock(aiResponse)

    let newPhaseState = { ...phaseState }
    let newAccumulatedData = { ...accumulatedData }
    let isComplete = false
    let quickActions: string[] | undefined

    // Process extracted data based on current phase
    if (data) {
      switch (phaseState.phase) {
        case 'intro':
          newPhaseState = { ...newPhaseState, phase: 'culture' }
          break

        case 'culture':
          if (data.moveToNext && data.valueBehaviors) {
            // Save all behaviors for this value
            const vbList = data.valueBehaviors as Array<{ behaviorId: string; example: string; frequency: number }>
            newAccumulatedData = {
              ...newAccumulatedData,
              behaviors: [
                ...newAccumulatedData.behaviors,
                ...vbList.map(vb => ({
                  behaviorId: vb.behaviorId,
                  example: vb.example || '',
                  frequency: Math.min(Math.max(vb.frequency || 2, 0), 4),
                })),
              ],
            }

            // Move to next value
            const uniqueValues = getUniqueValues(behaviors)
            const nextVI = phaseState.currentValueIndex + 1

            if (nextVI >= uniqueValues.length) {
              newPhaseState = { ...newPhaseState, phase: 'culture_checkpoint', currentValueIndex: 0, currentBehaviorIndex: 0, waitingForFollowUp: false }
              quickActions = ['Sim, continuar', 'Nao, salvar e voltar depois']
            } else {
              newPhaseState = { ...newPhaseState, currentValueIndex: nextVI, currentBehaviorIndex: 0, waitingForFollowUp: false }
            }
          } else if (data.moveToNext && data.behaviorId) {
            // Legacy single behavior format
            newAccumulatedData = {
              ...newAccumulatedData,
              behaviors: [
                ...newAccumulatedData.behaviors,
                {
                  behaviorId: data.behaviorId as string,
                  example: (data.example as string) || '',
                  frequency: Math.min(Math.max(data.frequency as number || 2, 0), 4),
                },
              ],
            }
            const uniqueValues = getUniqueValues(behaviors)
            const nextVI = phaseState.currentValueIndex + 1
            if (nextVI >= uniqueValues.length) {
              newPhaseState = { ...newPhaseState, phase: 'culture_checkpoint', currentValueIndex: 0, currentBehaviorIndex: 0, waitingForFollowUp: false }
              quickActions = ['Sim, continuar', 'Nao, salvar e voltar depois']
            } else {
              newPhaseState = { ...newPhaseState, currentValueIndex: nextVI, currentBehaviorIndex: 0, waitingForFollowUp: false }
            }
          } else {
            newPhaseState = { ...newPhaseState, waitingForFollowUp: !phaseState.waitingForFollowUp ? true : phaseState.waitingForFollowUp }
          }
          break

        case 'culture_checkpoint':
          if (data.action === 'checkpoint') {
            // Will be handled by quick actions
            quickActions = ['Sim, continuar', 'Nao, salvar e voltar depois']
          }
          break

        case 'results':
          if (data.ready && data.classification) {
            const classification = data.classification as string
            newAccumulatedData = {
              ...newAccumulatedData,
              results: {
                evidenceText: (data.evidenceText as string) || '',
                classification: classification as 'nao_entrega' | 'entrega' | 'acima_expectativa',
                score: classificationToScore(classification),
              },
            }
            newPhaseState = {
              ...newPhaseState,
              phase: evaluationType !== 'self' ? 'strengths' : 'review',
            }
          }
          break

        case 'strengths':
          if (data.value) {
            newAccumulatedData = { ...newAccumulatedData, strengths: data.value as string }
            newPhaseState = { ...newPhaseState, phase: 'improvements' }
          }
          break

        case 'improvements':
          if (data.value) {
            newAccumulatedData = { ...newAccumulatedData, improvements: data.value as string }
            newPhaseState = { ...newPhaseState, phase: evaluationType === 'manager' ? 'tags' : 'review' }
          }
          break

        case 'tags':
          if (data.tags) {
            newAccumulatedData = { ...newAccumulatedData, tags: data.tags as string[] }
            newPhaseState = { ...newPhaseState, phase: 'review' }
          }
          break

        case 'review':
          if (data.action === 'confirmed') {
            isComplete = true
            newPhaseState = { ...newPhaseState, phase: 'complete' }
          }
          break
      }
    }

    // Add quick actions for review phase
    if (newPhaseState.phase === 'review') {
      quickActions = ['Confirmar e finalizar', 'Quero ajustar algo']
    }

    const response: ChatResponse = {
      reply: cleanMessage,
      phaseState: newPhaseState,
      accumulatedData: newAccumulatedData,
      isComplete,
      quickActions,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat AI Error:', error)
    // Fallback to scripted mode on error
    const fallbackResponse = generateFallbackResponse(
      phaseState,
      behaviors,
      evaluationType,
      subjectName,
      accumulatedData,
      message
    )
    return NextResponse.json(fallbackResponse)
  }
}
