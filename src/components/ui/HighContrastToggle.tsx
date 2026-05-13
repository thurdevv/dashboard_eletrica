'use client'

import { Sun, SunMedium } from 'lucide-react'
import { useHighContrast } from '@/hooks/useHighContrast'

/**
 * Botão pequeno no header que liga/desliga o modo alto contraste.
 * Mostra um ícone diferente conforme o estado para feedback rápido.
 */
export default function HighContrastToggle() {
  const { enabled, toggle } = useHighContrast()

  return (
    <button
      onClick={toggle}
      type="button"
      title={enabled ? 'Desativar modo anti-sol' : 'Ativar modo anti-sol (alto contraste)'}
      aria-label={enabled ? 'Desativar modo anti-sol' : 'Ativar modo anti-sol'}
      aria-pressed={enabled}
      className={`p-1.5 rounded-lg transition-colors
        ${enabled
          ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
          : 'text-neutral-400 hover:text-white hover:bg-neutral-700'}`}
    >
      {enabled
        ? <Sun       className="w-4 h-4" />
        : <SunMedium className="w-4 h-4" />}
    </button>
  )
}
