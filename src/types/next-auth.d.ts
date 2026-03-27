import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    role?: string
    department?: string
    isAdmin?: boolean
    isManager?: boolean
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      department: string
      isAdmin: boolean
      isManager: boolean
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    employeeId?: string
    role?: string
    department?: string
    isAdmin?: boolean
    isManager?: boolean
  }
}
