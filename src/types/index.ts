export type ExecutionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUE'

export interface DailyEntry {
  id:      string
  date:    string    // YYYY-MM-DD
  meters:  number
  notes:   string
  savedAt: string
}

export interface IFCElement {
  globalId:    string
  name:        string
  type:        string
  level:       string
  objectId?:   string
  screenshot?: string    // data URL capturada do canvas no momento da seleção
  length?:     number    // comprimento extraído das propriedades IFC
  properties?: Record<string, string>   // propriedades IFC relevantes para exibição
}

export interface Project {
  id:          string
  name:        string
  description: string
  createdAt:   string
  modelName?:  string
}

export interface AppUser {
  id:        string
  username:  string
  password:  string
  createdAt: string
}

export interface ExecutionRecord {
  id?: string
  project_id: string
  ifc_global_id: string
  element_name: string
  element_type: string
  level: string
  status: ExecutionStatus
  executed_quantity: number
  team_size: number
  worked_hours: number
  productivity: number
  notes: string
  photo_url?:          string
  element_screenshot?: string   // data URL do canvas xeokit quando elemento foi selecionado
  element_length?:     number   // comprimento do elemento (IFC)
  daily_log?:          DailyEntry[]
  planned_start?:      string   // YYYY-MM-DD — data prevista de início
  planned_end?:        string   // YYYY-MM-DD — data prevista de término
  planned_quantity?:   number   // quantitativo planejado (para curva S)
  created_at?:         string
  updated_at?:         string
  updated_by?:         string   // username da última edição
}

// ─── Comments ─────────────────────────────────────────────────
export interface ElementComment {
  id:          string
  project_id:  string
  globalId:    string
  author:      string
  text:        string
  createdAt:   string
}

// ─── 3D Annotations (BCF-like) ────────────────────────────────
export interface Annotation3D {
  id:          string
  project_id:  string
  title:       string
  description: string
  x:           number
  y:           number
  z:           number
  globalId?:   string   // elemento associado (opcional)
  photo_url?:  string
  status:      'OPEN' | 'IN_REVIEW' | 'RESOLVED'
  createdBy:   string
  createdAt:   string
}

// ─── Scheduled tasks (cronograma) ─────────────────────────────
export interface ScheduledTask {
  id:          string
  project_id:  string
  title:       string
  description: string
  level?:      string         // pavimento alvo
  elementType?: string        // tipo IFC alvo
  globalIds?:  string[]       // elementos específicos
  plannedStart: string        // YYYY-MM-DD
  plannedEnd:   string
  status:      ExecutionStatus
  createdAt:   string
}

// ─── Audit log de execução ────────────────────────────────────
export interface ExecutionHistoryEntry {
  id:           string
  project_id:   string
  globalId:     string
  changedAt:    string
  changedBy:    string
  // snapshot dos campos relevantes ao momento da mudança
  status:       ExecutionStatus
  executed_quantity: number
  team_size:    number
  worked_hours: number
  notes:        string
  // diff opcional contra o snapshot anterior, p/ exibição
  changes?:     Record<string, { from: unknown; to: unknown }>
}

export interface ExecutionFormData {
  status: ExecutionStatus
  executed_quantity: number
  team_size: number
  worked_hours: number
  notes: string
  photo?: File | null
  planned_start?: string
  planned_end?: string
  planned_quantity?: number
}

export interface FilterState {
  status: ExecutionStatus | 'ALL'
  level: string
  elementType: string
}

export interface LoadedModel {
  type:          'xkt' | 'ifc'
  url:           string
  metaUrl?:      string
  name:          string
  data?:         ArrayBuffer   // dados binários do modelo
  metaData?:     ArrayBuffer   // dados binários do JSON de metadados (XKT)
  progressData?: string        // JSON de progresso embutido no ZIP (se houver)
}

export interface ColorMap {
  NOT_STARTED: [number, number, number, number]
  IN_PROGRESS:  [number, number, number, number]
  COMPLETED:    [number, number, number, number]
  ISSUE:        [number, number, number, number]
}

export const STATUS_COLORS: ColorMap = {
  NOT_STARTED: [1, 0.85, 0, 1],
  IN_PROGRESS:  [1, 0.5, 0, 1],
  COMPLETED:    [0.2, 0.75, 0.2, 1],
  ISSUE:        [0.9, 0.2, 0.2, 1],
}

export const STATUS_LABELS: Record<ExecutionStatus, string> = {
  NOT_STARTED: 'Não Iniciado',
  IN_PROGRESS:  'Em Execução',
  COMPLETED:    'Concluído',
  ISSUE:        'Problema',
}

export const STATUS_BADGE_CLASS: Record<ExecutionStatus, string> = {
  NOT_STARTED: 'bg-gray-200 text-gray-700',
  IN_PROGRESS:  'bg-yellow-200 text-yellow-800',
  COMPLETED:    'bg-green-200 text-green-800',
  ISSUE:        'bg-red-200 text-red-800',
}
