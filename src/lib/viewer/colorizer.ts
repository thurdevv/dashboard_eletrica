import type { ExecutionRecord, ExecutionStatus } from '@/types'
import { STATUS_COLORS } from '@/types'

interface XeokitViewer {
  scene: {
    objects: Record<string, XeokitObject>
  }
}

interface XeokitObject {
  colorize: [number, number, number, number]
  opacity: number
  highlighted: boolean
  selected: boolean
  visible: boolean
  xrayed: boolean
}

// Map: ifc_global_id → xeokit object id
// Built after model loads by iterating scene.objects and reading globalId metadata
type GlobalIdMap = Map<string, string>

// ─── Apply status colors and visibility filter ────────────────
export function colorizeByStatus(
  viewer: XeokitViewer,
  records: ExecutionRecord[],
  globalIdMap: GlobalIdMap,
  filterStatus?: string,
): void {
  const isFiltered = !!filterStatus && filterStatus !== 'ALL'

  // Pre-build set of objectIds that match the current filter
  const matchingIds = isFiltered
    ? new Set(records.map(r => globalIdMap.get(r.ifc_global_id)).filter((id): id is string => !!id))
    : null

  const [nr, ng, nb, na] = STATUS_COLORS.NOT_STARTED

  // First pass: set visibility and base color for all objects
  for (const obj of Object.values(viewer.scene.objects) as XeokitObject[]) {
    if (isFiltered) {
      obj.visible = false   // hide everything; matching elements shown below
    } else {
      obj.visible  = true
      obj.colorize = [nr, ng, nb, na]
      obj.opacity  = 1
    }
  }

  // Second pass: show and colorize elements that have records
  for (const record of records) {
    const objectId = globalIdMap.get(record.ifc_global_id)
    if (!objectId) continue
    const obj = viewer.scene.objects[objectId]
    if (!obj) continue
    obj.visible = true
    applyStatusColor(obj, record.status)
  }
}

// ─── Apply color to a single object ──────────────────────────
export function applyStatusColor(
  obj: XeokitObject,
  status: ExecutionStatus,
): void {
  const [r, g, b, a] = STATUS_COLORS[status]
  obj.colorize = [r, g, b, a]
  obj.opacity = 1
}

// ─── Reset an object to default (white, full opacity) ────────
export function resetObjectColor(obj: XeokitObject): void {
  obj.colorize = [1, 1, 1, 1]
  obj.opacity = 1
}

// ─── Highlight selected object ────────────────────────────────
export function highlightObject(
  viewer: XeokitViewer,
  objectId: string,
  previousId?: string,
): void {
  // clear previous highlight
  if (previousId) {
    const prev = viewer.scene.objects[previousId]
    if (prev) prev.highlighted = false
  }

  const obj = viewer.scene.objects[objectId]
  if (obj) obj.highlighted = true
}

// ─── Isolate objects by level ─────────────────────────────────
export function isolateByLevel(
  viewer: XeokitViewer,
  level: string,
  globalIdMap: GlobalIdMap,
  levelByGlobalId: Map<string, string>,
): void {
  for (const [globalId, objectId] of globalIdMap.entries()) {
    const obj = viewer.scene.objects[objectId]
    if (!obj) continue
    obj.visible = levelByGlobalId.get(globalId) === level
  }
}

// ─── Show all objects ─────────────────────────────────────────
export function showAll(viewer: XeokitViewer): void {
  for (const obj of Object.values(viewer.scene.objects)) {
    obj.visible = true
  }
}
