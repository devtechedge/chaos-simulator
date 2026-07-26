'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  AlertTriangle,
  Server,
  Shield,
  Zap,
  RefreshCw,
  Clock,
  Heart,
  Skull,
  Activity,
} from 'lucide-react'
import type { ServiceData, AnomalyType, LatencySample } from '@/lib/chaos-types'
import { SERVICE_META } from '@/lib/chaos-types'
import { ServiceSparkline } from './LatencyChart'

interface Props {
  service: ServiceData
  latencySamples: LatencySample[]
  onRestart: () => void
  onInjectAnomaly: (type: AnomalyType) => void
  index: number
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  AuthService: <Shield className="size-5" />,
  PaymentService: <Zap className="size-5" />,
  InventoryService: <Server className="size-5" />,
}

export function ServiceCard({ service, latencySamples, onRestart, onInjectAnomaly, index }: Props) {
  const isHealthy = service.health === 'Healthy'
  const isDown = service.health === 'Down'
  const isDegraded = service.health === 'Degraded'
  const meta = SERVICE_META[service.name]
  const color = meta?.color || '#3b82f6'
  const icon = SERVICE_ICONS[service.name] || <Server className="size-5" />

  const latencyOverBaseline =
    service.baselineLatencyMs > 0
      ? Math.round((service.latencyMs / service.baselineLatencyMs) * 100)
      : 0

  const cardVariants = {
    healthy: {
      borderColor: 'var(--border)',
      boxShadow: 'var(--glass-shadow)',
    },
    degraded: {
      borderColor: 'rgba(245, 158, 11, 0.35)',
      boxShadow: '0 0 30px -10px rgba(245,158,11,0.3)',
    },
    down: {
      borderColor: 'rgba(239, 68, 68, 0.4)',
      boxShadow: '0 0 40px -8px rgba(239,68,68,0.4)',
    },
  }

  const currentVariant = isDown ? 'down' : isDegraded ? 'degraded' : 'healthy'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 120, damping: 18 }}
      whileHover={{ y: -3 }}
    >
      <motion.div animate={cardVariants[currentVariant]} transition={{ duration: 0.5 }}>
        <Card className="surface-card rounded-2xl transition-all">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <motion.div
                  className="size-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                  animate={
                    isDown
                      ? { scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.6, repeat: isDown ? Infinity : 0 }}
                >
                  <div style={{ color }}>{icon}</div>
                </motion.div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-foreground truncate">{service.name}</CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground truncate">
                    {meta?.description || 'Microservice Instance'}
                  </CardDescription>
                </div>
              </div>
              <HealthBadge health={service.health} />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
                  <Clock className="size-3" /> Latency
                </span>
                <motion.span
                  key={service.latencyMs}
                  initial={{ opacity: 0.4, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`font-mono tabular-nums font-bold ${
                    isDown ? 'text-red-500' : isDegraded ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                  }`}
                >
                  {service.isCrashed ? '---' : `${service.latencyMs}ms`}
                </motion.span>
              </div>
              <ServiceSparkline samples={latencySamples} color={color} />
              <Progress
                value={isDown ? 100 : Math.min(latencyOverBaseline, 100)}
                className={`h-1.5 ${
                  isDown
                    ? '[&>div]:bg-red-500'
                    : isDegraded
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-emerald-500'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="stat-cell">
                <div className="text-[10px] text-muted-foreground font-medium">Baseline</div>
                <div className="font-mono text-xs tabular-nums text-foreground font-semibold">{service.baselineLatencyMs}ms</div>
              </div>
              <div className="stat-cell">
                <div className="text-[10px] text-muted-foreground font-medium">Req/Min</div>
                <div className="font-mono text-xs tabular-nums text-foreground font-semibold">
                  {service.isCrashed ? '0' : service.requestVolume.toLocaleString()}
                </div>
              </div>
              <div className="stat-cell">
                <div className="text-[10px] text-muted-foreground font-medium">Recovered</div>
                <div className="font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">{service.outagesPrevented}</div>
              </div>
              <div className="stat-cell">
                <div className="text-[10px] text-muted-foreground font-medium">Anomaly</div>
                <div className="font-mono text-xs tabular-nums text-foreground font-semibold">
                  {service.anomaly ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500">
                      {service.anomaly.replace('_', ' ')}
                    </motion.span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs border-border hover:bg-accent transition-all active:scale-[0.97] rounded-xl"
              onClick={onRestart}
              disabled={isHealthy}
            >
              <RefreshCw className={`size-3 ${!isHealthy ? 'animate-spin-slow' : ''}`} />
              Manual Restart
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

function HealthBadge({ health }: { health: ServiceData['health'] }) {
  if (health === 'Healthy') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20 text-[10px] font-semibold rounded-lg">
        <Heart className="size-3 mr-1" /> HEALTHY
      </Badge>
    )
  }
  if (health === 'Degraded') {
    return (
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20 text-[10px] font-semibold rounded-lg">
          <AlertTriangle className="size-3 mr-1" /> DEGRADED
        </Badge>
      </motion.div>
    )
  }
  return (
    <motion.div animate={{ scale: [1, 1.08, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
      <Badge className="bg-red-500/15 text-red-500 border-red-500/25 hover:bg-red-500/20 text-[10px] font-semibold rounded-lg">
        <Skull className="size-3 mr-1" /> DOWN
      </Badge>
    </motion.div>
  )
}

export function KpiDisplay({
  services,
  totalOutagesPrevented,
  simulationCycles,
}: {
  services: ServiceData[]
  totalOutagesPrevented: number
  simulationCycles: number
}) {
  const activeCount = services.filter((s) => s.health === 'Healthy').length
  const avgLatency =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.latencyMs, 0) / services.length)
      : 0

  const kpis = [
    {
      label: 'Active Services',
      value: `${activeCount}/${services.length}`,
      icon: <Server className="size-4 text-emerald-500" />,
      accentBg: 'bg-emerald-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(16,185,129,0.4)]',
    },
    {
      label: 'Outages Prevented',
      value: String(totalOutagesPrevented),
      icon: <Shield className="size-4 text-orange-500" />,
      accentBg: 'bg-orange-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(249,115,22,0.4)]',
    },
    {
      label: 'Chaos Cycles',
      value: String(simulationCycles),
      icon: <Activity className="size-4 text-red-500" />,
      accentBg: 'bg-red-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(239,68,68,0.4)]',
    },
    {
      label: 'Avg Latency',
      value: services.length > 0 ? `${avgLatency}ms` : '--',
      icon: <Clock className="size-4 text-amber-500" />,
      accentBg: 'bg-amber-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(245,158,11,0.4)]',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`glass-panel rounded-xl p-3 ${kpi.ringColor}`}
        >
          <div className="flex items-center gap-3">
            <div className={`size-9 rounded-xl flex items-center justify-center ${kpi.accentBg} shrink-0`}>
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</div>
              <motion.div
                key={kpi.value}
                initial={{ opacity: 0.5, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="text-lg font-bold text-foreground font-mono tabular-nums"
              >
                {kpi.value}
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
