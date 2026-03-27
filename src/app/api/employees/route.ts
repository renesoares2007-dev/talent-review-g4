import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const managerId = searchParams.get('managerId')

  const where = managerId ? { managerId } : {}

  const employees = await prisma.employee.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
      subordinates: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(employees)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, email, role, department, managerId, isAdmin, isManager } = body

  const employee = await prisma.employee.create({
    data: { name, email, role, department, managerId: managerId || null, isAdmin: isAdmin || false, isManager: isManager || false },
  })

  return NextResponse.json(employee, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...data } = body

  const employee = await prisma.employee.update({
    where: { id },
    data,
  })

  return NextResponse.json(employee)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await prisma.employee.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
