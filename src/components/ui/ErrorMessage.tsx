'use client'

import { AlertCircle } from 'lucide-react'
import { getErrorContent, type AppError, type ErrorCode } from '@/lib/errors'

type Variant = 'block' | 'inline' | 'overlay'

interface ErrorMessageProps {
  /** Código tipado de `lib/errors.ts`. Tem prioridade sobre `error`. */
  code?:     ErrorCode
  /** AppError pronto (ou qualquer Error). Se for AppError, usa o code dele. */
  error?:    unknown
  /** Texto livre para sobrescrever ou complementar a descrição. */
  detail?:   string
  /**
   * - `block`   (padrão): card vermelho, ocupa largura do container.
   * - `inline`: linha compacta com ícone — para formulários.
   * - `overlay`: card centralizado em fundo escuro — para viewer/cheios.
   */
  variant?:  Variant
  /** Ação opcional (ex: tentar de novo). */
  action?:   { label: string; onClick: () => void }
}

/**
 * Componente único para exibir erros na UI. Centraliza visual e textos
 * para que toda a aplicação fale a mesma língua.
 */
export default function ErrorMessage({ code, error, detail, variant = 'block', action }: ErrorMessageProps) {
  const resolvedCode = code
    ?? (error && typeof error === 'object' && 'code' in error
        ? (error as AppError).code
        : 'UNKNOWN')
  const content = getErrorContent(resolvedCode)

  const extraDetail = detail
    ?? (error instanceof Error ? error.message : undefined)
    ?? (error && typeof error === 'object' && 'detail' in error
        ? (error as AppError).detail
        : undefined)

  if (variant === 'inline') {
    return (
      <div role="alert" className="flex items-start gap-2 text-xs bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 text-red-300">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{content.title}</p>
          {content.description && <p className="text-red-200/80 mt-0.5">{content.description}</p>}
          {extraDetail && extraDetail !== content.description && (
            <p className="text-neutral-400 mt-0.5 break-words">{extraDetail}</p>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'overlay') {
    return (
      <div role="alert" className="absolute inset-0 flex items-center justify-center z-10 p-4">
        <div className="bg-neutral-900/95 border border-red-900/60 rounded-xl p-5 max-w-md text-center shadow-2xl">
          <div className="w-10 h-10 mx-auto mb-3 bg-red-600/20 border border-red-600/40 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-red-300 font-semibold">{content.title}</p>
          <p className="text-neutral-300 text-sm mt-1.5">{content.description}</p>
          {content.hint && <p className="text-neutral-400 text-xs mt-3">{content.hint}</p>}
          {extraDetail && extraDetail !== content.description && (
            <p className="text-neutral-500 text-[11px] mt-3 font-mono break-words">{extraDetail}</p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div role="alert" className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-300 text-sm font-semibold">{content.title}</p>
        <p className="text-neutral-300 text-xs mt-1">{content.description}</p>
        {content.hint && <p className="text-neutral-400 text-[11px] mt-2">{content.hint}</p>}
        {extraDetail && extraDetail !== content.description && (
          <p className="text-neutral-500 text-[11px] mt-2 font-mono break-words">{extraDetail}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
