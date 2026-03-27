import { NextRequest, NextResponse } from 'next/server'
import { suggestCultureScore, generateFeedbackAndPDI, generateConsolidatedAnalysis } from '@/lib/ai'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body

  try {
    switch (action) {
      case 'suggest_score': {
        const result = await suggestCultureScore(
          body.valueName,
          body.behaviorDescription,
          body.example,
          body.frequency
        )
        return NextResponse.json(result)
      }

      case 'generate_feedback_pdi': {
        const result = await generateFeedbackAndPDI(body.params)
        return NextResponse.json(result)
      }

      case 'consolidated_analysis': {
        const result = await generateConsolidatedAnalysis(body.params)
        return NextResponse.json({ analysis: result })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('AI Error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar com IA. Verifique se a ANTHROPIC_API_KEY está configurada.' },
      { status: 500 }
    )
  }
}
