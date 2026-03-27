import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { prisma } from './prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // Check if employee exists in the database
      const employee = await prisma.employee.findUnique({
        where: { email: user.email.toLowerCase() },
      })

      if (!employee) {
        // Employee not registered - deny access
        return '/login?error=not_registered'
      }

      return true
    },
    async jwt({ token, user, account }) {
      if (account && user?.email) {
        // First login - fetch employee data
        const employee = await prisma.employee.findUnique({
          where: { email: user.email.toLowerCase() },
        })

        if (employee) {
          token.employeeId = employee.id
          token.name = employee.name
          token.email = employee.email
          token.role = employee.role
          token.department = employee.department
          token.isAdmin = employee.isAdmin
          token.isManager = employee.isManager
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.employeeId as string
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.role = token.role as string
        session.user.department = token.department as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isManager = token.isManager as boolean
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
})
