import { describe, it, expect, beforeEach } from 'vitest'
import {
  getComments, addComment, deleteComment,
  getAnnotations, addAnnotation, deleteAnnotation,
  getScheduledTasks, addScheduledTask,
  appendHistory, getHistory,
} from './extras'
import type { ExecutionRecord } from '@/types'

const PROJECT_ID = 'p1'
const GLOBAL_ID  = 'g1'

beforeEach(() => {
  localStorage.clear()
})

describe('comments', () => {
  it('add → get → delete fluxo completo', () => {
    addComment(PROJECT_ID, GLOBAL_ID, 'alice', 'first')
    addComment(PROJECT_ID, GLOBAL_ID, 'bob',   'second')
    const list = getComments(PROJECT_ID, GLOBAL_ID)
    expect(list).toHaveLength(2)
    expect(list[0].author).toBe('alice')
    deleteComment(PROJECT_ID, list[0].id)
    expect(getComments(PROJECT_ID, GLOBAL_ID)).toHaveLength(1)
  })

  it('só retorna comentários do mesmo elemento', () => {
    addComment(PROJECT_ID, GLOBAL_ID,    'a', 'x')
    addComment(PROJECT_ID, 'outro_elem', 'b', 'y')
    expect(getComments(PROJECT_ID, GLOBAL_ID)).toHaveLength(1)
  })
})

describe('annotations', () => {
  it('cria com status default OPEN', () => {
    const a = addAnnotation(PROJECT_ID, {
      title: 'rasgo errado', description: '', x: 1, y: 2, z: 3, createdBy: 'tester',
    })
    expect(a.status).toBe('OPEN')
    expect(getAnnotations(PROJECT_ID)).toHaveLength(1)
    deleteAnnotation(PROJECT_ID, a.id)
    expect(getAnnotations(PROJECT_ID)).toHaveLength(0)
  })
})

describe('scheduled tasks', () => {
  it('ordena por plannedStart', () => {
    addScheduledTask(PROJECT_ID, { title: 'B', description: '', plannedStart: '2026-02-01', plannedEnd: '2026-02-10' })
    addScheduledTask(PROJECT_ID, { title: 'A', description: '', plannedStart: '2026-01-01', plannedEnd: '2026-01-10' })
    const list = getScheduledTasks(PROJECT_ID)
    expect(list[0].title).toBe('A')
    expect(list[1].title).toBe('B')
  })
})

describe('history (audit log)', () => {
  function makeRec(over: Partial<ExecutionRecord> = {}): ExecutionRecord {
    return {
      project_id:        PROJECT_ID,
      ifc_global_id:     GLOBAL_ID,
      element_name:      'cabo',
      element_type:      'IfcCableSegment',
      level:             'L1',
      status:            'NOT_STARTED',
      executed_quantity: 0,
      team_size:         1,
      worked_hours:      0,
      productivity:      0,
      notes:             '',
      ...over,
    }
  }

  it('grava entry com diff', () => {
    const prev = makeRec({ status: 'NOT_STARTED', executed_quantity: 0 })
    const next = makeRec({ status: 'IN_PROGRESS', executed_quantity: 5 })
    appendHistory(PROJECT_ID, GLOBAL_ID, 'alice', next, prev)
    const hist = getHistory(PROJECT_ID, GLOBAL_ID)
    expect(hist).toHaveLength(1)
    expect(hist[0].changedBy).toBe('alice')
    expect(hist[0].changes).toMatchObject({
      status:            { from: 'NOT_STARTED', to: 'IN_PROGRESS' },
      executed_quantity: { from: 0,             to: 5 },
    })
  })

  it('não grava se nada relevante mudou', () => {
    const rec = makeRec()
    appendHistory(PROJECT_ID, GLOBAL_ID, 'alice', rec, rec)
    expect(getHistory(PROJECT_ID, GLOBAL_ID)).toHaveLength(0)
  })

  it('grava registro inicial sem prev', () => {
    appendHistory(PROJECT_ID, GLOBAL_ID, 'alice', makeRec())
    expect(getHistory(PROJECT_ID, GLOBAL_ID)).toHaveLength(1)
  })
})
