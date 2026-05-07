'use client'

import { useEffect } from 'react'
import { initSentryIfEnabled } from '@/lib/observability/sentry'

export default function SentryInit() {
  useEffect(() => { initSentryIfEnabled() }, [])
  return null
}
