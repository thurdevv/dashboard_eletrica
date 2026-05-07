import { describe, it, expect } from 'vitest'
import { buildGlobalIdMap, buildReverseMap, suggestQuantityFromProps } from './elementMapper'
import type { MetaObject } from './elementMapper'

describe('elementMapper', () => {
  it('buildGlobalIdMap maps id → objectId', () => {
    const meta: Record<string, MetaObject> = {
      objA: { id: 'gid_a', name: 'A', type: 'IfcWall' },
      objB: { id: 'gid_b', name: 'B', type: 'IfcWall' },
    }
    const map = buildGlobalIdMap(meta)
    expect(map.get('gid_a')).toBe('objA')
    expect(map.get('gid_b')).toBe('objB')
  })

  it('buildReverseMap inverts the mapping', () => {
    const map = new Map([['gid_a', 'objA'], ['gid_b', 'objB']])
    const reverse = buildReverseMap(map)
    expect(reverse.get('objA')).toBe('gid_a')
    expect(reverse.get('objB')).toBe('gid_b')
  })

  it('suggestQuantityFromProps prefers length over count', () => {
    expect(suggestQuantityFromProps({ length: 5, count: 3 })).toEqual({ value: 5, unit: 'm' })
    expect(suggestQuantityFromProps({ count: 7 })).toEqual({ value: 7, unit: 'un' })
    expect(suggestQuantityFromProps({ area: 12 })).toEqual({ value: 12, unit: 'm²' })
    expect(suggestQuantityFromProps({})).toBeUndefined()
  })
})
