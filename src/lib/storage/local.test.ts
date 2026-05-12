import { describe, it, expect, beforeEach } from 'vitest'
import {
  localGet, localGetAll, localUpsert,
  localGetLevels, localGetElementTypes,
  localAddDailyEntry, localGetDailyLog, localDeleteDailyEntry,
  localExport, localImport, localClear,
} from './local'
import type { IFCElement, ExecutionFormData } from '@/types'

const PROJECT = 'proj1'

function makeElement(globalId: string, opts: Partial<IFCElement> = {}): IFCElement {
  return {
    globalId,
    name:  opts.name  ?? `Elem-${globalId}`,
    type:  opts.type  ?? 'IfcCableSegment',
    level: opts.level ?? 'Pav1',
    ...opts,
  }
}

function makeForm(over: Partial<ExecutionFormData> = {}): ExecutionFormData {
  return {
    status: 'IN_PROGRESS',
    executed_quantity: 10,
    team_size: 2,
    worked_hours: 4,
    notes: '',
    photo: null,
    ...over,
  }
}

beforeEach(() => { localStorage.clear() })

describe('localUpsert + localGet', () => {
  it('cria registro novo e lê de volta', () => {
    const el = makeElement('g1')
    const r  = localUpsert(PROJECT, el, makeForm())
    expect(r.ifc_global_id).toBe('g1')
    expect(r.status).toBe('IN_PROGRESS')

    const got = localGet(PROJECT, 'g1')
    expect(got?.executed_quantity).toBe(10)
    expect(got?.productivity).toBeCloseTo(10 / (2 * 4), 5)
  })

  it('atualiza registro existente preservando created_at', () => {
    const el  = makeElement('g1')
    const a   = localUpsert(PROJECT, el, makeForm({ executed_quantity: 5 }))
    const b   = localUpsert(PROJECT, el, makeForm({ executed_quantity: 15, status: 'COMPLETED' }))
    expect(b.id).toBe(a.id)
    expect(b.created_at).toBe(a.created_at)
    expect(b.status).toBe('COMPLETED')
    expect(b.executed_quantity).toBe(15)
  })

  it('produtividade 0 quando equipe ou horas = 0', () => {
    const r = localUpsert(PROJECT, makeElement('g1'), makeForm({ team_size: 0, worked_hours: 4 }))
    expect(r.productivity).toBe(0)
  })

  it('grava updated_by passado pelo caller', () => {
    const r = localUpsert(PROJECT, makeElement('g1'), makeForm(), undefined, 'alice')
    expect(r.updated_by).toBe('alice')
  })
})

describe('localGetAll + filtros', () => {
  beforeEach(() => {
    localUpsert(PROJECT, makeElement('a', { level: 'Pav1', type: 'IfcCableSegment' }), makeForm({ status: 'COMPLETED' }))
    localUpsert(PROJECT, makeElement('b', { level: 'Pav2', type: 'IfcCableSegment' }), makeForm({ status: 'IN_PROGRESS' }))
    localUpsert(PROJECT, makeElement('c', { level: 'Pav1', type: 'IfcDuctSegment'  }), makeForm({ status: 'ISSUE' }))
  })

  it('sem filtros, retorna todos', () => {
    expect(localGetAll(PROJECT)).toHaveLength(3)
  })

  it('filtra por status', () => {
    expect(localGetAll(PROJECT, { status: 'COMPLETED' })).toHaveLength(1)
    expect(localGetAll(PROJECT, { status: 'ALL'       })).toHaveLength(3)
  })

  it('filtra por level', () => {
    expect(localGetAll(PROJECT, { level: 'Pav1' })).toHaveLength(2)
  })

  it('filtra por elementType', () => {
    expect(localGetAll(PROJECT, { elementType: 'IfcDuctSegment' })).toHaveLength(1)
  })

  it('combina múltiplos filtros', () => {
    expect(localGetAll(PROJECT, { level: 'Pav1', status: 'COMPLETED' })).toHaveLength(1)
  })
})

describe('localGetLevels / localGetElementTypes', () => {
  it('retorna valores únicos ordenados', () => {
    localUpsert(PROJECT, makeElement('a', { level: 'Pav3' }), makeForm())
    localUpsert(PROJECT, makeElement('b', { level: 'Pav1' }), makeForm())
    localUpsert(PROJECT, makeElement('c', { level: 'Pav1' }), makeForm())
    expect(localGetLevels(PROJECT)).toEqual(['Pav1', 'Pav3'])
  })

  it('ignora valores vazios', () => {
    localUpsert(PROJECT, makeElement('a', { level: 'Pav1' }), makeForm())
    localUpsert(PROJECT, makeElement('b', { level: '' }),     makeForm())
    expect(localGetLevels(PROJECT)).toEqual(['Pav1'])
  })
})

describe('daily log CRUD', () => {
  it('adiciona, lista e deleta entradas ordenando por data', () => {
    localAddDailyEntry(PROJECT, 'g1', 5, '2026-05-03', 'manhã')
    localAddDailyEntry(PROJECT, 'g1', 7, '2026-05-01', 'início')
    localAddDailyEntry(PROJECT, 'g1', 3, '2026-05-02', '')
    const log = localGetDailyLog(PROJECT, 'g1')
    expect(log).toHaveLength(3)
    expect(log.map(e => e.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])

    const after = localDeleteDailyEntry(PROJECT, 'g1', log[1].id)
    expect(after).toHaveLength(2)
  })

  it('isola entries por globalId', () => {
    localAddDailyEntry(PROJECT, 'g1', 5, '2026-05-01', '')
    localAddDailyEntry(PROJECT, 'g2', 8, '2026-05-01', '')
    expect(localGetDailyLog(PROJECT, 'g1')).toHaveLength(1)
    expect(localGetDailyLog(PROJECT, 'g2')).toHaveLength(1)
  })
})

describe('export / import / clear', () => {
  it('export → clear → import faz roundtrip', () => {
    localUpsert(PROJECT, makeElement('a'), makeForm())
    localUpsert(PROJECT, makeElement('b'), makeForm({ status: 'COMPLETED' }))
    const json = localExport(PROJECT)
    localClear(PROJECT)
    expect(localGetAll(PROJECT)).toHaveLength(0)

    const count = localImport(PROJECT, json)
    expect(count).toBe(2)
    expect(localGetAll(PROJECT)).toHaveLength(2)
  })

  it('localClear remove só os registros do projeto', () => {
    localUpsert('p1', makeElement('a'), makeForm())
    localUpsert('p2', makeElement('a'), makeForm())
    localClear('p1')
    expect(localGetAll('p1')).toHaveLength(0)
    expect(localGetAll('p2')).toHaveLength(1)
  })
})
