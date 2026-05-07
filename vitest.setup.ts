import '@testing-library/jest-dom/vitest'

// jsdom não implementa crypto.randomUUID em versões antigas
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID === 'undefined') {
  // @ts-expect-error mutável em ambiente de testes
  globalThis.crypto = globalThis.crypto ?? {}
  // @ts-expect-error mutável em ambiente de testes
  globalThis.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
}
