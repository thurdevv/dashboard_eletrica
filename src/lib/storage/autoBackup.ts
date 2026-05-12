// Auto-backup local "anti-perda": a cada N saves cria um snapshot automático
// rotacionando uma janela de retenção (ex: últimos 5). Útil para o caso clássico
// de tablet morrer no canteiro antes do usuário exportar o JSON.
//
// Usa o mesmo sistema de snapshots já existente, com nomes prefixados ("Auto:")
// para que apareçam misturados no SnapshotsModal mas sejam podáveis automaticamente.

import { createSnapshot, listSnapshots, deleteSnapshot } from './snapshots'

const COUNTER_PREFIX  = 'bim_autobackup_count_'
const SAVES_PER_BACKUP = 10            // backup a cada 10 saves
const MAX_AUTO_KEPT    = 5             // mantém os 5 mais recentes
const AUTO_PREFIX      = 'Auto: '

function counterKey(projectId: string): string {
  return `${COUNTER_PREFIX}${projectId}`
}

function readCounter(projectId: string): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(counterKey(projectId)) ?? '0', 10) || 0
}

function writeCounter(projectId: string, n: number): void {
  localStorage.setItem(counterKey(projectId), String(n))
}

function pruneAutoBackups(projectId: string): void {
  const auto = listSnapshots(projectId).filter(s => s.name.startsWith(AUTO_PREFIX))
  if (auto.length <= MAX_AUTO_KEPT) return
  // listSnapshots retorna mais novos primeiro (createSnapshot prepende).
  // Apaga os excedentes do final.
  const toDelete = auto.slice(MAX_AUTO_KEPT)
  for (const s of toDelete) deleteSnapshot(projectId, s.id)
}

// Deve ser chamada após cada save bem-sucedido em useExecution.
// Não bloqueia: roda síncrono sobre localStorage e retorna imediatamente.
export function tickAutoBackup(projectId: string): { backed: boolean; count: number } {
  if (typeof window === 'undefined') return { backed: false, count: 0 }
  const next = readCounter(projectId) + 1
  writeCounter(projectId, next)
  if (next % SAVES_PER_BACKUP !== 0) return { backed: false, count: next }
  const name = `${AUTO_PREFIX}${new Date().toLocaleString('pt-BR')}`
  createSnapshot(projectId, name, `Backup automático após ${next} salvamentos.`)
  pruneAutoBackups(projectId)
  return { backed: true, count: next }
}

export function getAutoBackupConfig() {
  return { savesPerBackup: SAVES_PER_BACKUP, maxKept: MAX_AUTO_KEPT, prefix: AUTO_PREFIX }
}
