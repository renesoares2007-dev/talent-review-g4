import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarizeBehavioralProfile } from '@/lib/ai'

function isReadableText(text: string): boolean {
  if (!text || text.length < 10) return false
  const printable = text.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t\u00A0-\u024F]/g, '')
  return printable.length / text.length > 0.5
}

async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  // PDF
  if (ext === 'pdf') {
    try {
      // Import internal module directly to avoid pdf-parse's test mode issue with Next.js bundler
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(buffer)
      const text = data.text || ''
      if (isReadableText(text)) return text
      return '[Nao foi possivel extrair texto do PDF. O arquivo pode estar protegido ou conter apenas imagens.]'
    } catch (err) {
      console.error('PDF parse error:', err)
      return '[Nao foi possivel extrair texto do PDF. Tente enviar em formato .txt ou .docx.]'
    }
  }

  // Excel / CSV
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const texts: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        texts.push(csv)
      }
      return texts.join('\n\n')
    } catch {
      return '[Nao foi possivel ler a planilha. Verifique o formato do arquivo.]'
    }
  }

  // Plain text
  const text = buffer.toString('utf-8').substring(0, 5000)
  if (isReadableText(text)) return text
  return '[Formato nao suportado. Envie o perfil em formato .txt, .csv ou .pdf com texto selecionavel.]'
}

async function uploadFile(file: File, type: string): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Use Vercel Blob if available (production), otherwise fallback to local filesystem
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${type}/${Date.now()}-${file.name}`, buffer, {
      access: 'public',
      contentType: file.type,
    })
    return blob.url
  }

  // Local fallback for development
  const { writeFile, mkdir } = await import('fs/promises')
  const path = await import('path')
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', type)
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${Date.now()}-${file.name}`
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)
  return `/uploads/${type}/${fileName}`
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const type = formData.get('type') as string
  const employeeId = formData.get('employeeId') as string

  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const publicPath = await uploadFile(file, type)

  // If it's a behavioral profile, extract text and generate summary
  if (type === 'behavioral_profile' && employeeId) {
    const extractedText = await extractText(buffer, file.name)

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } })
    const empName = employee?.name || 'Colaborador'

    let profileSummary = ''

    try {
      const aiSummary = await summarizeBehavioralProfile(extractedText, empName)
      if (aiSummary && !aiSummary.startsWith('[IA não configurada')) {
        profileSummary = aiSummary
      }
    } catch (err) {
      console.error('Error generating profile summary:', err)
    }

    if (!profileSummary) {
      const lines = extractedText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0)
      const meaningful = lines.filter(l => l.length > 10).slice(0, 30)
      profileSummary = `**Perfil Comportamental - ${empName}**\n\n${meaningful.join('\n')}`
      if (profileSummary.length > 3000) {
        profileSummary = profileSummary.substring(0, 3000) + '\n\n[... texto resumido]'
      }
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        behavioralProfile: publicPath,
        behavioralProfileText: profileSummary,
      },
    })
  }

  // If it's a photo, update employee
  if (type === 'photo' && employeeId) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { photo: publicPath },
    })
  }

  return NextResponse.json({ path: publicPath, fileName: file.name })
}
