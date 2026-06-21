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
      backgroundColor: 'rgba(13, 18, 32, 1)',
      borderColor: 'rgba(255,255,255,0.05)',
      boxShadow: '0 0 0 rgba(0,0,0,0)',
    },
    degraded: {
      backgroundColor: 'rgba(245, 158, 11, 0.04)',
      borderColor: 'rgba(245, 158, 11, 0.35)',
      boxShadow: '0 0 35px -10px rgba(245,158,11,0.35)',
    },
    down: {
      backgroundColor: 'rgba(239, 68, 68, 0.06)',
      borderColor: 'rgba(239, 68, 68, 0.45)',
      boxShadow: '0 0 45px -8px rgba(239,68,68,0.5)',
    },
  }

  const currentVariant = isDown ? 'down' : isDegraded ? 'degraded' : 'healthy'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 120, damping: 18 }}
      whileHover={{ y: -4 }}
    >
      <motion.div animate={cardVariants[currentVariant]} transition={{ duration: 0.5 }}>
        <Card className="border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  className="size-9 rounded-lg flex items-center justify-center"
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
                <div>
                  <CardTitle className="text-sm font-semibold text-white">{service.name}</CardTitle>
                  <CardDescription className="text-[11px] text-gray-500">
                    {meta?.description || 'Microservice Instance'}
                  </CardDescription>
                </div>
              </div>
              <HealthBadge health={service.health} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Latency + Sparkline */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="size-3" /> Latency (last 30s)
                </span>
                <motion.span
                  key={service.latencyMs}
                  initial={{ opacity: 0.4, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`font-mono font-bold ${
                    isDown ? 'text-red-400' : isDegraded ? 'text-amber-400' : 'text-gray-300'
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

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/3 rounded-md px-2 py-1.5">
                <div className="text-gray-500">Baseline</div>
                <div className="font-mono text-gray-300">{service.baselineLatencyMs}ms</div>
              </div>
              <div className="bg-white/3 rounded-md px-2 py-1.5">
                <div className="text-gray-500">Req/Min</div>
                <div className="font-mono text-gray-300">
                  {service.isCrashed ? '0' : service.requestVolume.toLocaleString()}
                </div>
              </div>
              <div className="bg-white/3 rounded-md px-2 py-1.5">
                <div className="text-gray-500">Recovered</div>
                <div className="font-mono text-emerald-400">{service.outagesPrevented}</div>
              </div>
              <div className="bg-white/3 rounded-md px-2 py-1.5">
                <div className="text-gray-500">Anomaly</div>
                <div className="font-mono text-gray-300">
                  {service.anomaly ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-400"
                    >
                      {service.anomaly.replace('_', ' ')}
                    </motion.span>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
            </div>

            {/* Restart Button */}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs border-white/10 hover:bg-white/5 transition-all active:scale-[0.97]"
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
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
        <Heart className="size-3 mr-1" /> HEALTHY
      </Badge>
    )
  }
  if (health === 'Degraded') {
    return (
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          <AlertTriangle className="size-3 mr-1" /> DEGRADED
        </Badge>
      </motion.div>
    )
  }
  return (
    <motion.div
      animate={{ scale: [1, 1.08, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
        <Skull className="size-3 mr-1" /> DOWN
      </Badge>
    </motion.div>
  )
}

// Animated KPI counter (uses Framer Motion useMotionValue + animate)
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
      icon: <Server className="size-4 text-emerald-400" />,
      accentBg: 'bg-emerald-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(16,185,129,0.5)]',
    },
    {
      label: 'Outages Prevented',
      value: String(totalOutagesPrevented),
      icon: <Shield className="size-4 text-orange-400" />,
      accentBg: 'bg-orange-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(249,115,22,0.5)]',
    },
    {
      label: 'Chaos Cycles',
      value: String(simulationCycles),
      icon: <Activity className="size-4 text-red-400" />,
      accentBg: 'bg-red-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(239,68,68,0.5)]',
    },
    {
      label: 'Avg Latency',
      value: services.length > 0 ? `${avgLatency}ms` : '--',
      icon: <Clock className="size-4 text-amber-400" />,
      accentBg: 'bg-amber-500/10',
      ringColor: 'shadow-[0_0_20px_-8px_rgba(245,158,11,0.5)]',
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
          className={`rounded-xl border border-white/5 bg-[#0d1220]/80 p-3 ${kpi.ringColor}`}
        >
          <div className="flex items-center gap-3">
            <div className={`size-9 rounded-lg flex items-center justify-center ${kpi.accentBg}`}>
              {kpi.icon}
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">{kpi.label}</div>
              <motion.div
                key={kpi.value}
                initial={{ opacity: 0.5, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="text-lg font-bold text-white font-mono"
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
