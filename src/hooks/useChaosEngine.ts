'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ServiceData,
  LogEvent,
  AnomalyType,
  LatencySample,
  AnomalyHistoryEntry,
  ScenarioStep,
} from '@/lib/chaos-types'

// ============================================================
// CONSTANTS
// ============================================================

const SERVICES_CONFIG = [
  { name: 'AuthService', baselineLatencyMs: 45, baseRequestVolume: 1200 },
  { name: 'PaymentService', baselineLatencyMs: 78, baseRequestVolume: 850 },
  { name: 'InventoryService', baselineLatencyMs: 32, baseRequestVolume: 2100 },
] as const

const ANOMALY_TYPES: AnomalyType[] = ['500_ERROR', 'LATENCY_SPIKE', 'SERVICE_CRASH']

const MAX_LATENCY_SAMPLES = 60
const MAX_LOG_ENTRIES = 200
const MAX_ANOMALY_HISTORY = 200

// ============================================================
// HELPERS
// ============================================================

function uid(): string {
  return Math.random().toString(36).slice(2, 11)
}

// ============================================================
// HOOK
// ============================================================

export function useChaosEngine() {
  // --- State ---
  const [services, setServices] = useState<ServiceData[]>(() =>
    SERVICES_CONFIG.map((cfg) => ({
      name: cfg.name,
      health: 'Healthy' as const,
      latencyMs: cfg.baselineLatencyMs,
      baselineLatencyMs: cfg.baselineLatencyMs,
      requestVolume: cfg.baseRequestVolume,
      outagesPrevented: 0,
      isCrashed: false,
      anomaly: null,
    }))
  )

  const [latencyHistory, setLatencyHistory] = useState<Record<string, LatencySample[]>>(() => {
    const now = Date.now()
    const map: Record<string, LatencySample[]> = {}
    for (const cfg of SERVICES_CONFIG) {
      const samples: LatencySample[] = []
      for (let i = MAX_LATENCY_SAMPLES - 1; i >= 0; i--) {
        const ts = now - i * 1000
        const jitter = Math.floor(Math.random() * 12 - 6)
        samples.push({
          timestamp: ts,
          latencyMs: Math.max(1, cfg.baselineLatencyMs + jitter),
          baselineLatencyMs: cfg.baselineLatencyMs,
        })
      }
      map[cfg.name] = samples
    }
    return map
  })

  const [anomalyHistory, setAnomalyHistory] = useState<AnomalyHistoryEntry[]>([])
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [chaosEnabled, setChaosEnabled] = useState(true)
  const [activeScenario, setActiveScenario] = useState<{
    name: string
    currentStep: number
    totalSteps: number
  } | null>(null)

  // --- Refs for mutable state that intervals read/write without re-render ---
  const chaosEnabledRef = useRef(chaosEnabled)
  chaosEnabledRef.current = chaosEnabled

  // Track when each service's anomaly started (not in ServiceData to keep types clean)
  const anomalyStartTimesRef = useRef<Map<string, number>>(new Map())

  // ============================================================
  // LOG SYSTEM
  // ============================================================

  const pushLog = useCallback(
    (level: LogEvent['level'], service: string, message: string): LogEvent => {
      const entry: LogEvent = {
        id: uid(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level,
        service,
        message,
      }
      setLogs((prev) => {
        const next = [...prev, entry]
        if (next.length > MAX_LOG_ENTRIES) next.shift()
        return next
      })
      return entry
    },
    []
  )

  // ============================================================
  // ANOMALY HISTORY
  // ============================================================

  const pushAnomalyStart = useCallback(
    (
      serviceName: string,
      type: AnomalyType,
      triggeredBy: 'auto' | 'manual' | 'scenario' = 'auto'
    ): AnomalyHistoryEntry => {
      const entry: AnomalyHistoryEntry = {
        id: uid(),
        serviceName,
        type,
        startedAt: Date.now(),
        resolvedAt: null,
        recoveryTimeMs: null,
        triggeredBy,
      }
      setAnomalyHistory((prev) => {
        const next = [...prev, entry]
        if (next.length > MAX_ANOMALY_HISTORY) next.shift()
        return next
      })
      return entry
    },
    []
  )

  const markAnomalyResolved = useCallback((serviceName: string) => {
    setAnomalyHistory((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].serviceName === serviceName && next[i].resolvedAt === null) {
          next[i] = {
            ...next[i],
            resolvedAt: Date.now(),
            recoveryTimeMs: Date.now() - next[i].startedAt,
          }
          return next
        }
      }
      return prev
    })
  }, [])

  // ============================================================
  // LATENCY SAMPLER
  // ============================================================

  const sampleAllLatencies = useCallback(() => {
    setServices((current) => {
      setLatencyHistory((prev) => {
        const next = { ...prev }
        for (const svc of current) {
          const baseLatency = svc.isCrashed ? 0 : svc.latencyMs
          const jitter = svc.health === 'Healthy' ? Math.floor(Math.random() * 8 - 4) : 0
          const sample: LatencySample = {
            timestamp: Date.now(),
            latencyMs: Math.max(0, baseLatency + jitter),
            baselineLatencyMs: svc.baselineLatencyMs,
          }
          const arr = [...(next[svc.name] || [])]
          arr.push(sample)
          if (arr.length > MAX_LATENCY_SAMPLES) arr.shift()
          next[svc.name] = arr
        }
        return next
      })
      return current // don't trigger re-render for services
    })
  }, [])

  // ============================================================
  // CHAOS INJECTOR
  // ============================================================

  const injectAnomaly = useCallback(
    (
      serviceName?: string,
      type?: AnomalyType,
      triggeredBy: 'auto' | 'manual' | 'scenario' = 'auto'
    ) => {
      const target =
        serviceName ||
        SERVICES_CONFIG[Math.floor(Math.random() * SERVICES_CONFIG.length)].name

      const anomalyType = type || ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)]
      pushAnomalyStart(target, anomalyType, triggeredBy)

      // Record anomaly start time for healing logic
      anomalyStartTimesRef.current.set(target, Date.now())

      setServices((prev) => {
        const next = prev.map((svc) => {
          if (svc.name !== target) return svc
          if (svc.health !== 'Healthy' && !type) return svc

          let updated: ServiceData = {
            ...svc,
            anomaly: anomalyType,
          }

          switch (anomalyType) {
            case '500_ERROR': {
              const errorRate = Math.floor(Math.random() * 60) + 40
              updated = {
                ...updated,
                health: 'Down',
                anomaly: anomalyType,
              }
              pushLog(
                'CRITICAL',
                target,
                `HTTP 500 Internal Server Error — ${errorRate}% of requests failing. Service marked DOWN.`
              )
              break
            }
            case 'LATENCY_SPIKE': {
              const spikeLatency = Math.floor(Math.random() * 4000) + 2000
              updated = {
                ...updated,
                health: 'Degraded',
                latencyMs: spikeLatency,
                anomaly: anomalyType,
              }
              pushLog(
                'CRITICAL',
                target,
                `Latency spiked to ${spikeLatency}ms (baseline: ${svc.baselineLatencyMs}ms). Service DEGRADED.`
              )
              break
            }
            case 'SERVICE_CRASH': {
              updated = {
                ...updated,
                health: 'Down',
                isCrashed: true,
                latencyMs: 0,
                requestVolume: 0,
                anomaly: anomalyType,
              }
              pushLog(
                'CRITICAL',
                target,
                `Service CRASHED — process terminated unexpectedly. All traffic halted.`
              )
              break
            }
            case 'NETWORK_PARTITION': {
              updated = {
                ...updated,
                health: 'Down',
                isCrashed: true,
                latencyMs: 0,
                requestVolume: 0,
                anomaly: anomalyType,
              }
              pushLog(
                'CRITICAL',
                target,
                `MASSIVE NETWORK PARTITION — complete connectivity loss. Service unreachable.`
              )
              break
            }
          }

          return updated
        })
        return next
      })
    },
    [pushAnomalyStart, pushLog]
  )

  // ============================================================
  // SELF-HEALING RECOVERY WORKER
  // ============================================================

  const runSelfHealingCycle = useCallback(() => {
    setServices((prev) => {
      let changed = false
      const now = Date.now()
      const next = prev.map((svc) => {
        if (svc.health === 'Healthy') {
          // Jitter healthy services
          const jitterLatency = Math.max(1, svc.baselineLatencyMs + Math.floor(Math.random() * 20 - 10))
          const jitterVolume = Math.max(100, svc.requestVolume + Math.floor(Math.random() * 60 - 30))
          if (jitterLatency !== svc.latencyMs || jitterVolume !== svc.requestVolume) changed = true
          return { ...svc, latencyMs: jitterLatency, requestVolume: jitterVolume }
        }

        // Check if enough time has passed for healing (8-15s)
        const startedAt = anomalyStartTimesRef.current.get(svc.name)
        if (!startedAt) return svc
        const anomalyAge = now - startedAt
        const healThreshold = 8000 + Math.random() * 7000
        if (anomalyAge < healThreshold) return svc

        // Heal the service
        changed = true
        const prevAnomaly = svc.anomaly
        const cfg = SERVICES_CONFIG.find((c) => c.name === svc.name)!

        // Clear anomaly start time
        anomalyStartTimesRef.current.delete(svc.name)

        const recoveryMsg =
          prevAnomaly === 'SERVICE_CRASH'
            ? `Self-healing worker successfully recycled worker pool. Service restarted and healthy.`
            : prevAnomaly === 'NETWORK_PARTITION'
            ? `Self-healing worker re-established network routes. Connectivity restored.`
            : prevAnomaly === '500_ERROR'
            ? `Self-healing worker performed automatic failover. Error rate normalized.`
            : `Self-healing worker scaled resources and restored baseline latency.`

        pushLog('RESOLVED', svc.name, recoveryMsg)
        markAnomalyResolved(svc.name)

        return {
          ...svc,
          health: 'Healthy' as const,
          latencyMs: cfg.baselineLatencyMs,
          isCrashed: false,
          requestVolume: cfg.baseRequestVolume + Math.floor(Math.random() * 200 - 100),
          outagesPrevented: svc.outagesPrevented + 1,
          anomaly: null,
        }
      })
      return changed ? next : prev
    })
  }, [pushLog, markAnomalyResolved])

  // ============================================================
  // TRAFFIC SIMULATOR
  // ============================================================

  const simulateTraffic = useCallback(() => {
    setServices((prev) =>
      prev.map((svc) => {
        if (svc.health === 'Healthy') {
          return {
            ...svc,
            requestVolume: Math.max(50, svc.requestVolume + Math.floor(Math.random() * 80 - 40)),
          }
        } else if (svc.health === 'Degraded') {
          return {
            ...svc,
            requestVolume: Math.max(20, svc.requestVolume - Math.floor(Math.random() * 50)),
          }
        }
        return svc
      })
    )
  }, [])

  // ============================================================
  // SCENARIO RUNNER
  // ============================================================

  const activeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map())

  const runScenario = useCallback(
    (name: string, steps: ScenarioStep[]) => {
      const scenarioId = uid()
      const timers: ReturnType<typeof setTimeout>[] = []

      pushLog('WARN', 'ChaosEngine', `SCENARIO STARTED: "${name}" — ${steps.length} step(s) queued.`)

      let stepIndex = 0
      for (const step of steps) {
        const t = setTimeout(() => {
          stepIndex++
          pushLog(
            'INFO',
            'ChaosEngine',
            `Scenario step ${stepIndex}/${steps.length}: inject ${step.type} on ${step.service}`
          )
          setActiveScenario({
            name,
            currentStep: stepIndex,
            totalSteps: steps.length,
          })
          injectAnomaly(step.service, step.type, 'scenario')
        }, step.delayMs)
        timers.push(t)
      }

      // Completion notification
      const totalDuration = steps.reduce((sum, s) => sum + s.delayMs, 0) + 2000
      const completionTimer = setTimeout(() => {
        pushLog(
          'INFO',
          'ChaosEngine',
          `SCENARIO COMPLETE: "${name}" — all ${steps.length} step(s) executed.`
        )
        setTimeout(() => setActiveScenario(null), 3000)
      }, totalDuration)
      timers.push(completionTimer)

      activeTimersRef.current.set(scenarioId, timers)
    },
    [pushLog, injectAnomaly]
  )

  // ============================================================
  // USER ACTIONS
  // ============================================================

  const handleManualRestart = useCallback(
    (serviceName: string) => {
      setServices((prev) =>
        prev.map((svc) => {
          if (svc.name !== serviceName) return svc
          const wasAnomalous = svc.anomaly !== null
          if (wasAnomalous) markAnomalyResolved(serviceName)
          const cfg = SERVICES_CONFIG.find((c) => c.name === serviceName)!
          pushLog(
            'INFO',
            serviceName,
            `Manual restart triggered by operator. Service forcefully recycled and restored to HEALTHY.`
          )
          return {
            ...svc,
            health: 'Healthy' as const,
            latencyMs: cfg.baselineLatencyMs,
            isCrashed: false,
            requestVolume: cfg.baseRequestVolume,
            anomaly: null,
          }
        })
      )
    },
    [pushLog, markAnomalyResolved]
  )

  const handleTriggerPartition = useCallback(() => {
    pushLog(
      'WARN',
      'ChaosEngine',
      `OPERATOR TRIGGERED: Massive Network Partition — all services affected!`
    )
    for (const cfg of SERVICES_CONFIG) {
      injectAnomaly(cfg.name, 'NETWORK_PARTITION', 'manual')
    }
  }, [pushLog, injectAnomaly])

  const handleToggleChaos = useCallback((enabled: boolean) => {
    setChaosEnabled(enabled)
    pushLog(
      'INFO',
      'ChaosEngine',
      `Chaos Injector Engine ${enabled ? 'ENABLED' : 'DISABLED'} by operator.`
    )
  }, [pushLog])

  // ============================================================
  // INTERVALS — Start/Stop lifecycle
  // ============================================================

  useEffect(() => {
    // Initial log entries
    pushLog('INFO', 'ChaosEngine', 'System initialized. All 3 microservices reporting HEALTHY.')
    pushLog(
      'INFO',
      'ChaosEngine',
      'Self-healing recovery worker online. Monitoring service health every 5 seconds.'
    )
    pushLog(
      'INFO',
      'ChaosEngine',
      'Chaos Injector Engine armed. First random anomaly in 30 seconds.'
    )

    const chaosInterval = setInterval(() => {
      if (chaosEnabledRef.current) {
        injectAnomaly()
      }
    }, 30000)

    const healerInterval = setInterval(() => {
      runSelfHealingCycle()
    }, 5000)

    const trafficInterval = setInterval(() => {
      simulateTraffic()
    }, 4000)

    const latencyInterval = setInterval(() => {
      sampleAllLatencies()
    }, 1000)

    return () => {
      clearInterval(chaosInterval)
      clearInterval(healerInterval)
      clearInterval(trafficInterval)
      clearInterval(latencyInterval)
      // Clear any active scenario timers
      for (const timers of activeTimersRef.current.values()) {
        timers.forEach(clearTimeout)
      }
      activeTimersRef.current.clear()
    }
  }, [injectAnomaly, runSelfHealingCycle, simulateTraffic, sampleAllLatencies, pushLog])

  // ============================================================
  // DERIVED STATE
  // ============================================================

  const totalOutagesPrevented = services.reduce((sum, s) => sum + s.outagesPrevented, 0)

  return {
    // State
    services,
    logs,
    latencyHistory,
    anomalyHistory,
    chaosEnabled,
    activeScenario,
    totalOutagesPrevented,

    // Actions
    setChaosEnabled: handleToggleChaos,
    manualRestart: handleManualRestart,
    triggerPartition: handleTriggerPartition,
    injectAnomaly,
    runScenario,
  }
}
