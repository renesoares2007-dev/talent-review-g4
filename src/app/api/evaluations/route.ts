import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNinebox } from '@/lib/ninebox'
import { generateFeedbackAndPDI } from '@/lib/ai'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycleId')
  const subjectId = searchParams.get('subjectId')
  const evaluatorId = searchParams.get('evaluatorId')
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  if (id) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        subject: true,
        evaluator: true,
        cycle: true,
        cultureEvaluations: { include: { behavior: { include: { value: true } } } },
        resultsEvaluation: true,
        projects: true,
      },
    })
    return NextResponse.json(evaluation)
  }

  const where: Record<string, string> = {}
  if (cycleId) where.cycleId = cycleId
  if (subjectId) where.subjectId = subjectId
  if (evaluatorId) where.evaluatorId = evaluatorId
  if (type) where.type = type

  const evaluations = await prisma.evaluation.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, department: true, role: true } },
      evaluator: { select: { id: true, name: true } },
      cycle: { select: { id: true, name: true } },
      cultureEvaluations: { include: { behavior: { include: { value: true } } } },
      resultsEvaluation: true,
      projects: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(evaluations)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cycleId, subjectId, evaluatorId, type } = body

  const evaluation = await prisma.evaluation.create({
    data: {
      cycleId,
      subjectId,
      evaluatorId,
      type,
      status: 'pending',
    },
  })

  return NextResponse.json(evaluation, { status: 201 })
}

