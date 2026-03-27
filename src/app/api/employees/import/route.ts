import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

interface RowData {
  nome?: string
  name?: string
  email?: string
  cargo?: string
  role?: string
  departamento?: string
  department?: string
  gestor_email?: string
  manager_email?: string
  gestor?: string
  admin?: string | boolean | number
  is_admin?: string | boolean | number
  is_manager?: string | boolean | number
}

function parseBool(val: string | boolean | number | undefined): boolean {
  if (val === undefined || val === null || val === '') return false
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 1
  const s = String(val).trim().toLowerCase()
  return s === 'sim' || s === 'yes' || s === 'true' || s === '1' || s === 'x'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows: RowData[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 })
    }

    // Normalize rows
    const rows = rawRows.map(row => ({
      name: String(row.nome || row.name || '').trim(),
      email: String(row.email || '').trim().toLowerCase(),
      role: String(row.cargo || row.role || '').trim(),
      department: String(row.departamento || row.department || '').trim(),
      managerEmail: String(row.gestor_email || row.manager_email || row.gestor || '').trim().toLowerCase(),
      isAdmin: parseBool(row.admin || row.is_admin),
      isManager: parseBool(row.gestor ? undefined : row.is_manager),
    }))

    // Validate
    const errors: string[] = []
    const emails = new Set<string>()
    rows.forEach((row, i) => {
      const line = i + 2 // header is line 1
      if (!row.name) errors.push(`Linha ${line}: nome obrigatório`)
      if (!row.email) errors.push(`Linha ${line}: email obrigatório`)
      else if (emails.has(row.email)) errors.push(`Linha ${line}: email duplicado (${row.email})`)
      else emails.add(row.email)
      if (!row.role) errors.push(`Linha ${line}: cargo obrigatório`)
      if (!row.department) errors.push(`Linha ${line}: departamento obrigatório`)
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Erros de validação', details: errors }, { status: 400 })
    }

    // Get existing employees to check for duplicates and resolve managers
    const existingEmployees = await prisma.employee.findMany({ select: { id: true, email: true } })
    const existingEmails = new Map(existingEmployees.map(e => [e.email.toLowerCase(), e.id]))

    // First pass: create/update all employees without manager
    const created: string[] = []
    const updated: string[] = []
    const skipped: string[] = []

    for (const row of rows) {
      if (!row.email) continue

      const data = {
        name: row.name,
        email: row.email,
        role: row.role,
        department: row.department,
        isAdmin: row.isAdmin,
        isManager: row.isManager,
      }

      const existingId = existingEmails.get(row.email)
      if (existingId) {
        await prisma.employee.update({ where: { id: existingId }, data })
        updated.push(row.name)
      } else {
        const emp = await prisma.employee.create({ data })
        existingEmails.set(row.email, emp.id)
        created.push(row.name)
      }
    }

    // Second pass: set managers by email
    for (const row of rows) {
      if (!row.managerEmail || !row.email) continue
      const managerId = existingEmails.get(row.managerEmail)
      const employeeId = existingEmails.get(row.email)
      if (managerId && employeeId) {
        await prisma.employee.update({
          where: { id: employeeId },
          data: { managerId },
        })
        // Also ensure manager has isManager flag
        await prisma.employee.update({
          where: { id: managerId },
          data: { isManager: true },
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        created: created.length,
        updated: updated.length,
        createdNames: created,
        updatedNames: updated,
      }
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Erro ao processar planilha' }, { status: 500 })
  }
}
