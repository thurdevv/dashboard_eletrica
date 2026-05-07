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
  created_at?:         string
}

export interface ExecutionFormData {
  status: ExecutionStatus
  executed_quantity: number
  team_size: number
  worked_hours: number
  notes: string
  photo?: File | null
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
