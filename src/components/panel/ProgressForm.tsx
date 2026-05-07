'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Save, Loader2, Camera, Plus, Trash2, Ruler } from 'lucide-react'
import ProductivityCard from './ProductivityCard'
import { getDailyLog, addDailyEntry, deleteDailyEntry } from '@/lib/api/execution'
import type { ExecutionFormData, ExecutionRecord, ExecutionStatus, DailyEntry } from '@/types'
import { STATUS_LABELS } from '@/types'

interface ProgressFormProps {
  initial?:       ExecutionRecord | null
  onSave:         (form: ExecutionFormData) => Promise<void>
  saving:         boolean
  projectId?:     string
  globalId?:      string
  elementLength?: number
}

const STATUSES: ExecutionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE']

const STATUS_COLORS_CSS: Record<ExecutionStatus, string> = {
  NOT_STARTED: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  IN_PROGRESS:  'bg-orange-50 border-orange-400 text-orange-800',
  COMPLETED:    'bg-green-50 border-green-400 text-green-800',
  ISSUE:        'bg-red-50 border-red-400 text-red-800',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function ProgressForm({ initial, onSave, saving, projectId, globalId, elementLength }: ProgressFormProps) {
  const [status,    setStatus]    = useState<ExecutionStatus>(initial?.status ?? 'NOT_STARTED')
  const [qty,       setQty]       = useState(initial?.executed_quantity ?? 0)
  const [team,      setTeam]      = useState(initial?.team_size         ?? 1)
  const [hours,     setHours]     = useState(initial?.worked_hours      ?? 0)
  const [notes,     setNotes]     = useState(initial?.notes             ?? '')
  const [photo,     setPhoto]     = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved,     setSaved]     = useState(false)

  // Planejamento (curva S)
  const [plannedStart,    setPlannedStart]    = useState(initial?.planned_start    ?? '')
  const [plannedEnd,      setPlannedEnd]      = useState(initial?.planned_end      ?? '')
  const [plannedQuantity, setPlannedQuantity] = useState<number>(initial?.planned_quantity ?? 0)

  // daily log
  const [dailyLog,       setDailyLog]       = useState<DailyEntry[]>([])
  const [newDate,        setNewDate]        = useState(todayStr)
  const [newMeters,      setNewMeters]      = useState<number>(0)
  const [newDailyNotes,  setNewDailyNotes]  = useState('')
  const [addingEntry,    setAddingEntry]    = useState(false)

  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // Load daily log when element changes
  useEffect(() => {
    if (projectId && globalId) {
      setDailyLog(getDailyLog(projectId, globalId))
    } else {
      setDailyLog([])
    }
  }, [projectId, globalId])

  // When daily log changes and has entries, keep qty in sync with sum
  useEffect(() => {
    if (dailyLog.length > 0) {
      const sum = dailyLog.reduce((acc, e) => acc + e.meters, 0)
      setQty(parseFloat(sum.toFixed(3)))
    }
  }, [dailyLog])

  function handlePhotoChange(file: File | null) {
    setPhoto(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function handleAddDailyEntry() {
    if (!projectId || !globalId || newMeters <= 0) return
    const updated = addDailyEntry(projectId, globalId, newMeters, newDate, newDailyNotes)
    setDailyLog(updated)
    setNewMeters(0)
    setNewDailyNotes('')
    setAddingEntry(false)
  }

  function handleDeleteEntry(entryId: string) {
    if (!projectId || !globalId) return
    const updated = deleteDailyEntry(projectId, globalId, entryId)
    setDailyLog(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaved(false)
    try {
      await onSave({
        status, executed_quantity: qty, team_size: team, worked_hours: hours, notes, photo,
        planned_start:    plannedStart || undefined,
        planned_end:      plannedEnd || undefined,
        planned_quantity: plannedQuantity > 0 ? plannedQuantity : undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  const totalDailyMeters = dailyLog.reduce((acc, e) => acc + e.meters, 0)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">

      {/* Comprimento do elemento */}
      {elementLength !== undefined && elementLength > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Ruler className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-700 font-medium">Comprimento IFC</p>
            <p className="text-sm font-bold text-amber-800">{elementLength.toFixed(3)} m</p>
          </div>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
          Status
        </label>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                ${STATUS_COLORS_CSS[s]}
                ${status === s ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-60 hover:opacity-90'}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Progresso Diário — visível quando EM EXECUÇÃO e tiver projectId/globalId */}
      {status === 'IN_PROGRESS' && projectId && globalId && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">
              Progresso Diário
            </p>
            {totalDailyMeters > 0 && (
              <span className="text-xs font-bold text-yellow-700">
                Total: {totalDailyMeters.toFixed(2)} m
              </span>
            )}
          </div>

          {/* Entradas existentes */}
          {dailyLog.length > 0 && (
            <div className="divide-y divide-yellow-100">
              {dailyLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 px-3 py-2 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {entry.date} — <span className="text-yellow-700">{entry.meters.toFixed(2)} m</span>
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 truncate">{entry.notes}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de nova entrada */}
          {addingEntry ? (
            <div className="p-3 bg-yellow-50 border-t border-yellow-200 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Data</label>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Metros feitos</label>
                  <input type="number" min={0} step="0.01" value={newMeters || ''}
                    placeholder="0.00"
                    onChange={(e) => setNewMeters(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
              <input type="text" value={newDailyNotes}
                onChange={(e) => setNewDailyNotes(e.target.value)}
                placeholder="Obs. (opcional)"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <div className="flex gap-2">
                <button type="button" onClick={handleAddDailyEntry}
                  disabled={newMeters <= 0}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded">
                  Confirmar
                </button>
                <button type="button" onClick={() => setAddingEntry(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold py-1.5 rounded">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingEntry(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 border-t border-yellow-200">
              <Plus className="w-3.5 h-3.5" /> Adicionar entrada do dia
            </button>
          )}
        </div>
      )}

      {/* Quantidade total executada */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          {dailyLog.length > 0 ? 'Total Executado (m) — soma das entradas' : 'Quantidade Executada (m)'}
        </label>
        <input type="number" min={0} step="0.01" value={qty}
          onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
          readOnly={dailyLog.length > 0}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
            ${dailyLog.length > 0 ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`} />
        {dailyLog.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">Calculado automaticamente pelo progresso diário.</p>
        )}
        {dailyLog.length === 0 && elementLength !== undefined && elementLength > 0 && qty !== elementLength && (
          <button type="button" onClick={() => setQty(parseFloat(elementLength.toFixed(3)))}
            className="text-xs text-blue-600 hover:underline mt-1">
            Sugestão IFC: {elementLength.toFixed(3)} m — usar esse valor
          </button>
        )}
      </div>

      {/* Equipe / Horas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Tamanho da Equipe
          </label>
          <input type="number" min={1} step={1} value={team}
            onChange={(e) => setTeam(parseInt(e.target.value) || 1)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Horas Trabalhadas
          </label>
          <input type="number" min={0} step="0.5" value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      {/* Produtividade */}
      <ProductivityCard executedQty={qty} teamSize={team} workedHours={hours} unit="m" />

      {/* Planejamento */}
      <details className="border border-gray-200 rounded-lg group">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
          <span>Planejamento (curva S)</span>
          <span className="text-gray-300 group-open:rotate-90 transition-transform">›</span>
        </summary>
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Início Plan.</label>
            <input type="date" value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Fim Plan.</label>
            <input type="date" value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-0.5">Qtd. Planejada (m)</label>
            <input type="number" min={0} step="0.01" value={plannedQuantity || ''}
              onChange={(e) => setPlannedQuantity(parseFloat(e.target.value) || 0)}
              placeholder="opcional"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>
      </details>

      {/* Observações */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Observações
        </label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Pendências, materiais usados, condições do local…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {/* Foto */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Foto
        </label>
        <div className="flex gap-2">
          <label className="flex-1 flex flex-col items-center gap-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-2 py-3 hover:border-blue-400 transition-colors">
            <Camera className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-500">Câmera</span>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)} />
          </label>
          <label className="flex-1 flex flex-col items-center gap-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-2 py-3 hover:border-blue-400 transition-colors">
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-500">Galeria</span>
            <input ref={galleryRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {preview && (
          <div className="mt-2 relative">
            <img src={preview} alt="Foto selecionada" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
            <button type="button" onClick={() => { setPhoto(null); setPreview(null) }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
              ×
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          {saveError}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2 font-medium">
          ✓ Progresso salvo com sucesso!
        </div>
      )}

      <button type="submit" disabled={saving}
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors">
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          : <><Save className="w-4 h-4" /> Salvar Progresso</>}
      </button>
    </form>
  )
}
