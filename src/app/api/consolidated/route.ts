import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNinebox } from '@/lib/ninebox'
import { generateFeedbackAndPDI } from '@/lib/ai'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycleId')
  const subjectId = searchParams.get('subjectId')

  if (subjectId && cycleId) {
    const result = await prisma.consolidatedResult.findUnique({
      where: { cycleId_subjectId: { cycleId, subjectId } },
    })
    return NextResponse.json(result)
  }

  if (cycleId) {
    const results = await prisma.consolidatedResult.findMany({
      where: { cycleId },
    })
    return NextResponse.json(results)
  }

  return NextResponse.json({ error: 'cycleId required' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cycleId, subjectId } = body

  // Get all evaluations for this subject in this cycle
  const evaluations = await prisma.evaluation.findMany({
    where: { cycleId, subjectId, status: 'completed' },
    include: {
      subject: true,
      cultureEvaluations: { include: { behavior: { include: { value: true } } } },
      resultsEvaluation: true,
    },
  })

  if (evaluations.length === 0) {
    return NextResponse.json({ error: 'Nenhuma avaliação concluída encontrada' }, { status: 400 })
  }

  // Calculate weighted average (manager weight 2, stakeholders weight 1, self weight 1)
  let totalCultureWeight = 0
  let totalResultsWeight = 0
  let weightedCulture = 0
  let weightedResults = 0

  const strengths: string[] = []
  const improvements: string[] = []

  for (const ev of evaluations) {
    const weight = ev.type === 'manager' ? 2 : 1
    if (ev.cultureScore !== null) {
      weightedCulture += (ev.cultureScore ?? 0) * weight
      totalCultureWeight += weight
    }
    if (ev.resultsScore !== null) {
      weightedResults += (ev.resultsScore ?? 0) * weight
      totalResultsWeight += weight
    }
    if (ev.strengths) strengths.push(ev.strengths)
    if (ev.improvements) improvements.push(ev.improvements)
  }

  const cultureScore = totalCultureWeight > 0 ? weightedCulture / totalCultureWeight : 0
  const resultsScore = totalResultsWeight > 0 ? weightedResults / totalResultsWeight : 0

  const ninebox = calculateNinebox(cultureScore, resultsScore)

  // Get employee behavioral profile
  const employee = await prisma.employee.findUnique({ where: { id: subjectId } })

  // Generate AI feedback and PDI
  const selfEval = evaluations.find(e => e.type === 'self')
  const managerEval = evaluations.find(e => e.type === 'manager')
  const stakeholderEvals = evaluations.filter(e => e.type === 'stakeholder')

  let aiFeedback = ''
  let aiPDI = ''
  let aiAnalysis = ''

  try {
    const aiResult = await generateFeedbackAndPDI({
      employeeName: employee?.name || 'Colaborador',
      selfEvaluation: selfEval ? `Cultura: ${selfEval.cultureScore}/4, Resultados: ${selfEval.resultsScore}/4. Fortalezas: ${selfEval.strengths || 'N/A'}. Melhorias: ${selfEval.improvements || 'N/A'}` : 'Não realizada',
      managerEvaluation: managerEval ? `Cultura: ${managerEval.cultureScore}/4, Resultados: ${managerEval.resultsScore}/4. Fortalezas: ${managerEval.strengths || 'N/A'}. Melhorias: ${managerEval.improvements || 'N/A'}` : 'Não realizada',
      stakeholderEvaluations: stakeholderEvals.map(se => `Cultura: ${se.cultureScore}/4, Resultados: ${se.resultsScore}/4. Fortalezas: ${se.strengths || 'N/A'}. Melhorias: ${se.improvements || 'N/A'}`),
      strengths,
      improvements,
      cultureScore,
      resultsScore,
      nineboxPosition: ninebox.label,
      behavioralProfile: employee?.behavioralProfileText || undefined,
    })
    aiFeedback = aiResult.feedback
    aiPDI = aiResult.pdi
    aiAnalysis = `Nota Cultura: ${cultureScore.toFixed(2)}/4 | Nota Resultados: ${resultsScore.toFixed(2)}/4 | Ninebox: ${ninebox.label}`
  } catch (error) {
    console.error('AI generation error:', error)
    aiAnalysis = `Nota Cultura: ${cultureScore.toFixed(2)}/4 | Nota Resultados: ${resultsScore.toFixed(2)}/4 | Ninebox: ${ninebox.label}`
  }

  const result = await prisma.consolidatedResult.upsert({
    where: { cycleId_subjectId: { cycleId, subjectId } },
    create: {
      cycleId,
      subjectId,
      cultureScore,
      resultsScore,
      nineboxPosition: ninebox.position,
      aiAnalysis,
      aiFeedback,
      aiPDI,
    },
    update: {
      cultureScore,
      resultsScore,
      nineboxPosition: ninebox.position,
      aiAnalysis,
      aiFeedback,
      aiPDI,
    },
  })

  return NextResponse.json(result, { status: 201 })
}