// Admin: reset evaluation to a specific stage
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, resetTo } = body

    if (!id || !resetTo) {
      return NextResponse.json({ error: 'id and resetTo required' }, { status: 400 })
    }

    // Helper: safely delete resultsEvaluation (unique relation, may not exist)
    const deleteResults = async () => {
      const existing = await prisma.resultsEvaluation.findUnique({ where: { evaluationId: id } })
      if (existing) {
        await prisma.resultsEvaluation.delete({ where: { evaluationId: id } })
      }
    }

    // resetTo options: 'pending' | 'culture' | 'results' | 'strengths_improvements' | 'tags'
    const updateData: Record<string, unknown> = { status: 'in_progress' }

    if (resetTo === 'pending') {
      await prisma.cultureEvaluation.deleteMany({ where: { evaluationId: id } })
      await deleteResults()
      updateData.status = 'pending'
      updateData.cultureScore = null
      updateData.resultsScore = null
      updateData.strengths = null
      updateData.improvements = null
      updateData.tags = null
    } else if (resetTo === 'culture') {
      await prisma.cultureEvaluation.deleteMany({ where: { evaluationId: id } })
      await deleteResults()
      updateData.cultureScore = null
      updateData.resultsScore = null
      updateData.strengths = null
      updateData.improvements = null
      updateData.tags = null
    } else if (resetTo === 'results') {
      await deleteResults()
      updateData.resultsScore = null
      updateData.strengths = null
      updateData.improvements = null
      updateData.tags = null
    } else if (resetTo === 'strengths_improvements') {
      updateData.strengths = null
      updateData.improvements = null
      updateData.tags = null
    } else if (resetTo === 'tags') {
      updateData.tags = null
    }

    const evaluation = await prisma.evaluation.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(evaluation)
  } catch (err) {
    console.error('PATCH evaluation error:', err)
    return NextResponse.json({ error: 'Erro ao resetar avaliacao' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, cultureEvaluations, resultsEvaluation, projects, strengths, improvements, status } = body

  // Update culture evaluations
  if (cultureEvaluations && cultureEvaluations.length > 0) {
    // Delete existing
    await prisma.cultureEvaluation.deleteMany({ where: { evaluationId: id } })
    // Create new
    await prisma.cultureEvaluation.createMany({
      data: cultureEvaluations.map((ce: { behaviorId: string; example: string; frequency: number; aiSuggestion?: number }) => ({
        evaluationId: id,
        behaviorId: ce.behaviorId,
        example: ce.example,
        frequency: ce.frequency,
        aiSuggestion: ce.aiSuggestion,
      })),
    })
  }

  // Update results evaluation
  if (resultsEvaluation) {
    await prisma.resultsEvaluation.upsert({
      where: { evaluationId: id },
      create: {
        evaluationId: id,
        evidenceFile: resultsEvaluation.evidenceFile,
        evidenceText: resultsEvaluation.evidenceText,
        classification: resultsEvaluation.classification,
        score: resultsEvaluation.score,
      },
      update: {
        evidenceFile: resultsEvaluation.evidenceFile,
        evidenceText: resultsEvaluation.evidenceText,
        classification: resultsEvaluation.classification,
        score: resultsEvaluation.score,
      },
    })
  }

  // Save projects
  if (projects && projects.length > 0) {
    // Delete existing projects for this evaluation
    await prisma.project.deleteMany({ where: { evaluationId: id } })
    for (const p of projects) {
      await prisma.project.create({
        data: {
          evaluationId: id,
          name: p.name,
          description: p.description || '',
          deliveryPct: p.deliveryPct ?? 100,
          evidenceFile: p.evidenceFile || null,
        },
      })
    }
  }

  // Calculate scores
  let cultureScore: number | undefined
  if (cultureEvaluations && cultureEvaluations.length > 0) {
    const total = cultureEvaluations.reduce((sum: number, ce: { frequency: number }) => sum + ce.frequency, 0)
    cultureScore = total / cultureEvaluations.length
  }

  // Results score: if projects exist, calculate from project avg + goals avg
  let resultsScore = resultsEvaluation?.score
  if (projects && projects.length > 0) {
    const projectAvgPct = projects.reduce((sum: number, p: { deliveryPct: number }) => sum + (p.deliveryPct || 0), 0) / projects.length

    // Check for goals panel
    const evalRecord = await prisma.evaluation.findUnique({ where: { id }, select: { cycleId: true, subjectId: true } })
    let goalsAvgPct = 0
    if (evalRecord) {
      const goals = await prisma.goalsPanelItem.findMany({
        where: { cycleId: evalRecord.cycleId, subjectId: evalRecord.subjectId },
      })
      if (goals.length > 0) {
        goalsAvgPct = goals.reduce((sum, g) => sum + g.percentage, 0) / goals.length
      }
    }

    // Calculate combined score
    const sources: number[] = [projectAvgPct]
    if (goalsAvgPct > 0) sources.push(goalsAvgPct)
    const avgPct = sources.reduce((a, b) => a + b, 0) / sources.length

    // Map to score: <60% → 1, 60-80% → 2, 80-100% → 3, >100% → 4
    if (avgPct < 60) resultsScore = 1
    else if (avgPct < 80) resultsScore = 2
    else if (avgPct <= 100) resultsScore = 3
    else resultsScore = 4

    // Update classification in results evaluation
    const classification = avgPct < 60 ? 'nao_entrega' : avgPct <= 100 ? 'entrega' : 'acima_expectativa'
    await prisma.resultsEvaluation.updateMany({
      where: { evaluationId: id },
      data: { score: resultsScore, classification },
    })
  }

  // Update evaluation
  const evaluation = await prisma.evaluation.update({
    where: { id },
    data: {
      status: status || 'completed',
      strengths,
      improvements,
      ...(cultureScore !== undefined ? { cultureScore } : {}),
      ...(resultsScore !== undefined ? { resultsScore } : {}),
    },
    include: {
      cultureEvaluations: { include: { behavior: { include: { value: true } } } },
      resultsEvaluation: true,
    },
  })

  // Auto-generate PDI when both self + manager evaluations are completed
  if ((status || 'completed') === 'completed') {
    try {
      const completedEval = await prisma.evaluation.findUnique({
        where: { id },
        select: { cycleId: true, subjectId: true },
      })

      if (completedEval) {
        const { cycleId, subjectId } = completedEval

        // Check if both self and manager evaluations exist and are completed
        const allEvals = await prisma.evaluation.findMany({
          where: { cycleId, subjectId, status: 'completed' },
          include: {
            subject: true,
            cultureEvaluations: { include: { behavior: { include: { value: true } } } },
            resultsEvaluation: true,
          },
        })

        const selfEval = allEvals.find(e => e.type === 'self')
        const managerEval = allEvals.find(e => e.type === 'manager')

        if (selfEval && managerEval) {
          // Both completed — generate consolidated + PDI
          const stakeholderEvals = allEvals.filter(e => e.type === 'stakeholder')

          let totalCultureWeight = 0, totalResultsWeight = 0
          let weightedCulture = 0, weightedResults = 0
          const allStrengths: string[] = []
          const allImprovements: string[] = []

          for (const ev of allEvals) {
            const weight = ev.type === 'manager' ? 2 : 1
            if (ev.cultureScore !== null) {
              weightedCulture += (ev.cultureScore ?? 0) * weight
              totalCultureWeight += weight
            }
            if (ev.resultsScore !== null) {
              weightedResults += (ev.resultsScore ?? 0) * weight
              totalResultsWeight += weight
            }
            if (ev.strengths) allStrengths.push(ev.strengths)
            if (ev.improvements) allImprovements.push(ev.improvements)
          }

          const avgCulture = totalCultureWeight > 0 ? weightedCulture / totalCultureWeight : 0
          const avgResults = totalResultsWeight > 0 ? weightedResults / totalResultsWeight : 0
          const ninebox = calculateNinebox(avgCulture, avgResults)

          const employee = await prisma.employee.findUnique({ where: { id: subjectId } })

          let aiFeedback = ''
          let aiPDI = ''

          try {
            const aiResult = await generateFeedbackAndPDI({
              employeeName: employee?.name || 'Colaborador',
              selfEvaluation: `Cultura: ${selfEval.cultureScore?.toFixed(1)}/4, Resultados: ${selfEval.resultsScore?.toFixed(1)}/4. Fortalezas: ${selfEval.strengths || 'N/A'}. Melhorias: ${selfEval.improvements || 'N/A'}`,
              managerEvaluation: `Cultura: ${managerEval.cultureScore?.toFixed(1)}/4, Resultados: ${managerEval.resultsScore?.toFixed(1)}/4. Fortalezas: ${managerEval.strengths || 'N/A'}. Melhorias: ${managerEval.improvements || 'N/A'}`,
              stakeholderEvaluations: stakeholderEvals.map(se => `Cultura: ${se.cultureScore?.toFixed(1)}/4, Resultados: ${se.resultsScore?.toFixed(1)}/4. Fortalezas: ${se.strengths || 'N/A'}. Melhorias: ${se.improvements || 'N/A'}`),
              strengths: allStrengths,
              improvements: allImprovements,
              cultureScore: avgCulture,
              resultsScore: avgResults,
              nineboxPosition: ninebox.label,
              behavioralProfile: employee?.behavioralProfileText || undefined,
            })
            aiFeedback = aiResult.feedback
            aiPDI = aiResult.pdi

            // If AI returned placeholder messages, use fallback instead
            if (aiFeedback.startsWith('[IA não configurada') || aiPDI.includes('não pôde ser gerado')) {
              aiFeedback = generateFallbackFeedback(employee?.name || 'Colaborador', selfEval, managerEval, avgCulture, avgResults, ninebox.label)
              aiPDI = generateFallbackPDI(employee?.name || 'Colaborador', allStrengths, allImprovements, avgCulture, avgResults)
            }
          } catch {
            // AI error — generate structured fallback PDI
            aiFeedback = generateFallbackFeedback(employee?.name || 'Colaborador', selfEval, managerEval, avgCulture, avgResults, ninebox.label)
            aiPDI = generateFallbackPDI(employee?.name || 'Colaborador', allStrengths, allImprovements, avgCulture, avgResults)
          }

          const aiAnalysis = `Nota Cultura: ${avgCulture.toFixed(2)}/4 | Nota Resultados: ${avgResults.toFixed(2)}/4 | Ninebox: ${ninebox.label}`

          await prisma.consolidatedResult.upsert({
            where: { cycleId_subjectId: { cycleId, subjectId } },
            create: { cycleId, subjectId, cultureScore: avgCulture, resultsScore: avgResults, nineboxPosition: ninebox.position, aiAnalysis, aiFeedback, aiPDI },
            update: { cultureScore: avgCulture, resultsScore: avgResults, nineboxPosition: ninebox.position, aiAnalysis, aiFeedback, aiPDI },
          })
        }
      }
    } catch (err) {
      console.error('Auto-consolidation error:', err)
      // Don't fail the evaluation save if consolidation fails
    }
  }

  return NextResponse.json(evaluation)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFallbackFeedback(name: string, selfEval: any, managerEval: any, culture: number, results: number, ninebox: string): string {
  const lines: string[] = []
  lines.push(`**Feedback Consolidado - ${name}**\n`)
  lines.push(`**Posicao Ninebox:** ${ninebox}`)
  lines.push(`**Nota Cultura:** ${culture.toFixed(1)}/4 | **Nota Resultados:** ${results.toFixed(1)}/4\n`)

  if (selfEval?.cultureScore !== null && managerEval?.cultureScore !== null) {
    const diff = Math.abs((selfEval.cultureScore || 0) - (managerEval.cultureScore || 0))
    if (diff > 1) {
      lines.push(`**Divergencia significativa em Cultura:** Auto (${selfEval.cultureScore?.toFixed(1)}) vs Gestor (${managerEval.cultureScore?.toFixed(1)}). Recomenda-se alinhamento de expectativas.`)
    }
  }

  if (managerEval?.strengths) {
    lines.push(`\n**Pontos Fortes (visao do gestor):**\n${managerEval.strengths}`)
  }
  if (managerEval?.improvements) {
    lines.push(`\n**Oportunidades de Melhoria (visao do gestor):**\n${managerEval.improvements}`)
  }
  if (selfEval?.strengths && selfEval.strengths !== managerEval?.strengths) {
    lines.push(`\n**Pontos Fortes (autoavaliacao):**\n${selfEval.strengths}`)
  }

  return lines.join('\n')
}

function generateFallbackPDI(name: string, strengths: string[], improvements: string[], culture: number, results: number): string {
  const lines: string[] = []
  lines.push(`**Plano de Desenvolvimento Individual - ${name}**\n`)

  // Identify focus areas
  if (culture < 2.5) {
    lines.push(`**Area de foco: Cultura e Valores** (nota ${culture.toFixed(1)}/4)`)
    lines.push(`- Participar de workshops sobre valores e cultura organizacional`)
    lines.push(`- Buscar mentoria com colaboradores referencia em cultura`)
    lines.push(`- Prazo sugerido: 90 dias\n`)
  }

  if (results < 2.5) {
    lines.push(`**Area de foco: Resultados e Entregas** (nota ${results.toFixed(1)}/4)`)
    lines.push(`- Definir metas SMART com o gestor para o proximo ciclo`)
    lines.push(`- Implementar rotina de acompanhamento semanal de entregas`)
    lines.push(`- Prazo sugerido: 60 dias\n`)
  }

  if (improvements.length > 0) {
    lines.push(`**Acoes de Desenvolvimento baseadas nas avaliacoes:**`)
    for (const imp of improvements) {
      const items = imp.split(/[.;,\n]/).map(s => s.trim()).filter(s => s.length > 5)
      for (const item of items.slice(0, 3)) {
        lines.push(`- ${item}`)
      }
    }
    lines.push(`- Prazo: Revisao em 90 dias\n`)
  }

  if (strengths.length > 0) {
    lines.push(`**Fortalezas a potencializar:**`)
    for (const str of strengths) {
      const items = str.split(/[.;,\n]/).map(s => s.trim()).filter(s => s.length > 5)
      for (const item of items.slice(0, 3)) {
        lines.push(`- ${item}`)
      }
    }
    lines.push('')
  }

  lines.push(`**Acompanhamento:**`)
  lines.push(`- Reuniao de feedback com gestor: mensal`)
  lines.push(`- Revisao do PDI: a cada 90 dias`)
  lines.push(`- Proxima avaliacao formal: proximo ciclo`)

  return lines.join('\n')
}
