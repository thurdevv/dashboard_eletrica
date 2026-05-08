import { pgTable, uuid, text, numeric, integer, timestamp, date, unique } from 'drizzle-orm/pg-core'

// ─── execution_records ────────────────────────────────────────
// Tabela principal de progresso por elemento BIM.
// "productivity" é coluna gerada (calculada no banco) — Drizzle não emite
// a definição GENERATED ALWAYS AS, então o cálculo fica no SQL de init.
export const executionRecords = pgTable(
  'execution_records',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    projectId:        text('project_id').notNull(),
    ifcGlobalId:      text('ifc_global_id').notNull(),
    elementName:      text('element_name'),
    elementType:      text('element_type'),
    level:            text('level'),
    status:           text('status').notNull().default('NOT_STARTED'),
    executedQuantity: numeric('executed_quantity', { mode: 'number' }).default(0),
    teamSize:         integer('team_size').default(1),
    workedHours:      numeric('worked_hours', { mode: 'number' }).default(0),
    productivity:     numeric('productivity', { mode: 'number' }),
    notes:            text('notes'),
    photoUrl:         text('photo_url'),
    elementScreenshot: text('element_screenshot'),
    elementLength:    numeric('element_length', { mode: 'number' }),
    plannedStart:     date('planned_start'),
    plannedEnd:       date('planned_end'),
    plannedQuantity:  numeric('planned_quantity', { mode: 'number' }),
    updatedBy:        text('updated_by'),
    createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqProjectElement: unique('execution_records_project_id_ifc_global_id_key')
      .on(t.projectId, t.ifcGlobalId),
  }),
)

export type ExecutionRecordRow       = typeof executionRecords.$inferSelect
export type ExecutionRecordInsertRow = typeof executionRecords.$inferInsert
