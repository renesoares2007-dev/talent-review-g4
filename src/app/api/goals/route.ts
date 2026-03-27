import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycleId')
  const subjectId = searchParams.get('subjectId')

  if (!cycleId || !subjectId) {
    return NextResponse.json([])
  }

  const goals = await prisma.goalsPanelItem.findMany({
    where: { cycleId, subjectId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(goals)
}

interface GoalRow {
  meta?: string
  goal?: string
  objetivo?: string
  alvo?: number | string
  target?: number | string
  realizado?: number | string
  actual?: number | string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const cycleId = formData.get('cycleId') as string
    const subjectId = formData.get('subjectId') as string

    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    if (!cycleId || !subjectId) return NextResponse.json({ error: 'cycleId e subjectId obrigatórios' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows: GoalRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 })
    }

    // Delete existing goals for this subject/cycle
    await prisma.goalsPanelItem.deleteMany({ where: { cycleId, subjectId } })

    const goals = []
    const errors: string[] = []

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const line = i + 2

      const goalName = String(row.meta || row.goal || row.objetivo || '').trim()
      if (!goalName) {
        errors.push(`Linha ${line}: nome da meta obrigatório`)
        continue
      }

      const target = parseFloat(String(row.alvo || row.target || '0').replace(',', '.'))
      const actual = parseFloat(String(row.realizado || row.actual || '0').replace(',', '.'))

      if (isNaN(target) || target === 0) {
        errors.push(`Linha ${line}: valor alvo inválido ou zero`)
        continue
      }

      const percentage = (actual / target) * 100

      const goal = await prisma.goalsPanelItem.create({
        data: {
          cycleId,
          subjectId,
          goalName,
          target,
          actual,
          percentage,
        },
      })
      goals.push(goal)
    }

    return NextResponse.json({
      success: true,
      goals,
      errors,
      summary: { total: rawRows.length, imported: goals.length, errors: errors.length },
    })
  } catch (err) {
    console.error('Goals import error:', err)
    return NextResponse.json({ error: 'Erro ao processar planilha' }, { status: 500 })
  }
}
