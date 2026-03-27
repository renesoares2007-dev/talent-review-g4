import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const values = await prisma.companyValue.findMany({
    include: { behaviors: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(values)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, description, behaviors } = body

  const value = await prisma.companyValue.create({
    data: {
      name,
      description,
      behaviors: {
        create: behaviors?.map((b: { description: string }) => ({
          description: b.description,
        })) || [],
      },
    },
    include: { behaviors: true },
  })

  return NextResponse.json(value, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, name, description, behaviors } = body

  // Delete existing behaviors and recreate
  await prisma.behavior.deleteMany({ where: { valueId: id } })

  const value = await prisma.companyValue.update({
    where: { id },
    data: {
      name,
      description,
      behaviors: {
        create: behaviors?.map((b: { description: string }) => ({
          description: b.description,
        })) || [],
      },
    },
    include: { behaviors: true },
  })

  return NextResponse.json(value)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.companyValue.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
