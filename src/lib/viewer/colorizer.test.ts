import { describe, it, expect } from 'vitest'
import { applyStatusColor, resetObjectColor, isolateByLevel, showAll } from './colorizer'
import { STATUS_COLORS } from '@/types'

function fakeObj() {
  return {
    colorize: [1, 1, 1, 1] as [number, number, number, number],
    opacity: 1, highlighted: false, selected: false, visible: true, xrayed: false,
  }
}

describe('colorizer', () => {
  it('applyStatusColor sets the right color for each status', () => {
    const obj = fakeObj()
    applyStatusColor(obj as any, 'COMPLETED')
    expect(obj.colorize).toEqual(STATUS_COLORS.COMPLETED)
    applyStatusColor(obj as any, 'ISSUE')
    expect(obj.colorize).toEqual(STATUS_COLORS.ISSUE)
  })

  it('resetObjectColor restores white', () => {
    const obj = fakeObj()
    obj.colorize = [0, 0, 0, 1]
    resetObjectColor(obj as any)
    expect(obj.colorize).toEqual([1, 1, 1, 1])
  })

  it('isolateByLevel hides objects not on target level', () => {
    const a = fakeObj(), b = fakeObj()
    const viewer = { scene: { objects: { a, b } } }
    const globalIdMap = new Map([['gid_a', 'a'], ['gid_b', 'b']])
    const levelMap    = new Map([['gid_a', 'L1'], ['gid_b', 'L2']])
    isolateByLevel(viewer as any, 'L1', globalIdMap, levelMap)
    expect(a.visible).toBe(true)
    expect(b.visible).toBe(false)
  })

  it('showAll makes everything visible', () => {
    const a = fakeObj(), b = fakeObj()
    a.visible = false
    b.visible = false
    showAll({ scene: { objects: { a, b } } } as any)
    expect(a.visible).toBe(true)
    expect(b.visible).toBe(true)
  })
})
