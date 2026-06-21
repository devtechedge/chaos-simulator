'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Terminal, Filter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LogEvent, LogLevel } from '@/lib/chaos-types'

interface Props {
  logs: LogEvent[]
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: 'text-sky-400',
  WARN: 'text-amber-400',
  CRITICAL: 'text-red-400',
  RESOLVED: 'text-emerald-400',
}

const LEVEL_BG: Record<LogLevel, string> = {
  INFO: '',
  WARN: 'bg-amber-500/5',
  CRITICAL: 'bg-red-500/10',
  RESOLVED: 'bg-emerald-500/5',
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

  // Auto-scroll to bottom when new logs arrive (only if user is near the bottom)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [filtered.length])

  return (
    <Card className="bg-[#0d1220] border-white/5 h-[420px] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
          <Terminal className="size-4 text-green-400" />
          Live Event Stream
          <Badge variant="outline" className="text-[10px] ml-auto text-gray-500 border-white/10">
            {logs.length} events
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5 mt-2">
          <Filter className="size-3 text-gray-500" />
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                filter === f.value
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
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
          className="h-full overflow-y-auto px-4 pb-4 custom-scrollbar"
        >
          <div className="font-mono text-xs space-y-0.5">
            {filtered.length === 0 ? (
              <div className="text-gray-600 text-center py-8">Waiting for events...</div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.slice(-80).map((log) => (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, x: -10, backgroundColor: 'rgba(255,255,255,0.06)' }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      backgroundColor: 'rgba(255,255,255,0)',
                    }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`flex items-start gap-2 py-1 px-2 rounded ${LEVEL_BG[log.level]}`}
                  >
                    <span className="text-gray-600 shrink-0 w-16">[{log.timestamp}]</span>
                    <span
                      className={`shrink-0 w-20 font-bold ${LEVEL_COLORS[log.level]}`}
                    >
                      {log.level}
                    </span>
                    <span className="shrink-0 w-28 text-gray-400">{log.service}</span>
                    <span className="text-gray-300">{log.message}</span>
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
