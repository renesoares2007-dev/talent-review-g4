import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNinebox } from '@/lib/ninebox'
import * as XLSX from 'xlsx'

interface RowData {
  email?: string
  nota_cultura?: number | string
  culture_score?: number | string
  nota_resultados?: number | string
  results_score?: number | string
  pontos_fortes?: string
  strengths?: string
  melhorias?: string
  improvements?: string
  tags?: string
}

function parseScore(val: number | string | undefined): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'))
  if (isNaN(n)) return null
  return Math.min(Math.max(n, 0), 4)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const cycleId = formData.get('cycleId') as string

    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    if (!cycleId) return NextResponse.json({ error: 'Ciclo não informado' }, { status: 400 })

    // Verify cycle exists
    const cycle = await prisma.evaluationCycle.findUnique({ where: { id: cycleId } })
    if (!cycle) return NextResponse.json({ error: 'Ciclo não encontrado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows: RowData[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 })
    }

    // Load all employees for email lookup
    const allEmployees = await prisma.employee.findMany({ select: { id: true, email: true, name: true } })
    const emailToEmployee = new Map(allEmployees.map(e => [e.email.toLowerCase(), e]))

    const errors: string[] = []
    const imported: string[] = []
    const skipped: string[] = []

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const line = i + 2

      const email = String(row.email || '').trim().toLowerCase()
      if (!email) {
        errors.push(`Linha ${line}: email obrigatório`)
        continue
      }

      const employee = emailToEmployee.get(email)
      if (!employee) {
        errors.push(`Linha ${line}: colaborador não encontrado (${email})`)
        continue
      }

      const cultureScore = parseScore(row.nota_cultura ?? row.culture_score)
      const resultsScore = parseScore(row.nota_resultados ?? row.results_score)

      if (cultureScore === null && resultsScore === null) {
        errors.push(`Linha ${line}: pelo menos uma nota é obrigatória`)
        continue
      }

      const strengths = String(row.pontos_fortes || row.strengths || '').trim() || null
      const improvements = String(row.melhorias || row.improvements || '').trim() || null
      const tags = String(row.tags || '').trim() || null

      try {
        // Create a "manager" evaluation record with the scores (evaluator = subject for historical)
        const evaluation = await prisma.evaluation.upsert({
          where: {
            cycleId_subjectId_evaluatorId_type: {
              cycleId,
              subjectId: employee.id,
              evaluatorId: employee.id,
              type: 'manager',
            },
          },
          create: {
            cycleId,
            subjectId: employee.id,
            evaluatorId: employee.id,
            type: 'manager',
            status: 'completed',
            cultureScore: cultureScore ?? 0,
            resultsScore: resultsScore ?? 0,
            strengths,
            improvements,
            tags,
          },
          update: {
            status: 'completed',
            cultureScore: cultureScore ?? 0,
            resultsScore: resultsScore ?? 0,
            strengths,
            improvements,
            tags,
          },
        })

        // Also create self evaluation so consolidation works
        await prisma.evaluation.upsert({
          where: {
            cycleId_subjectId_evaluatorId_type: {
              cycleId,
              subjectId: employee.id,
              evaluatorId: employee.id,
              type: 'self',
            },
          },
          create: {
            cycleId,
            subjectId: employee.id,
            evaluatorId: employee.id,
            type: 'self',
            status: 'completed',
            cultureScore: cultureScore ?? 0,
            resultsScore: resultsScore ?? 0,
            strengths,
            improvements,
            tags,
          },
          update: {
            status: 'completed',
            cultureScore: cultureScore ?? 0,
            resultsScore: resultsScore ?? 0,
            strengths,
            improvements,
            tags,
          },
        })

        // Calculate ninebox and upsert consolidated result
        const culture = cultureScore ?? 0
        const results = resultsScore ?? 0
        const ninebox = calculateNinebox(culture, results)
        const aiAnalysis = `Nota Cultura: ${culture.toFixed(2)}/4 | Nota Resultados: ${results.toFixed(2)}/4 | Ninebox: ${ninebox.label} (importado via planilha)`

        await prisma.consolidatedResult.upsert({
          where: { cycleId_subjectId: { cycleId, subjectId: employee.id } },
          create: {
            cycleId,
            subjectId: employee.id,
            cultureScore: culture,
            resultsScore: results,
            nineboxPosition: ninebox.position,
            aiAnalysis,
          },
          update: {
            cultureScore: culture,
            resultsScore: results,
            nineboxPosition: ninebox.position,
            aiAnalysis,
          },
        })

        imported.push(employee.name)
      } catch (err) {
        console.error(`Error importing evaluation for ${email}:`, err)
        skipped.push(`${employee.name} (${email})`)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rawRows.length,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
        importedNames: imported,
        skippedNames: skipped,
        errorDetails: errors,
      },
    })
  } catch (err) {
    console.error('Evaluation import error:', err)
    return NextResponse.json({ error: 'Erro ao processar planilha' }, { status: 500 })
  }
}
