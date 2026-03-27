import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const evaluationId = searchParams.get('evaluationId')
  const subjectId = searchParams.get('subjectId')
  const cycleId = searchParams.get('cycleId')

  if (evaluationId) {
    const projects = await prisma.project.findMany({
      where: { evaluationId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(projects)
  }

  // Get all projects for a subject in a cycle (across evaluations)
  if (subjectId && cycleId) {
    const evaluations = await prisma.evaluation.findMany({
      where: { subjectId, cycleId },
      select: { id: true },
    })
    const evalIds = evaluations.map(e => e.id)
    const projects = await prisma.project.findMany({
      where: { evaluationId: { in: evalIds } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(projects)
  }

  return NextResponse.json([])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { evaluationId, name, description, deliveryPct, evidenceFile } = body

  if (!evaluationId || !name) {
    return NextResponse.json({ error: 'evaluationId e name obrigatórios' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: {
      evaluationId,
      name,
      description: description || '',
      deliveryPct: deliveryPct ?? 100,
      evidenceFile: evidenceFile || null,
    },
  })

  return NextResponse.json(project)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...data } = body

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  }

  // Handle validation by manager
  if (data.validated !== undefined) {
    data.validatedAt = data.validated ? new Date() : null
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  })

  return NextResponse.json(project)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  }

  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
