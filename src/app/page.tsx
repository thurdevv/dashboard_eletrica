'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    if (getCurrentSession()) {
      router.replace('/projects')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
