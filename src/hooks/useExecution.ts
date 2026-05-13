'use client'

import { useState, useCallback } from 'react'
import {
  getExecutionRecord,
  getProjectRecords,
  upsertExecutionRecord,
  uploadExecutionPhoto,
} from '@/lib/api/execution'
import type { ExecutionRecord, ExecutionFormData, IFCElement, FilterState } from '@/types'

export function useExecution(projectId: string) {
  const [records, setRecords]         = useState<ExecutionRecord[]>([])
  const [allRecords, setAllRecords]   = useState<ExecutionRecord[]>([])  // always unfiltered
  const [current, setCurrent]         = useState<ExecutionRecord | null>(null)
  const [saving, setSaving]           = useState(false)
  const [loadingRecords, setLoading]  = useState(false)

  const loadAllRecords = useCallback(async (filters?: Partial<FilterState>) => {
    setLoading(true)
    try {
      const data = await getProjectRecords(projectId, filters)
      setRecords(data)
      // Keep allRecords updated only when loading without any filter
      const hasFilter = filters && (
        (filters.status && filters.status !== 'ALL') ||
        filters.level ||
        filters.elementType
      )
      if (!hasFilter) setAllRecords(data)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadElementRecord = useCallback(async (globalId: string) => {
    const data = await getExecutionRecord(projectId, globalId)
    setCurrent(data)
    return data
  }, [projectId])

  const saveRecord = useCallback(async (
    element: IFCElement,
    form: ExecutionFormData,
    changedBy?: string,
  ) => {
    setSaving(true)
    try {
      let photoUrl: string | undefined
      if (form.photo) {
        photoUrl = await uploadExecutionPhoto(projectId, element.globalId, form.photo)
      }
      const saved = await upsertExecutionRecord(projectId, element, form, photoUrl, changedBy)
      setCurrent(saved)

      // Patch local records list so colors update immediately
      const patchList = (prev: ExecutionRecord[]) => {
        const idx = prev.findIndex((r) => r.ifc_global_id === element.globalId)
        if (idx >= 0) { const copy = [...prev]; copy[idx] = saved; return copy }
        return [...prev, saved]
      }
      setRecords(patchList)
      setAllRecords(patchList)

      return saved
    } finally {
      setSaving(false)
    }
  }, [projectId])

  return {
    records,
    allRecords,
    current,
    saving,
    loadingRecords,
    loadAllRecords,
    loadElementRecord,
    saveRecord,
    setCurrent,
  }
}
