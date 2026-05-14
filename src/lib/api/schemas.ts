import { z } from 'zod'

// Status do registro de execução — espelha ExecutionStatus em @/types.
const executionStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE'])

const checklist = z.object({
  installed:     z.boolean().optional(),
  fastened:      z.boolean().optional(),
  identified:    z.boolean().optional(),
  tested:        z.boolean().optional(),
  approved:      z.boolean().optional(),
  photoAttached: z.boolean().optional(),
}).partial().optional()

// Body do POST /api/execution. Drizzle aceita o snake_case do esquema; o cliente já
// envia neste formato. Campos opcionais ficam undefined → ignorados no insert.
export const ExecutionUpsertSchema = z.object({
  id:                z.string().uuid().optional(),
  projectId:         z.string().min(1).max(128),
  ifcGlobalId:       z.string().min(1).max(128),
  elementName:       z.string().max(512).optional().nullable(),
  elementType:       z.string().max(128).optional().nullable(),
  level:             z.string().max(128).optional().nullable(),
  status:            executionStatus,
  executedQuantity:  z.number().finite().min(0).max(1e9),
  teamSize:          z.number().int().min(0).max(10000),
  workedHours:       z.number().finite().min(0).max(10000),
  productivity:      z.number().finite().min(0).optional(),
  notes:             z.string().max(5000).optional().nullable(),
  photoUrl:          z.string().max(2_000_000).optional().nullable(),   // data URL aceita
  elementScreenshot: z.string().max(2_000_000).optional().nullable(),
  elementLength:     z.number().finite().optional().nullable(),
  plannedStart:      z.string().optional().nullable(),
  plannedEnd:        z.string().optional().nullable(),
  plannedQuantity:   z.number().finite().min(0).optional().nullable(),
  checklist:         checklist,
  updatedBy:         z.string().max(128).optional().nullable(),
}).passthrough()

export type ExecutionUpsertInput = z.infer<typeof ExecutionUpsertSchema>

// Limite de upload no /api/convert — protege contra payloads ilimitados.
// 200 MB cobre projetos elétricos comuns; ajustar se necessário.
export const MAX_IFC_UPLOAD_BYTES = 200 * 1024 * 1024
