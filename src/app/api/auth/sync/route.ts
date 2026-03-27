import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  const employee = await prisma.employee.findUnique({
    where: { email: session.user.email.toLowerCase() },
  })

  if (!employee) {
    return NextResponse.redirect(new URL('/login?error=not_registered', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  // Redirect to a client page that will sync localStorage
  const userData = encodeURIComponent(JSON.stringify({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    isAdmin: employee.isAdmin,
    isManager: employee.isManager,
  }))

  return NextResponse.redirect(new URL(`/auth-sync?data=${userData}`, process.env.NEXTAUTH_URL || 'http://localhost:3000'))
}
