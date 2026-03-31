import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cycles = await prisma.evaluationCycle.findMany({
    include: {
      evaluations: {
        select: { id: true, status: true, type: true, subjectId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(cycles)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, description, startDate, endDate } = body

  const cycle = await prisma.evaluationCycle.create({
    data: {
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ...(body.selfEvalDeadline && { selfEvalDeadline: new Date(body.selfEvalDeadline) }),
      ...(body.stakeholderEvalDeadline && { stakeholderEvalDeadline: new Date(body.stakeholderEvalDeadline) }),
      ...(body.managerEvalDeadline && { managerEvalDeadline: new Date(body.managerEvalDeadline) }),
      ...(body.calibrationDeadline && { calibrationDeadline: new Date(body.calibrationDeadline) }),
      ...(body.feedbackDeadline && { feedbackDeadline: new Date(body.feedbackDeadline) }),
    },
  })

  return NextResponse.json(cycle, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...data } = body

  if (data.startDate) data.startDate = new Date(data.startDate)
  if (data.endDate) data.endDate = new Date(data.endDate)
  if (data.selfEvalDeadline) data.selfEvalDeadline = new Date(data.selfEvalDeadline)
  if (data.stakeholderEvalDeadline) data.stakeholderEvalDeadline = new Date(data.stakeholderEvalDeadline)
  if (data.managerEvalDeadline) data.managerEvalDeadline = new Date(data.managerEvalDeadline)
  if (data.calibrationDeadline) data.calibrationDeadline = new Date(data.calibrationDeadline)
  if (data.feedbackDeadline) data.feedbackDeadline = new Date(data.feedbackDeadline)

  const cycle = await prisma.evaluationCycle.update({
    where: { id },
    data,
  })

  return NextResponse.json(cycle)
}
