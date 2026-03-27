import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendSlackDM,
  sendSlackChannel,
  buildPendingNotificationBlocks,
  buildChannelSummaryBlocks,
} from '@/lib/slack'

// GET - return slack config
export async function GET() {
  const config = await prisma.slackConfig.findFirst()
  return NextResponse.json(config || { botToken: '', webhookUrl: '', channel: '', isActive: false })
}

// PUT - update slack config
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { botToken, webhookUrl, channel, isActive } = body

  const existing = await prisma.slackConfig.findFirst()
  if (existing) {
    const updated = await prisma.slackConfig.update({
      where: { id: existing.id },
      data: { botToken, webhookUrl, channel, isActive },
    })
    return NextResponse.json(updated)
  }

  const created = await prisma.slackConfig.create({
    data: { botToken, webhookUrl, channel, isActive },
  })
  return NextResponse.json(created)
}

// POST - send notifications for a cycle
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cycleId, mode } = body // mode: 'dm' | 'channel' | 'both'

  // Get slack config
  const config = await prisma.slackConfig.findFirst()
  if (!config || !config.isActive) {
    return NextResponse.json({ error: 'Slack nao configurado ou desativado' }, { status: 400 })
  }

  // Get cycle
  const cycle = await prisma.evaluationCycle.findUnique({ where: { id: cycleId } })
  if (!cycle) {
    return NextResponse.json({ error: 'Ciclo nao encontrado' }, { status: 404 })
  }

  // Get all pending evaluations for this cycle
  const pendingEvals = await prisma.evaluation.findMany({
    where: { cycleId, status: { in: ['pending', 'in_progress'] } },
    include: {
      evaluator: { select: { id: true, name: true, email: true } },
      subject: { select: { id: true, name: true } },
    },
  })

  if (pendingEvals.length === 0) {
    return NextResponse.json({ success: true, message: 'Nenhuma avaliacao pendente', sent: 0 })
  }

  // Group by evaluator
  const byEvaluator = new Map<string, { name: string; email: string; evals: { type: string; subjectName: string }[] }>()
  for (const ev of pendingEvals) {
    const key = ev.evaluatorId
    if (!byEvaluator.has(key)) {
      byEvaluator.set(key, {
        name: ev.evaluator.name,
        email: ev.evaluator.email,
        evals: [],
      })
    }
    byEvaluator.get(key)!.evals.push({
      type: ev.type,
      subjectName: ev.subject.name,
    })
  }

  let dmsSent = 0
  let dmsFailed = 0
  let channelSent = false

  // Send DMs
  if ((mode === 'dm' || mode === 'both') && config.botToken) {
    for (const [, person] of byEvaluator) {
      const blocks = buildPendingNotificationBlocks(person.name, cycle.name, person.evals)
      const text = `Voce tem ${person.evals.length} avaliacao(oes) pendente(s) no ciclo ${cycle.name}`
      const ok = await sendSlackDM(config, person.email, { text, blocks })
      if (ok) dmsSent++
      else dmsFailed++
    }
  }

  // Send channel summary
  if ((mode === 'channel' || mode === 'both') && (config.webhookUrl || (config.botToken && config.channel))) {
    const pendingByPerson = Array.from(byEvaluator.values()).map(p => ({
      name: p.name,
      email: p.email,
      count: p.evals.length,
    }))
    const blocks = buildChannelSummaryBlocks(cycle.name, pendingByPerson)
    const text = `${pendingByPerson.length} colaboradores com avaliacoes pendentes no ciclo ${cycle.name}`
    channelSent = await sendSlackChannel(config, { text, blocks })
  }

  return NextResponse.json({
    success: true,
    summary: {
      totalPending: pendingEvals.length,
      evaluatorsNotified: dmsSent,
      dmsFailed,
      channelSent,
    },
  })
}
