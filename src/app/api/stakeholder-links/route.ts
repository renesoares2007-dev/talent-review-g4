import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const evaluationId = searchParams.get('evaluationId')

  if (token) {
    const link = await prisma.stakeholderLink.findUnique({
      where: { token },
      include: {
        evaluation: {
          include: {
            subject: true,
            cycle: true,
            cultureEvaluations: { include: { behavior: { include: { value: true } } } },
            resultsEvaluation: true,
          },
        },
        employee: true,
      },
    })

    if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    if (link.expiresAt < new Date()) return NextResponse.json({ error: 'Link expirado' }, { status: 410 })

    return NextResponse.json(link)
  }

  if (evaluationId) {
    const links = await prisma.stakeholderLink.findMany({
      where: { evaluation: { subjectId: evaluationId } },
    })
    return NextResponse.json(links)
  }

  return NextResponse.json({ error: 'token or evaluationId required' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cycleId, subjectId, stakeholders } = body

  const results = []

  for (const sh of stakeholders) {
    // Create evaluation for stakeholder
    const evaluation = await prisma.evaluation.create({
      data: {
        cycleId,
        subjectId,
        evaluatorId: sh.employeeId,
        type: 'stakeholder',
        status: 'pending',
      },
    })

    // Create stakeholder link
    const link = await prisma.stakeholderLink.create({
      data: {
        evaluationId: evaluation.id,
        employeeId: sh.employeeId,
        token: uuidv4(),
        email: sh.email,
        name: sh.name,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    results.push({ evaluation, link })
  }

  return NextResponse.json(results, { status: 201 })
}
