'use client'

import { useState, useCallback } from 'react'
import {
  getExecutionRecord,
  getProjectRecords,
  upsertExecutionRecord,
  uploadExecutionPhoto,
} from '@/lib/api/execution'
import { tickAutoBackup } from '@/lib/storage/autoBackup'
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
  ) => {
    setSaving(true)
    try {
      let photoUrl: string | undefined
      if (form.photo) {
        photoUrl = await uploadExecutionPhoto(projectId, element.globalId, form.photo)
      }
      const saved = await upsertExecutionRecord(projectId, element, form, photoUrl)
      setCurrent(saved)

      // Patch local records list so colors update immediately
      const patchList = (prev: ExecutionRecord[]) => {
        const idx = prev.findIndex((r) => r.ifc_global_id === element.globalId)
        if (idx >= 0) { const copy = [...prev]; copy[idx] = saved; return copy }
        return [...prev, saved]
      }
      setRecords(patchList)
      setAllRecords(patchList)

      try { tickAutoBackup(projectId) } catch { /* não bloqueia o save */ }

      return saved
    } finally {
      setSaving(false)
    }
  }, [projectId])

  // Atualiza só o status de N elementos já existentes na lista (edição em massa).
  // Não exige IFCElement pleno — usa os campos já no ExecutionRecord. Preserva o resto.
  const bulkUpdateStatus = useCallback(async (
    globalIds: string[],
    status: ExecutionRecord['status'],
  ): Promise<number> => {
    setSaving(true)
    try {
      let count = 0
      const targets = allRecords.filter((r) => globalIds.includes(r.ifc_global_id))
      for (const r of targets) {
        const fakeElement: IFCElement = {
          globalId: r.ifc_global_id,
          name:     r.element_name,
          type:     r.element_type,
          level:    r.level,
          length:   r.element_length,
          screenshot: r.element_screenshot,
        }
        const form: ExecutionFormData = {
          status,
          executed_quantity: r.executed_quantity,
          team_size:         r.team_size,
          worked_hours:      r.worked_hours,
          notes:             r.notes,
          photo:             null,
          checklist:         r.checklist,
          planned_start:     r.planned_start,
          planned_end:       r.planned_end,
          planned_quantity:  r.planned_quantity,
        }
        await upsertExecutionRecord(projectId, fakeElement, form)
        count++
      }
      // Recarrega para refletir
      const data = await getProjectRecords(projectId)
      setRecords(data); setAllRecords(data)
      return count
    } finally {
      setSaving(false)
    }
  }, [projectId, allRecords])

  return {
    records,
    allRecords,
    current,
    saving,
    loadingRecords,
    loadAllRecords,
    loadElementRecord,
    saveRecord,
    bulkUpdateStatus,
    setCurrent,
  }
}
