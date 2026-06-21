'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemo, useState } from 'react'
import {
  History,
  Bomb,
  Activity,
  Skull,
  Flame,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
} from 'lucide-react'
import type { AnomalyHistoryEntry, AnomalyType } from '@/lib/chaos-types'
import { SERVICE_NAMES, ANOMALY_LABELS, ANOMALY_COLORS } from '@/lib/chaos-types'

interface Props {
  entries: AnomalyHistoryEntry[]
}

const ANOMALY_ICONS: Record<AnomalyType, React.ReactNode> = {
  '500_ERROR': <Bomb className="size-3" />,
  LATENCY_SPIKE: <Activity className="size-3" />,
  SERVICE_CRASH: <Skull className="size-3" />,
  NETWORK_PARTITION: <Flame className="size-3" />,
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatTimeOfDay(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export function AnomalyTimeline({ entries }: Props) {
  const [serviceFilter, setServiceFilter] = useState<string>('ALL')
  const [showResolvedOnly, setShowResolvedOnly] = useState(false)

  const filtered = useMemo(() => {
    return entries
      .filter((e) => serviceFilter === 'ALL' || e.serviceName === serviceFilter)
      .filter((e) => !showResolvedOnly || e.resolvedAt !== null)
      .slice()
      .reverse() // newest first
  }, [entries, serviceFilter, showResolvedOnly])

  const stats = useMemo(() => {
    const total = entries.length
    const resolved = entries.filter((e) => e.resolvedAt !== null).length
    const avgRecovery =
      resolved > 0
        ? entries.reduce(
            (sum, e) => sum + (e.recoveryTimeMs || 0),
            0
          ) / resolved
        : 0
    return { total, resolved, avgRecovery }
  }, [entries])

  return (
    <Card className="bg-[#0d1220] border-white/5 h-[420px] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
          <History className="size-4 text-purple-400" />
          Anomaly History Timeline
          <Badge variant="outline" className="text-[10px] ml-auto text-gray-500 border-white/10">
            {stats.total} total
          </Badge>
        </CardTitle>
        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
          <div className="bg-white/3 rounded px-2 py-1.5">
            <div className="text-gray-500">Total</div>
            <div className="text-white font-mono text-sm">{stats.total}</div>
          </div>
          <div className="bg-white/3 rounded px-2 py-1.5">
            <div className="text-gray-500">Resolved</div>
            <div className="text-emerald-400 font-mono text-sm">{stats.resolved}</div>
          </div>
          <div className="bg-white/3 rounded px-2 py-1.5">
            <div className="text-gray-500">Avg Recovery</div>
            <div className="text-orange-400 font-mono text-sm">
              {stats.avgRecovery > 0 ? formatDuration(stats.avgRecovery) : '--'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Filter className="size-3 text-gray-500" />
          <button
            onClick={() => setServiceFilter('ALL')}
            className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
              serviceFilter === 'ALL'
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            All
          </button>
          {SERVICE_NAMES.map((n) => (
            <button
              key={n}
              onClick={() => setServiceFilter(n)}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-all truncate max-w-[100px] ${
                serviceFilter === n
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {n.replace('Service', '')}
            </button>
          ))}
          <button
            onClick={() => setShowResolvedOnly(!showResolvedOnly)}
            className={`text-[10px] px-2 py-0.5 rounded-md transition-all ml-auto flex items-center gap-1 ${
              showResolvedOnly
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="size-3" /> Resolved only
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto px-4 pb-4 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-gray-600 text-center py-8 text-xs">
              <AlertCircle className="size-6 mx-auto mb-2 opacity-30" />
              No anomalies match the current filters
            </div>
          ) : (
            <div className="relative pl-6 py-2">
              {/* Vertical timeline line */}
              <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-orange-500/30 via-white/10 to-transparent" />
              <AnimatePresence initial={false}>
                {filtered.slice(0, 60).map((entry, i) => {
                  const isResolved = entry.resolvedAt !== null
                  const color = ANOMALY_COLORS[entry.type]
                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: -10, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.3, delay: i * 0.01 }}
                      className="relative mb-3"
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[18px] top-2.5 size-3 rounded-full ring-2 ring-[#0d1220] flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        {isResolved && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-0 rounded-full"
                            style={{ boxShadow: `0 0 8px ${color}` }}
                          />
                        )}
                      </div>

                      {/* Entry card */}
                      <div
                        className="rounded-md border border-white/5 bg-white/3 p-2.5 hover:bg-white/5 transition-colors"
                        style={{
                          borderLeftColor: color,
                          borderLeftWidth: '2px',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium"
                              style={{
                                backgroundColor: `${color}20`,
                                color: color,
                              }}
                            >
                              {ANOMALY_ICONS[entry.type]}
                              {ANOMALY_LABELS[entry.type]}
                            </span>
                            <span className="text-xs text-gray-300 font-medium">
                              {entry.serviceName}
                            </span>
                          </div>
                          <Badge
                            className={`text-[9px] h-4 ${
                              entry.triggeredBy === 'scenario'
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                : entry.triggeredBy === 'manual'
                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                : 'bg-white/5 text-gray-500 border-white/10'
                            }`}
                          >
                            {entry.triggeredBy}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {formatTimeOfDay(entry.startedAt)} · {formatTimeAgo(entry.startedAt)}
                          </span>
                          {isResolved ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-2.5" />
                              recovered in {formatDuration(entry.recoveryTimeMs || 0)}
                            </span>
                          ) : (
                            <motion.span
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="text-red-400 flex items-center gap-1"
                            >
                              <AlertCircle className="size-2.5" />
                              ongoing
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
