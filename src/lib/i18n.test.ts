import { describe, it, expect } from 'vitest'
import { t } from './i18n'

describe('i18n.t', () => {
  it('retorna a string traduzida em pt-BR', () => {
    expect(t('common.save', 'pt-BR')).toBe('Salvar')
    expect(t('status.COMPLETED', 'pt-BR')).toBe('Concluído')
  })

  it('retorna a string traduzida em en', () => {
    expect(t('common.save', 'en')).toBe('Save')
  })

  it('cai em pt-BR se a chave não existir em en', () => {
    expect(t('panel.info', 'en')).toBe('Info')
  })

  it('retorna a própria chave se ela não existir em nenhum dicionário', () => {
    expect(t('inexistente.chave.qualquer', 'pt-BR')).toBe('inexistente.chave.qualquer')
  })
})
