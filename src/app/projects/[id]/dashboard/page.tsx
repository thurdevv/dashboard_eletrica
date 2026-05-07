'use client'

import { useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Activity } from 'lucide-react'
import { getProject } from '@/lib/projects'
import { getProjectRecords } from '@/lib/api/execution'
import { getAllHistory } from '@/lib/storage/extras'
import { STATUS_LABELS } from '@/types'
import type { ExecutionRecord, ExecutionHistoryEntry } from '@/types'

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: '#facc15',
  IN_PROGRESS: '#fb923c',
  COMPLETED:   '#22c55e',
  ISSUE:       '#ef4444',
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const [records, setRecords] = useState<ExecutionRecord[]>([])
  const [history, setHistory] = useState<ExecutionHistoryEntry[]>([])
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    const p = getProject(projectId)
    if (p) setProjectName(p.name)
    getProjectRecords(projectId).then(setRecords).catch(() => setRecords([]))
    setHistory(getAllHistory(projectId))
  }, [projectId])

  // ─── Agregações memoizadas ───────────────────────────────
  const stats = useMemo(() => {
    const completed  = records.filter((r) => r.status === 'COMPLETED').length
    const inProgress = records.filter((r) => r.status === 'IN_PROGRESS').length
    const issues     = records.filter((r) => r.status === 'ISSUE').length
    const notStarted = records.filter((r) => r.status === 'NOT_STARTED').length
    const total      = records.length
    const totalHours = records.reduce((s, r) => s + (r.worked_hours ?? 0), 0)
    const avgProd    = total > 0
      ? records.reduce((s, r) => s + (r.productivity ?? 0), 0) / total
      : 0
    return { completed, inProgress, issues, notStarted, total, totalHours, avgProd }
  }, [records])

  const statusData = useMemo(() => [
    { name: STATUS_LABELS.COMPLETED,    value: stats.completed,  color: STATUS_COLOR.COMPLETED },
    { name: STATUS_LABELS.IN_PROGRESS,  value: stats.inProgress, color: STATUS_COLOR.IN_PROGRESS },
    { name: STATUS_LABELS.ISSUE,        value: stats.issues,     color: STATUS_COLOR.ISSUE },
    { name: STATUS_LABELS.NOT_STARTED,  value: stats.notStarted, color: STATUS_COLOR.NOT_STARTED },
  ].filter((d) => d.value > 0), [stats])

  const byLevel = useMemo(() => {
    const acc: Record<string, { level: string; total: number; completed: number; inProgress: number; issues: number }> = {}
    for (const r of records) {
      const lv = r.level || 'Sem Pavimento'
      acc[lv] ??= { level: lv, total: 0, completed: 0, inProgress: 0, issues: 0 }
      acc[lv].total++
      if (r.status === 'COMPLETED')   acc[lv].completed++
      if (r.status === 'IN_PROGRESS') acc[lv].inProgress++
      if (r.status === 'ISSUE')       acc[lv].issues++
    }
    return Object.values(acc).sort((a, b) => a.level.localeCompare(b.level))
  }, [records])

  // Curva S — acumulado de elementos concluídos por dia (planejado vs realizado)
  const sCurve = useMemo(() => {
    const dailyCompleted: Record<string, number> = {}
    for (const h of history) {
      if (h.status !== 'COMPLETED') continue
      const day = h.changedAt.slice(0, 10)
      dailyCompleted[day] = (dailyCompleted[day] ?? 0) + 1
    }
    const dailyPlanned: Record<string, number> = {}
    for (const r of records) {
      if (!r.planned_end) continue
      const day = r.planned_end.slice(0, 10)
      dailyPlanned[day] = (dailyPlanned[day] ?? 0) + 1
    }
    const days = [...new Set([...Object.keys(dailyCompleted), ...Object.keys(dailyPlanned)])].sort()
    let accReal = 0, accPlan = 0
    return days.map((d) => {
      accReal += dailyCompleted[d] ?? 0
      accPlan += dailyPlanned[d] ?? 0
      return { date: d, Realizado: accReal, Planejado: accPlan }
    })
  }, [history, records])

  // Top 10 produtividade
  const topProd = useMemo(() => {
    return [...records]
      .filter((r) => r.productivity > 0)
      .sort((a, b) => b.productivity - a.productivity)
      .slice(0, 10)
      .map((r) => ({
        name:        (r.element_name || r.ifc_global_id).slice(0, 18),
        Produtividade: Number(r.productivity.toFixed(3)),
      }))
  }, [records])

  const issuesList = useMemo(
    () => records.filter((r) => r.status === 'ISSUE').slice(0, 10),
    [records],
  )

  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/projects/${projectId}`}
          aria-label="Voltar ao projeto"
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-gray-900 text-lg flex-1">
          Dashboard — <span className="text-blue-600">{projectName}</span>
        </h1>
        <span className="text-xs text-gray-500">{stats.total} registros · {stats.totalHours.toFixed(1)}h totais</span>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Cards-resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Concluído"     value={`${completionPct}%`}      icon={<CheckCircle2 className="w-5 h-5" />} color="green"  />
          <KpiCard label="Em Execução"   value={stats.inProgress}         icon={<Clock className="w-5 h-5" />}        color="orange" />
          <KpiCard label="Problemas"     value={stats.issues}             icon={<AlertTriangle className="w-5 h-5" />} color="red"    />
          <KpiCard label="Produtividade" value={stats.avgProd.toFixed(2)} icon={<Activity className="w-5 h-5" />}      color="blue"   />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status pie */}
          <Card title="Distribuição por Status">
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Por pavimento */}
          <Card title="Status por Pavimento">
            {byLevel.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byLevel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed"  name="Concluídos"   stackId="a" fill={STATUS_COLOR.COMPLETED} />
                  <Bar dataKey="inProgress" name="Em Execução"  stackId="a" fill={STATUS_COLOR.IN_PROGRESS} />
                  <Bar dataKey="issues"     name="Problemas"    stackId="a" fill={STATUS_COLOR.ISSUE} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Curva S */}
        <Card title="Curva S — Planejado vs Realizado">
          {sCurve.length === 0 ? <Empty hint="Adicione datas de planejamento aos elementos para ver a curva." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Planejado" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Realizado" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top produtividade */}
          <Card title="Top 10 — Produtividade">
            {topProd.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProd} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="Produtividade" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Lista de problemas */}
          <Card title={`Problemas (${stats.issues})`}>
            {issuesList.length === 0
              ? <Empty hint="Nenhum problema registrado." />
              : (
                <ul className="divide-y divide-gray-100 max-h-[300px] overflow-auto">
                  {issuesList.map((r) => (
                    <li key={r.ifc_global_id} className="py-2 px-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">{r.element_name}</p>
                      <p className="text-xs text-gray-500">{r.element_type} · {r.level || 'sem pavimento'}</p>
                      {r.notes && <p className="text-xs text-red-600 mt-1 italic">{r.notes}</p>}
                    </li>
                  ))}
                </ul>
              )
            }
          </Card>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, color }:
  { label: string; value: string | number; icon: React.ReactNode; color: 'green' | 'orange' | 'red' | 'blue' }) {
  const colorMap = {
    green:  'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-800 text-sm mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ hint }: { hint?: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
      {hint ?? 'Sem dados ainda.'}
    </div>
  )
}
