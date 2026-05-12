'use client'

import { useEffect, useState } from 'react'
import { Languages } from 'lucide-react'
import { getLocale, setLocale, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'

const LABELS: Record<Locale, string> = {
  'pt-BR': 'PT',
  'en':    'EN',
}

// Switcher mínimo: troca o locale guardado em localStorage e força reload.
// Funciona como "feature flag visível" enquanto as strings hardcoded migram
// progressivamente para t() — adicionar uma string ao messages/*.json e trocar
// em um componente é suficiente para começar a aparecer aqui.
export default function LocaleSwitcher() {
  const [current, setCurrent] = useState<Locale>('pt-BR')

  useEffect(() => { setCurrent(getLocale()) }, [])

  function handleChange(loc: Locale) {
    if (loc === current) return
    setLocale(loc)
    window.location.reload()
  }

  return (
    <div className="inline-flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-lg p-0.5">
      <Languages className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          aria-pressed={current === loc}
          className={`text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors
            ${current === loc
              ? 'bg-blue-600 text-white'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-700'}`}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  )
}
