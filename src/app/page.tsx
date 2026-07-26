'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Activity,
  RefreshCw,
  WifiOff,
  Flame,
  Skull,
  Gauge,
  Volume2,
  VolumeX,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react'

import type {
  AnomalyType,
  ScenarioStep,
} from '@/lib/chaos-types'
import { SERVICE_NAMES, SERVICE_META, ANOMALY_COLORS } from '@/lib/chaos-types'
import { soundManager } from '@/lib/sound-manager'

import { useChaosEngine } from '@/hooks/useChaosEngine'
import { ServiceCard, KpiDisplay } from '@/components/chaos/ServiceCard'
import { LiveLog } from '@/components/chaos/LiveLog'
import { LatencyChart } from '@/components/chaos/LatencyChart'
import { ServiceTopology } from '@/components/chaos/ServiceTopology'
import { AnomalyTimeline } from '@/components/chaos/AnomalyTimeline'
import { ChaosScenarioBuilder } from '@/components/chaos/ChaosScenarioBuilder'
import { ToastStack, useChaosToasts } from '@/components/chaos/ToastStack'
import {
  ParticleOverlay,
  emitParticleBurst,
} from '@/components/chaos/ParticleOverlay'

export default function Dashboard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // ============================================================
  // CHAOS ENGINE HOOK
  // ============================================================
  const {
    services,
    logs,
    latencyHistory,
    anomalyHistory,
    chaosEnabled,
    activeScenario,
    totalOutagesPrevented,
    setChaosEnabled: handleToggleChaos,
    manualRestart: handleManualRestart,
    triggerPartition: handleTriggerPartition,
    injectAnomaly: handleInjectAnomaly,
    runScenario: handleRunScenario,
  } = useChaosEngine()

  // ============================================================
  // UI STATE
  // ============================================================
  const [soundOn, setSoundOn] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [simulationCycles, setSimulationCycles] = useState(0)

  const { toasts, pushToast, dismissToast } = useChaosToasts()
  const processedLogIds = useRef<Set<string>>(new Set())

  // Fix hydration mismatch for theme toggle
  useEffect(() => setMounted(true), [])

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
  // LOG EVENT PROCESSING — sound, toast, particles
  // ============================================================
  useEffect(() => {
    for (const entry of logs) {
      if (processedLogIds.current.has(entry.id)) continue
      processedLogIds.current.add(entry.id)

      if (processedLogIds.current.size > 500) {
        processedLogIds.current = new Set(
          Array.from(processedLogIds.current).slice(-250)
        )
      }

      if (entry.level === 'CRITICAL') {
        setSimulationCycles((prev) => prev + 1)
        soundManager.play('critical')

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

        emitParticleBurst({ color, intensity: 'big', count: 70 })

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
  }, [logs, pushToast])

  const getService = (name: string) => services.find((s) => s.name === name)

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* Background grid + ambient glow */}
      <div className="fixed inset-0 chaos-grid-bg pointer-events-none" />
      <div className="dark:block hidden">
        <div className="fixed top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-orange-500/[0.04] blur-[120px] animate-drift pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-red-500/[0.03] blur-[100px] animate-drift pointer-events-none" />
      </div>
      <div className="dark:hidden block">
        <div className="fixed top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-orange-200/30 blur-[100px] animate-drift pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-red-200/20 blur-[80px] animate-drift pointer-events-none" />
      </div>

      {/* Particle overlay */}
      <ParticleOverlay />

      {/* Toast stack */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ===== HEADER ===== */}
      <header className="glass-panel border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="size-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center animate-aura shadow-lg shadow-orange-500/20"
              >
                <Flame className="size-5 text-white" />
              </motion.div>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                Chaos Simulator
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Distributed Microservices · Self-Healing Telemetry
              </p>
            </div>
          </motion.div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live indicator */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
            >
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-emerald-500"
              >
                <Activity className="size-3.5" />
              </motion.div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
                LIVE
              </span>
            </motion.div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* Chaos toggle */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden md:inline text-[11px] font-medium">Engine</span>
              <Switch checked={chaosEnabled} onCheckedChange={handleToggleChaos} />
              <motion.span
                key={chaosEnabled ? 'armed' : 'disarmed'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[11px] font-bold tracking-wide ${chaosEnabled ? 'text-orange-500' : 'text-muted-foreground'}`}
              >
                {chaosEnabled ? 'ARMED' : 'DISARMED'}
              </motion.span>
            </div>

            <Separator orientation="vertical" className="h-5" />

            {/* Theme toggle */}
            {mounted && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            )}

            {/* Sound toggle */}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleSound}
              className={`size-8 ${soundOn ? 'text-orange-500' : 'text-muted-foreground'}`}
              title={soundOn ? 'Mute' : 'Unmute'}
            >
              {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>

            {/* Scenario Builder */}
            <Button
              size="sm"
              onClick={() => setScenarioOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-1.5 shadow-lg shadow-orange-500/20"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline text-xs font-medium">Scenario</span>
              <span className="sm:hidden text-xs font-medium">Builder</span>
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
              className="overflow-hidden border-t border-orange-500/20 bg-gradient-to-r from-orange-500/[0.07] via-red-500/[0.05] to-purple-500/[0.07]"
            >
              <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3 text-xs">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Flame className="size-3.5 text-orange-500" />
                </motion.div>
                <span className="text-foreground font-medium">
                  Scenario: <span className="text-orange-500 font-bold">{activeScenario.name}</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  Step {activeScenario.currentStep}/{activeScenario.totalSteps}
                </span>
                <div className="flex-1 max-w-[300px] h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                    animate={{
                      width: `${activeScenario.totalSteps > 0 ? (activeScenario.currentStep / activeScenario.totalSteps) * 100 : 0}%`,
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
      <div className="border-b border-border/50 bg-secondary/30 backdrop-blur-sm relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <KpiDisplay
            services={services}
            totalOutagesPrevented={totalOutagesPrevented}
            simulationCycles={simulationCycles}
          />
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full relative z-10">
        {/* SECTION 1: Topology + Latency Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6"
        >
          <div className="lg:col-span-3">
            <Card className="surface-card rounded-2xl h-full">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Activity className="size-4 text-orange-500" />
                  Service Topology
                  <span className="text-[10px] text-muted-foreground ml-auto font-normal">
                    Real-time health · Data flow
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ServiceTopology services={services} chaosEnabled={chaosEnabled} />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="surface-card rounded-2xl h-full">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Gauge className="size-4 text-amber-500" />
                  Latency
                  <span className="text-[10px] text-muted-foreground font-normal">60s window</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] ml-auto text-muted-foreground border-border"
                  >
                    {services.length} services
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <LatencyChart latencyHistory={latencyHistory} services={services} />
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {SERVICE_NAMES.map((name) => {
                    const svc = services.find((s) => s.name === name)
                    const meta = SERVICE_META[name]
                    return (
                      <div key={name} className="flex items-center gap-1.5 text-[10px]">
                        <div className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="text-muted-foreground">{name.replace('Service', '')}</span>
                        {svc && (
                          <span className="text-foreground/60 font-mono tabular-nums">
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

        {/* SECTION 3: Log + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <LiveLog logs={logs} />
          </div>

          <div className="space-y-4">
            {/* Disaster Controls */}
            <Card className="surface-card rounded-2xl">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Skull className="size-4 text-red-500" />
                  Disaster Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="destructive"
                    className="w-full gap-2 shadow-lg shadow-red-500/20"
                    onClick={handleTriggerPartition}
                  >
                    <WifiOff className="size-4" />
                    Trigger Network Partition
                  </Button>
                </motion.div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Affects all three microservices simultaneously. Self-healing initiates within 15 seconds per service.
                </p>
              </CardContent>
            </Card>

            {/* Targeted Chaos Injection */}
            <Card className="surface-card rounded-2xl">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Flame className="size-4 text-orange-500" />
                  Targeted Injection
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {SERVICE_NAMES.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-[100px] shrink-0 truncate font-medium">
                      {name.replace('Service', '')}
                    </span>
                    <div className="flex gap-1 flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => handleInjectAnomaly(name, '500_ERROR')}
                      >
                        500
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        onClick={() => handleInjectAnomaly(name, 'LATENCY_SPIKE')}
                      >
                        Latency
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7 px-2 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => handleInjectAnomaly(name, 'SERVICE_CRASH')}
                      >
                        Crash
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Simulation Status */}
            <Card className="surface-card rounded-2xl">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Activity className="size-4 text-sky-500" />
                  Engine Status
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="stat-cell">
                    <div className="text-[10px] text-muted-foreground font-medium">Chaos Interval</div>
                    <div className="text-foreground font-mono tabular-nums font-semibold">30s</div>
                  </div>
                  <div className="stat-cell">
                    <div className="text-[10px] text-muted-foreground font-medium">Healing Check</div>
                    <div className="text-foreground font-mono tabular-nums font-semibold">5s</div>
                  </div>
                  <div className="stat-cell">
                    <div className="text-[10px] text-muted-foreground font-medium">Recovery Target</div>
                    <div className="text-foreground font-mono tabular-nums font-semibold">{'<15s'}</div>
                  </div>
                  <div className="stat-cell">
                    <div className="text-[10px] text-muted-foreground font-medium">Latency Sample</div>
                    <div className="text-foreground font-mono tabular-nums font-semibold">1s</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-secondary/50 border border-border/50">
                  <span className="text-muted-foreground font-medium">State</span>
                  <span className={`font-bold tabular-nums ${chaosEnabled ? 'text-orange-500' : 'text-muted-foreground'}`}>
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
      <footer className="glass-panel border-t border-border/50 py-3 mt-auto relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <span className="font-medium">Chaos Simulator v2.0 — Client-Side Edition</span>
          <span className="text-emerald-600 dark:text-emerald-500/70 font-medium">Simulation running locally</span>
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
function ServiceCardSkeleton({ name, index }: { name: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="surface-card rounded-2xl">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-secondary animate-pulse" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">{name}</CardTitle>
              <div className="text-[11px] text-muted-foreground">Initializing...</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="h-32 flex items-center justify-center text-muted-foreground text-xs gap-2">
            <RefreshCw className="size-3 animate-spin" />
            Booting engine...
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
