// Prefixos centralizados de localStorage. Importar daqui em todo lugar
// para evitar drift entre módulos que persistem os mesmos dados.

export const EXEC_PREFIX        = 'bim_exec'      // bim_exec_{projectId}_{globalId}
export const DAILY_PREFIX       = 'bim_daily'     // bim_daily_{projectId}_{globalId}
export const HISTORY_PREFIX     = 'bim_history'   // bim_history_{projectId}_{globalId}
export const COMMENTS_PREFIX    = 'bim_comments'  // bim_comments_{projectId}
export const ANNOTATIONS_PREFIX = 'bim_annot3d'   // bim_annot3d_{projectId}
export const SCHEDULE_PREFIX    = 'bim_schedule'  // bim_schedule_{projectId}

export const USERS_KEY          = 'bim_users'
export const SESSION_KEY        = 'bim_session'
