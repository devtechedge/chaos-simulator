'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Terminal, Filter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LogEvent, LogLevel } from '@/lib/chaos-types'

interface Props {
  logs: LogEvent[]
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: 'text-sky-500',
  WARN: 'text-amber-600 dark:text-amber-400',
  CRITICAL: 'text-red-500',
  RESOLVED: 'text-emerald-600 dark:text-emerald-400',
}

const LEVEL_BG: Record<LogLevel, string> = {
  INFO: '',
  WARN: 'bg-amber-500/[0.06] dark:bg-amber-500/5',
  CRITICAL: 'bg-red-500/[0.08] dark:bg-red-500/10',
  RESOLVED: 'bg-emerald-500/[0.06] dark:bg-emerald-500/5',
}

const FILTERS: { label: string; value: LogLevel | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Info', value: 'INFO' },
  { label: 'Warn', value: 'WARN' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'Resolved', value: 'RESOLVED' },
]

export function LiveLog({ logs }: Props) {
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const filtered = filter === 'ALL' ? logs : logs.filter((l) => l.level === filter)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [filtered.length])

  return (
    <Card className="surface-card rounded-2xl h-[420px] flex flex-col">
      <CardHeader className="pb-2 shrink-0 px-5 pt-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Terminal className="size-4 text-emerald-500" />
          Live Event Stream
          <Badge variant="outline" className="text-[10px] ml-auto text-muted-foreground border-border font-mono tabular-nums">
            {logs.length} events
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5 mt-2">
          <Filter className="size-3 text-muted-foreground" />
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-all font-medium ${
                filter === f.value
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-5 pb-4 custom-scrollbar"
        >
          <div className="font-mono text-xs space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground text-center py-8 text-xs">Waiting for events...</div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.slice(-80).map((log) => (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, x: -10, backgroundColor: 'var(--accent)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`flex items-start gap-2 py-1 px-2.5 rounded-md ${LEVEL_BG[log.level]}`}
                  >
                    <span className="text-muted-foreground/60 shrink-0 w-16 text-[11px] tabular-nums">[{log.timestamp}]</span>
                    <span className={`shrink-0 w-20 font-bold text-[11px] ${LEVEL_COLORS[log.level]}`}>
                      {log.level}
                    </span>
                    <span className="shrink-0 w-28 text-muted-foreground">{log.service}</span>
                    <span className="text-foreground/80">{log.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
