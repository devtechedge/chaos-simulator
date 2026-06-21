'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Activity,
  AlertTriangle,
  Server,
  Shield,
  Zap,
  RefreshCw,
  WifiOff,
  Flame,
  Skull,
  Gauge,
  Heart,
  Volume2,
  VolumeX,
  Sparkles,
  Play,
  X,
} from 'lucide-react'

import type {
  ServiceData,
  LogEvent,
  AnomalyType,
  LatencySample,
  AnomalyHistoryEntry,
  ScenarioStep,
} from '@/lib/chaos-types'
import { SERVICE_NAMES, SERVICE_META, ANOMALY_COLORS } from '@/lib/chaos-types'
import { soundManager } from '@/lib/sound-manager'

import { ServiceCard, KpiDisplay } from '@/components/chaos/ServiceCard'
import { LiveLog } from '@/components/chaos/LiveLog'
import { LatencyChart } from '@/components/chaos/LatencyChart'
import { ServiceTopology } from '@/components/chaos/ServiceTopology'
import { AnomalyTimeline } from '@/components/chaos/AnomalyTimeline'
import { ChaosScenarioBuilder } from '@/components/chaos/ChaosScenarioBuilder'
import { ToastStack, useChaosToasts } from '@/components/chaos/ToastStack'
import type { ChaosToast } from '@/components/chaos/ToastStack'
import { ConnectionIndicator } from '@/components/chaos/ConnectionIndicator'
import {
  ParticleOverlay,
  emitParticleBurst,
} from '@/components/chaos/ParticleOverlay'

type ConnState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

