'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Printer, QrCode, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import type { ExecutionRecord } from '@/types'

interface QRCodesModalProps {
  projectId:    string
  projectName:  string
  records:      ExecutionRecord[]
  levels:       string[]
  elementTypes: string[]
  onClose:      () => void
}

type Density = 4 | 6 | 12   // QR codes por página

// Gera URLs absolutas para deep-link. Funciona local e em produção.
function buildElementUrl(projectId: string, globalId: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/projects/${projectId}?element=${encodeURIComponent(globalId)}`
}

export default function QRCodesModal({
  projectId, projectName, records, levels, elementTypes, onClose,
}: QRCodesModalProps) {
  const [filterLevel, setFilterLevel] = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [density,     setDensity]     = useState<Density>(6)
  const [qrImages,    setQrImages]    = useState<Record<string, string>>({})
  const [generating,  setGenerating]  = useState(false)

  const visible = useMemo(() => records.filter((r) => {
    if (filterLevel && r.level !== filterLevel) return false
    if (filterType  && r.element_type !== filterType) return false
    return true
  }), [records, filterLevel, filterType])

  // Gera todos os QRs como data URLs (SVG seria menor mas PNG renderiza
  // melhor em impressão). Cache por globalId pra não regerar a cada filtro.
  useEffect(() => {
    let cancelled = false
    setGenerating(true)
    const sizeMap: Record<Density, number> = { 4: 360, 6: 280, 12: 180 }
    const size = sizeMap[density]

    Promise.all(
      visible
        .filter((r) => r.ifc_global_id && !qrImages[r.ifc_global_id])
        .map(async (r) => {
          const url  = buildElementUrl(projectId, r.ifc_global_id)
          const data = await QRCode.toDataURL(url, {
            width: size, margin: 1, errorCorrectionLevel: 'M',
          })
          return [r.ifc_global_id, data] as const
        })
    ).then((entries) => {
      if (cancelled) return
      setQrImages((prev) => {
        const next = { ...prev }
        for (const [id, data] of entries) next[id] = data
        return next
      })
      setGenerating(false)
    }).catch(() => {
      if (!cancelled) setGenerating(false)
    })

    return () => { cancelled = true }
  }, [visible, density, projectId])  // eslint-disable-line react-hooks/exhaustive-deps

  const gridCols: Record<Density, string> = {
    4:  'grid-cols-2',           // 2x2 = 4 por A4
    6:  'grid-cols-2 lg:grid-cols-3',  // 2x3 = 6 por A4
    12: 'grid-cols-3 lg:grid-cols-4',  // 3x4 = 12 por A4
  }
  const cellPadding: Record<Density, string> = { 4: 'p-6', 6: 'p-4', 12: 'p-2' }

  return (
    <>
      {/* Print CSS — esconde tudo exceto o conteúdo da grade */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          .qr-print, .qr-print * { visibility: visible !important; }
          .qr-print { position: absolute; left: 0; top: 0; width: 100%; }
          .qr-no-print { display: none !important; }
          .qr-grid { gap: 4mm !important; }
          .qr-cell { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 qr-no-print"
        onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">QR Codes — {projectName}</h2>
              <span className="text-sm text-gray-400">({visible.length})</span>
            </div>
            <button onClick={onClose} aria-label="Fechar"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-200 bg-gray-50 text-xs qr-no-print">
            {levels.length > 0 && (
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">Pavimento: todos</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {elementTypes.length > 0 && (
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">Tipo: todos</option>
                {elementTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-gray-500">Densidade:</span>
              {([4, 6, 12] as Density[]).map((d) => (
                <button key={d} onClick={() => setDensity(d)}
                  className={`px-2 py-1 rounded font-semibold border transition-colors
                    ${density === d
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {d}/pág.
                </button>
              ))}
            </div>
            <button onClick={() => window.print()}
              disabled={generating || visible.length === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded">
              {generating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando…</>
                : <><Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF</>}
            </button>
          </div>

          {/* Grade */}
          <div className="flex-1 overflow-y-auto p-5 qr-print">
            {visible.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12 italic">
                Nenhum elemento com registro corresponde aos filtros.<br />
                Para gerar QR de elementos sem registro, registre-os primeiro (mesmo que como "Não Iniciado").
              </div>
            ) : (
              <div className={`grid ${gridCols[density]} gap-3 qr-grid`}>
                {visible.map((r) => {
                  const img = r.ifc_global_id ? qrImages[r.ifc_global_id] : null
                  return (
                    <div key={r.ifc_global_id}
                      className={`qr-cell border border-gray-200 rounded-lg ${cellPadding[density]} flex flex-col items-center text-center bg-white`}>
                      {img ? (
                        <img src={img} alt={`QR ${r.element_name}`} className="w-full max-w-[200px] aspect-square" />
                      ) : (
                        <div className="w-full max-w-[200px] aspect-square bg-gray-100 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      )}
                      <p className={`mt-2 font-semibold text-gray-900 break-words leading-tight
                        ${density === 12 ? 'text-[10px]' : density === 6 ? 'text-xs' : 'text-sm'}`}>
                        {r.element_name || '(sem nome)'}
                      </p>
                      {density !== 12 && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {[r.level, r.element_type].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-5 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 qr-no-print">
            Dica: imprima e cole nos eletrodutos/quadros físicos. Eletricistas escaneiam com a câmera do celular para abrir o app direto no elemento.
          </div>
        </div>
      </div>
    </>
  )
}
