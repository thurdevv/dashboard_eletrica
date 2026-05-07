/**
 * Mini-i18n leve, sem mudanças de routing.
 * Locale guardada em localStorage; default = pt-BR.
 *
 * Para ativar locale-routing completo via next-intl, basta promover este
 * helper a um Provider e wireá-lo no layout root.
 */

import ptBR from '@/messages/pt-BR.json'
import en from '@/messages/en.json'

export type Locale = 'pt-BR' | 'en'
export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en']
export const DEFAULT_LOCALE: Locale = 'pt-BR'

const dictionaries = { 'pt-BR': ptBR, en } as const

const LOCALE_KEY = 'bim_locale'

export function getLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const raw = localStorage.getItem(LOCALE_KEY) as Locale | null
  return raw && SUPPORTED_LOCALES.includes(raw) ? raw : DEFAULT_LOCALE
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCALE_KEY, locale)
}

/**
 * Lê uma chave em dot-notation: t('panel.info').
 * Cai no DEFAULT_LOCALE se a chave não existir, e retorna a própria chave
 * como último recurso (assim a UI nunca quebra silenciosamente).
 */
export function t(path: string, locale: Locale = getLocale()): string {
  const parts = path.split('.')
  const tryDict = (dict: any): string | undefined => {
    let cur: any = dict
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p]
      else return undefined
    }
    return typeof cur === 'string' ? cur : undefined
  }
  return tryDict(dictionaries[locale]) ?? tryDict(dictionaries[DEFAULT_LOCALE]) ?? path
}
