'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthSyncContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const data = searchParams.get('data')
    if (data) {
      try {
        const user = JSON.parse(decodeURIComponent(data))
        localStorage.setItem('user', JSON.stringify(user))
        router.replace('/home')
      } catch {
        router.replace('/login')
      }
    } else {
      router.replace('/login')
    }
  }, [searchParams, router])

  return null
}

export default function AuthSyncPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-g4-purple-dark via-g4-purple to-g4-burgundy">
      <div className="text-center text-white">
        <svg className="animate-spin h-8 w-8 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Autenticando...</p>
      </div>
      <Suspense>
        <AuthSyncContent />
      </Suspense>
    </div>
  )
}
