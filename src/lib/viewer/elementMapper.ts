import type { IFCElement } from '@/types'

export interface MetaProperty {
  name:  string
  value: any
  type:  string
}

export interface MetaObject {
  id:              string
  name:            string
  type:            string
  children?:       string[]
  metaProperties?: MetaProperty[]
  parent?:         MetaObject | null
}

// Maps globalId → objectId  (built from metaScene.metaObjects, NOT scene.objects)
export function buildGlobalIdMap(
  metaObjects: Record<string, MetaObject>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const [objectId, meta] of Object.entries(metaObjects)) {
    // In xeokit, metaObject.id == objectId == IFC GlobalId
    map.set(meta.id, objectId)
  }
  return map
}

export function buildReverseMap(
  globalIdMap: Map<string, string>,
): Map<string, string> {
  const reverse = new Map<string, string>()
  for (const [globalId, objectId] of globalIdMap.entries()) {
    reverse.set(objectId, globalId)
  }
  return reverse
}

// IFC length property names (case-insensitive) to look for
const LENGTH_PROP_NAMES = new Set([
  'length', 'comprimento', 'nominallength', 'netlength', 'grosslength',
  'overalllength', 'span', 'height', 'depth',
])

function extractLengthAndProps(meta: MetaObject | undefined): {
  length?: number
  properties?: Record<string, string>
} {
  if (!meta?.metaProperties?.length) return {}

  const properties: Record<string, string> = {}
  let length: number | undefined

  for (const prop of meta.metaProperties) {
    const val = prop.value
    if (val === null || val === undefined || val === '') continue
    properties[prop.name] = String(val)

    if (!length && LENGTH_PROP_NAMES.has(prop.name.toLowerCase())) {
      const num = parseFloat(String(val))
      if (!isNaN(num) && num > 0) length = num
    }
  }

  return { length, properties: Object.keys(properties).length ? properties : undefined }
}

export function extractIFCElement(
  objectId:       string,
  sceneObjects:   Record<string, any>,
  levelByGlobalId: Map<string, string>,
  reverseMap:     Map<string, string>,
  metaObjects?:   Record<string, MetaObject>,
): IFCElement | null {
  if (!sceneObjects[objectId]) return null

  // objectId IS the GlobalId in xeokit/IFC models
  const globalId = reverseMap.get(objectId) ?? objectId
  const meta     = metaObjects?.[objectId] ?? metaObjects?.[globalId]

  const { length, properties } = extractLengthAndProps(meta)

  return {
    globalId,
    name:  meta?.name ?? globalId,
    type:  meta?.type ?? 'Unknown',
    level: levelByGlobalId.get(globalId) ?? '',
    objectId,
    length,
    properties,
  }
}

/**
 * Build a map of GlobalId → storey name by walking each element's parent chain.
 * xeokit MetaObject.parent is a MetaObject reference (not a string ID), so we
 * traverse upward until we find an IfcBuildingStorey.
 */
export function buildLevelMap(
  metaScene: { metaObjects: Record<string, any> },
): Map<string, string> {
  const levelMap = new Map<string, string>()

  function findStorey(node: any): string | null {
    if (!node) return null
    if (node.type === 'IfcBuildingStorey') return node.name
    return findStorey(node.parent ?? null)
  }

  for (const meta of Object.values(metaScene.metaObjects) as any[]) {
    if (meta.type === 'IfcBuildingStorey') continue
    const storey = findStorey(meta.parent ?? null)
    if (storey) levelMap.set(meta.id, storey)
  }

  return levelMap
}
