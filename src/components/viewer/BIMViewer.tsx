'use client'

import { useState, useEffect } from 'react'
import { Ruler, Layers, X, Keyboard } from 'lucide-react'
import { useXeokit } from '@/hooks/useXeokit'
import type { IFCElement, ExecutionRecord, LoadedModel } from '@/types'

interface BIMViewerProps {
  model:            LoadedModel
  records:          ExecutionRecord[]
  filterStatus?:    string
  onSelect:         (element: IFCElement) => void
  onReady?:         (controls: ReturnType<typeof useXeokit>) => void
  onElementCount?:  (count: number) => void
  onClosePanel?:    () => void
}

export default function BIMViewer({ model, records, filterStatus, onSelect, onReady, onElementCount, onClosePanel }: BIMViewerProps) {
  const controls = useXeokit({ canvasId: 'xeokit-canvas', model, onElementSelect: onSelect })
  const [activeLevel, setActiveLevel] = useState<string | null>(null)

  useEffect(() => {
    if (!controls.isLoading) controls.applyColors(records, filterStatus)
  }, [records, filterStatus, controls.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!controls.isLoading && onReady) onReady(controls)
  }, [controls.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (controls.elementCount > 0 && onElementCount) onElementCount(controls.elementCount)
  }, [controls.elementCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset active level when model reloads
  useEffect(() => {
    setActiveLevel(null)
  }, [model])

  // Atalhos de teclado — F: foco (zoom no aabb), H: reset câmera,
  // M: alterna medição, Esc: fecha painel. Ignora quando o foco está em
  // um input/textarea/select para não roubar tecla durante digitação.
  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target)) return
      switch (e.key.toLowerCase()) {
        case 'f': controls.resetCamera(); break
        case 'h': controls.resetCamera(); break
        case 'm': controls.toggleMeasure(); break
        case 'escape': onClosePanel?.(); break
        default: return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [controls.resetCamera, controls.toggleMeasure, onClosePanel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full bg-neutral-900">

      {/* Loading */}
      {controls.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Carregando modelo BIM…</span>
            {model.type === 'ifc' && (
              <span className="text-xs text-neutral-400 max-w-xs text-center">
                Arquivos IFC podem levar alguns minutos dependendo do tamanho.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {controls.error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-red-900/80 text-red-200 p-4 rounded-lg max-w-sm text-center">
            <p className="font-semibold">Falha ao carregar modelo</p>
            <p className="text-xs mt-1">{controls.error}</p>
          </div>
        </div>
      )}

      {/* ── Painel de Pavimentos ─────────────────────────────── */}
      {!controls.isLoading && !controls.error && controls.modelLevels.length > 0 && (
        <div className="absolute left-2 top-2 z-10">
          <div className="bg-neutral-900/85 backdrop-blur-sm border border-neutral-700 rounded-xl p-1.5 flex flex-col gap-0.5 max-h-[55vh] overflow-y-auto shadow-xl">
            <div className="flex items-center gap-1.5 px-1.5 pb-1 border-b border-neutral-700">
              <Layers className="w-3 h-3 text-neutral-400" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pavimentos</span>
            </div>
            <button
              onClick={() => { controls.isolateLevel(null); setActiveLevel(null) }}
              className={`text-xs px-2.5 py-1 rounded-lg text-left font-medium transition-colors mt-0.5
                ${!activeLevel ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-700'}`}
            >
              Todos
            </button>
            {controls.modelLevels.map(level => (
              <button
                key={level}
                onClick={() => { controls.isolateLevel(level); setActiveLevel(level) }}
                className={`text-xs px-2.5 py-1 rounded-lg text-left truncate max-w-[140px] font-medium transition-colors
                  ${activeLevel === level ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-700'}`}
                title={level}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Ferramenta de Medição ────────────────────────────── */}
      {!controls.isLoading && !controls.error && (
        <div className="absolute bottom-36 left-2 z-10 flex flex-col gap-1">
          <button
            onClick={controls.toggleMeasure}
            title={controls.measureActive ? 'Clique em dois pontos para medir' : 'Ativar medição de comprimento'}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold shadow-lg border transition-colors
              ${controls.measureActive
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-neutral-900/85 border-neutral-700 text-neutral-300 hover:bg-neutral-700 backdrop-blur-sm'}`}
          >
            <Ruler className="w-3.5 h-3.5" />
            {controls.measureActive ? 'Medindo…' : 'Medir'}
          </button>
          {controls.measureActive && (
            <button
              onClick={controls.clearMeasurements}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold bg-neutral-900/85 border border-neutral-700 text-red-400 hover:bg-red-900/50 shadow-lg backdrop-blur-sm transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Dica de atalhos (apenas desktop) */}
      {!controls.isLoading && !controls.error && (
        <div className="hidden md:flex absolute top-2 right-40 z-10 items-center gap-1 bg-neutral-900/70 backdrop-blur-sm border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-neutral-400">
          <Keyboard className="w-3 h-3" />
          <span><kbd className="font-mono">F</kbd>/<kbd className="font-mono">H</kbd> foco</span>
          <span>·</span>
          <span><kbd className="font-mono">M</kbd> medir</span>
          <span>·</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      )}

      <canvas id="xeokit-canvas" className="w-full h-full" style={{ outline: 'none' }} />
      <canvas id="xeokit-canvas-navcube" className="absolute bottom-4 right-4 w-28 h-28 pointer-events-none" />
    </div>
  )
}