export default function Dashboard() {
  const socketRef = useRef<Socket | null>(null)
  const [connState, setConnState] = useState<ConnState>('connecting')
  const [services, setServices] = useState<ServiceData[]>([])
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [latencyHistory, setLatencyHistory] = useState<Record<string, LatencySample[]>>({})
  const [anomalyHistory, setAnomalyHistory] = useState<AnomalyHistoryEntry[]>([])
  const [chaosEnabled, setChaosEnabled] = useState(true)
  const [totalOutagesPrevented, setTotalOutagesPrevented] = useState(0)
  const [simulationCycles, setSimulationCycles] = useState(0)
  const [soundOn, setSoundOn] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [activeScenario, setActiveScenario] = useState<{
    name: string
    currentStep: number
    totalSteps: number
  } | null>(null)

  const { toasts, pushToast, dismissToast } = useChaosToasts()
  const prevServicesRef = useRef<ServiceData[]>([])
  const processedLogIds = useRef<Set<string>>(new Set())

  // ============================================================
  // SOUND TOGGLE
  // ============================================================
  const toggleSound = useCallback(() => {
    const newVal = !soundOn
    setSoundOn(newVal)
    soundManager.setEnabled(newVal)
    if (newVal) soundManager.play('click')
  }, [soundOn])

  // ============================================================
  // SOCKET.IO CONNECTION
  // ============================================================
  useEffect(() => {
    // In production: set NEXT_PUBLIC_CHAOS_ENGINE_URL to your Render/Railway URL.
    // In local dev: leave it empty and Next.js's rewrite proxies socket.io to port 3030.
    const chaosEngineUrl = process.env.NEXT_PUBLIC_CHAOS_ENGINE_URL || ''
    const socketUrl = chaosEngineUrl
      ? `${chaosEngineUrl}/?XTransformPort=3030`
      : '/?XTransformPort=3030'

    const socketInstance = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 10000,
    })

    socketRef.current = socketInstance

    socketInstance.on('connect', () => {
      setConnState('connected')
      console.log('[Dashboard] Connected to Chaos Engine')
    })

    socketInstance.on('disconnect', () => {
      setConnState('disconnected')
      console.log('[Dashboard] Disconnected from Chaos Engine')
    })

    socketInstance.io.on('reconnect_attempt', () => {
      setConnState('reconnecting')
    })

    socketInstance.on('connect_error', () => {
      setConnState('reconnecting')
    })

    socketInstance.on(
      'telemetry',
      (data: { services: ServiceData[]; timestamp: number }) => {
        setServices(data.services)
        const totalOutages = data.services.reduce(
          (sum, s) => sum + s.outagesPrevented,
          0
        )
        setTotalOutagesPrevented(totalOutages)
        prevServicesRef.current = data.services
      }
    )

    socketInstance.on('log', (entry: LogEvent) => {
      // Track new logs to fire sound + toast + particle effects
      const isNew = !processedLogIds.current.has(entry.id)
      processedLogIds.current.add(entry.id)
      // Cap processed IDs set size
      if (processedLogIds.current.size > 500) {
        processedLogIds.current = new Set(
          Array.from(processedLogIds.current).slice(-250)
        )
      }

      setLogs((prev) => {
        const updated = [...prev, entry]
        if (updated.length > 100) updated.shift()
        return updated
      })

      if (isNew) {
        if (entry.level === 'CRITICAL') {
          setSimulationCycles((prev) => prev + 1)
          soundManager.play('critical')

          // Particle burst for the affected service
          const meta = SERVICE_META[entry.service]
          const color =
            ANOMALY_COLORS[
              entry.message.includes('CRASHED')
                ? 'SERVICE_CRASH'
                : entry.message.includes('PARTITION')
                ? 'NETWORK_PARTITION'
                : entry.message.includes('Latency')
                ? 'LATENCY_SPIKE'
                : '500_ERROR'
            ] || '#ef4444'

          emitParticleBurst({
            color,
            intensity: 'big',
            count: 70,
          })

          pushToast({
            kind: 'critical',
            title: `${entry.service} down`,
            message: entry.message,
            service: entry.service,
          })
        } else if (entry.level === 'RESOLVED') {
          soundManager.play('resolved')
          pushToast({
            kind: 'resolved',
            title: `${entry.service} recovered`,
            message: entry.message,
            service: entry.service,
          })
        } else if (entry.level === 'WARN') {
          soundManager.play('warning')
        }
      }
    })

    socketInstance.on('log-history', (history: LogEvent[]) => {
      setLogs(history)
      for (const l of history) processedLogIds.current.add(l.id)
    })

    socketInstance.on(
      'latency-history',
      (data: {
        services: { serviceName: string; samples: LatencySample[] }[]
        timestamp: number
      }) => {
        const map: Record<string, LatencySample[]> = {}
        for (const s of data.services) {
          map[s.serviceName] = s.samples
        }
        setLatencyHistory(map)
      }
    )

    socketInstance.on(
      'latency-sample',
      (data: {
        services: { serviceName: string; samples: LatencySample[] }[]
        timestamp: number
      }) => {
        setLatencyHistory((prev) => {
          const next = { ...prev }
          for (const s of data.services) {
            next[s.serviceName] = s.samples
          }
          return next
        })
      }
    )

    socketInstance.on(
      'anomaly-history',
      (data: { anomalies: AnomalyHistoryEntry[]; timestamp: number }) => {
        setAnomalyHistory(data.anomalies)
      }
    )

    socketInstance.on('anomaly-update', (entry: AnomalyHistoryEntry) => {
      setAnomalyHistory((prev) => {
        const idx = prev.findIndex((e) => e.id === entry.id)
        if (idx === -1) return [...prev, entry]
        const next = [...prev]
        next[idx] = entry
        return next
      })
    })

    socketInstance.on(
      'scenario-step',
      (data: {
        scenarioId: string
        scenarioName: string
        stepIndex: number
        totalSteps: number
        service: string
        type: AnomalyType
        timestamp: number
      }) => {
        setActiveScenario({
          name: data.scenarioName,
          currentStep: data.stepIndex,
          totalSteps: data.totalSteps,
        })
        soundManager.play('warning')
      }
    )

    socketInstance.on('scenario-complete', () => {
      setTimeout(() => setActiveScenario(null), 3000)
    })

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // ============================================================
  // ACTIONS
  // ============================================================
  const handleManualRestart = useCallback((serviceName: string) => {
    socketRef.current?.emit('manual-restart', { service: serviceName })
    soundManager.play('click')
  }, [])

  const handleTriggerPartition = useCallback(() => {
    socketRef.current?.emit('trigger-partition', {})
    soundManager.play('alarm')
    // Big particle burst across whole screen
    emitParticleBurst({
      color: '#dc2626',
      intensity: 'big',
      count: 120,
    })
  }, [])

  const handleToggleChaos = useCallback(
    (enabled: boolean) => {
      setChaosEnabled(enabled)
      socketRef.current?.emit('toggle-chaos', { enabled })
      soundManager.play('click')
    },
    []
  )

  const handleInjectAnomaly = useCallback(
    (serviceName: string, type: AnomalyType) => {
      socketRef.current?.emit('inject-anomaly', { service: serviceName, type })
      soundManager.play('warning')
      emitParticleBurst({
        color: ANOMALY_COLORS[type] || '#ef4444',
        intensity: 'normal',
        count: 30,
      })
    },
    []
  )

  const handleRunScenario = useCallback(
    (name: string, steps: ScenarioStep[]) => {
      socketRef.current?.emit('run-scenario', { name, steps })
      soundManager.play('alarm')
      setActiveScenario({ name, currentStep: 0, totalSteps: steps.length })
      pushToast({
        kind: 'scenario',
        title: `Scenario launched: ${name}`,
        message: `${steps.length} step(s) queued. Watch the topology for live impact.`,
      })
    },
    [pushToast]
  )

  const getService = (name: string) => services.find((s) => s.name === name)

  return (
    <div className="relative min-h-screen bg-[#0a0e17] text-gray-100 flex flex-col overflow-x-hidden">
      {/* Background grid + glow */}
      <div className="fixed inset-0 chaos-grid-bg pointer-events-none opacity-50" />
      <div className="fixed top-0 left-1/4 size-[500px] rounded-full bg-orange-500/5 blur-[120px] animate-drift pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 size-[400px] rounded-full bg-red-500/5 blur-[100px] animate-drift pointer-events-none" />

      {/* Particle overlay (full screen) */}
      <ParticleOverlay />

      {/* Toast stack */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ===== HEADER ===== */}
      <header className="border-b border-white/5 bg-[#0d1220]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <motion.div
                animate={{
                  rotate: [0, -5, 5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="size-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center animate-aura"
              >
                <Flame className="size-5 text-white" />
              </motion.div>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Chaos Simulator
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Distributed Microservices · Self-Healing Telemetry
              </p>
            </div>
          </motion.div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ConnectionIndicator state={connState} />
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 hidden md:inline">Engine:</span>
              <Switch checked={chaosEnabled} onCheckedChange={handleToggleChaos} />
              <motion.span
                key={chaosEnabled ? 'armed' : 'disarmed'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={
                  chaosEnabled ? 'text-orange-400 font-bold' : 'text-gray-600 font-bold'
                }
              >
                {chaosEnabled ? 'ARMED' : 'DISARMED'}
              </motion.span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleSound}
              className={`size-8 ${soundOn ? 'text-orange-400' : 'text-gray-500'}`}
              title={soundOn ? 'Mute' : 'Unmute'}
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <Button
              size="sm"
              onClick={() => setScenarioOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-1.5"
              disabled={connState !== 'connected'}
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Scenario</span> Builder
            </Button>
          </div>
        </div>

        {/* Active scenario banner */}
        <AnimatePresence>
          {activeScenario && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-gradient-to-r from-orange-500/10 via-red-500/10 to-purple-500/10 border-y border-orange-500/20"
            >
              <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 text-xs">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Flame className="size-4 text-orange-400" />
                </motion.div>
                <span className="text-white font-medium">
                  Scenario running: <span className="text-orange-400">{activeScenario.name}</span>
                </span>
                <span className="text-gray-500">
                  Step {activeScenario.currentStep}/{activeScenario.totalSteps}
                </span>
                <div className="flex-1 max-w-[300px] h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                    animate={{
                      width: `${
                        activeScenario.totalSteps > 0
                          ? (activeScenario.currentStep / activeScenario.totalSteps) * 100
                          : 0
                      }%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ===== KPI STRIP ===== */}
      <div className="border-b border-white/5 bg-[#0d1220]/40 backdrop-blur-sm relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          <KpiDisplay
            services={services}
            totalOutagesPrevented={totalOutagesPrevented}
            simulationCycles={simulationCycles}
          />
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 w-full relative z-10">
        {/* SECTION 1: Topology + Latency Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6"
        >
          <div className="lg:col-span-3">
            <Card className="bg-[#0d1220]/80 border-white/5 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                  <Activity className="size-4 text-orange-400" />
                  Service Topology
                  <span className="text-[10px] text-gray-500 ml-auto font-normal">
                    Live data flow · Real-time health
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceTopology services={services} chaosEnabled={chaosEnabled} />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-[#0d1220]/80 border-white/5 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                  <Gauge className="size-4 text-amber-400" />
                  Latency (last 60s)
                  <Badge
                    variant="outline"
                    className="text-[10px] ml-auto text-gray-500 border-white/10"
                  >
                    {services.length} services
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LatencyChart latencyHistory={latencyHistory} services={services} />
                {/* Mini legend */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {SERVICE_NAMES.map((name) => {
                    const svc = services.find((s) => s.name === name)
                    const meta = SERVICE_META[name]
                    return (
                      <div key={name} className="flex items-center gap-1.5 text-[10px]">
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-gray-400">{name.replace('Service', '')}</span>
                        {svc && (
                          <span className="text-gray-600 font-mono">
                            {svc.isCrashed ? '---' : `${svc.latencyMs}ms`}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* SECTION 2: Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {SERVICE_NAMES.map((name, idx) => {
            const svc = getService(name)
            const samples = latencyHistory[name] || []
            if (!svc) {
              return <ServiceCardSkeleton key={name} name={name} index={idx} />
            }
            return (
              <ServiceCard
                key={name}
                service={svc}
                latencySamples={samples}
                index={idx}
                onRestart={() => handleManualRestart(name)}
                onInjectAnomaly={(type) => handleInjectAnomaly(name, type)}
              />
            )
          })}
        </div>

        {/* SECTION 3: Log + Anomaly Timeline + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live log */}
          <div className="lg:col-span-2">
            <LiveLog logs={logs} />
          </div>

          {/* Right column: Disaster controls + per-service chaos */}
          <div className="space-y-4">
            <Card className="bg-[#0d1220]/80 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                  <Skull className="size-4 text-red-400" />
                  Disaster Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="destructive"
                    className="w-full gap-2 bg-red-500 hover:bg-red-600"
                    onClick={handleTriggerPartition}
                    disabled={connState !== 'connected'}
                  >
                    <WifiOff className="size-4" />
                    Trigger Massive Network Partition
                  </Button>
                </motion.div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Catastrophic partition affecting all three microservices simultaneously.
                  Self-healing will attempt recovery within 15 seconds per service.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0d1220]/80 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                  <Flame className="size-4 text-orange-400" />
                  Targeted Chaos Injection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {SERVICE_NAMES.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-28 shrink-0 truncate">
                      {name}
                    </span>
                    <div className="flex gap-1 flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleInjectAnomaly(name, '500_ERROR')}
                        disabled={connState !== 'connected'}
                      >
                        500
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => handleInjectAnomaly(name, 'LATENCY_SPIKE')}
                        disabled={connState !== 'connected'}
                      >
                        Latency
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleInjectAnomaly(name, 'SERVICE_CRASH')}
                        disabled={connState !== 'connected'}
                      >
                        Crash
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-[#0d1220]/80 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                  <Activity className="size-4 text-sky-400" />
                  Simulation Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Chaos Interval</span>
                  <span className="text-gray-300 font-mono">30s</span>
                </div>
                <div className="flex justify-between">
                  <span>Self-Healing Check</span>
                  <span className="text-gray-300 font-mono">5s</span>
                </div>
                <div className="flex justify-between">
                  <span>Recovery Target</span>
                  <span className="text-gray-300 font-mono">&lt;15s</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency Sampling</span>
                  <span className="text-gray-300 font-mono">1s</span>
                </div>
                <div className="flex justify-between">
                  <span>Engine State</span>
                  <span
                    className={
                      chaosEnabled ? 'text-orange-400 font-mono' : 'text-gray-600 font-mono'
                    }
                  >
                    {chaosEnabled ? 'ARMED' : 'DISARMED'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SECTION 4: Anomaly Timeline */}
        <div className="mt-6">
          <AnomalyTimeline entries={anomalyHistory} />
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 bg-[#0d1220]/60 py-3 mt-auto relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-600 flex-wrap gap-2">
          <span>Distributed Microservices Chaos Simulator v2.0 — Animated Edition</span>
          <span>
            {connState === 'connected' ? (
              <span className="text-emerald-500/70">Connected to Chaos Engine on port 3030</span>
            ) : (
              <span className="text-red-500/70">
                {connState === 'reconnecting'
                  ? 'Reconnecting to Chaos Engine...'
                  : 'Disconnected from Chaos Engine'}
              </span>
            )}
          </span>
        </div>
      </footer>

      {/* Scenario Builder Dialog */}
      <ChaosScenarioBuilder
        open={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        onRun={handleRunScenario}
      />
    </div>
  )
}

// ============================================================
// SKELETON PLACEHOLDER
// ============================================================
function ServiceCardSkeleton({
  name,
  index,
}: {
  name: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="bg-[#0d1220]/80 border-white/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-white/5 animate-pulse" />
            <div>
              <CardTitle className="text-sm font-semibold text-white">{name}</CardTitle>
              <div className="text-[11px] text-gray-500">Connecting...</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-gray-600 text-xs gap-2">
            <RefreshCw className="size-3 animate-spin" />
            Waiting for telemetry data...
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
