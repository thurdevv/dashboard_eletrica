'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'bim:high-contrast'
const ROOT_CLASS  = 'high-contrast'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

/**
 * Toggle persistente para o **modo alto contraste / anti-sol**.
 *
 * Aplica a classe `high-contrast` em `<html>` para que estilos globais
 * em `app/globals.css` possam aumentar contraste, peso e brilho —
 * essencial para usar o app sob luz direta na obra.
 *
 * A preferência é salva em `localStorage` por dispositivo (cada
 * smartphone/tablet pode ter ajuste independente).
 */
export function useHighContrast(): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState<boolean>(readInitial)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (enabled) root.classList.add(ROOT_CLASS)
    else         root.classList.remove(ROOT_CLASS)
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  }, [enabled])

  const toggle = useCallback(() => setEnabled((v) => !v), [])

  return { enabled, toggle }
}
