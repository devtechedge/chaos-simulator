import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'

// Catch all unhandled errors so we can log them instead of silently dying
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err)
})

// ============================================================
// TYPES & INTERFACES
// ============================================================

type HealthStatus = 'Healthy' | 'Degraded' | 'Down'
type AnomalyType = '500_ERROR' | 'LATENCY_SPIKE' | 'SERVICE_CRASH' | 'NETWORK_PARTITION'

interface MicroserviceState {
  name: string
  health: HealthStatus
  latencyMs: number
  baselineLatencyMs: number
  requestVolume: number
  outagesPrevented: number
  isCrashed: boolean
  anomaly: AnomalyType | null
  anomalyStartedAt: number | null
}

interface LogEvent {
  id: string
  timestamp: string
  level: 'INFO' | 'WARN' | 'CRITICAL' | 'RESOLVED'
  service: string
  message: string
}

interface LatencySample {
  timestamp: number
  latencyMs: number
  baselineLatencyMs: number
}

interface AnomalyHistoryEntry {
  id: string
  serviceName: string
  type: AnomalyType
  startedAt: number
  resolvedAt: number | null
  recoveryTimeMs: number | null
  triggeredBy: 'auto' | 'manual' | 'scenario'
}

interface ScenarioStep {
  delayMs: number
  service: string
  type: AnomalyType
}

interface Scenario {
  id: string
  name: string
  steps: ScenarioStep[]
}

// ============================================================
// SERVICE REGISTRY — 3 mock target microservices
// ============================================================

const SERVICES_CONFIG = [
  { name: 'AuthService', baselineLatencyMs: 45, baseRequestVolume: 1200 },
  { name: 'PaymentService', baselineLatencyMs: 78, baseRequestVolume: 850 },
  { name: 'InventoryService', baselineLatencyMs: 32, baseRequestVolume: 2100 },
]

const services: Map<string, MicroserviceState> = new Map()

function initServices() {
  for (const cfg of SERVICES_CONFIG) {
    services.set(cfg.name, {
      name: cfg.name,
      health: 'Healthy',
      latencyMs: cfg.baselineLatencyMs,
      baselineLatencyMs: cfg.baselineLatencyMs,
      requestVolume: cfg.baseRequestVolume,
      outagesPrevented: 0,
      isCrashed: false,
      anomaly: null,
      anomalyStartedAt: null,
    })
  }
}

initServices()

// ============================================================
// LATENCY HISTORY (time-series, 60s window)
// ============================================================

const MAX_LATENCY_SAMPLES = 60
const latencyHistory: Map<string, LatencySample[]> = new Map()

function initLatencyHistory() {
  const now = Date.now()
  for (const cfg of SERVICES_CONFIG) {
    const samples: LatencySample[] = []
    // Seed 60 samples (one per second going back in time)
    for (let i = MAX_LATENCY_SAMPLES - 1; i >= 0; i--) {
      const ts = now - i * 1000
      const jitter = Math.floor(Math.random() * 12 - 6)
      samples.push({
        timestamp: ts,
        latencyMs: Math.max(1, cfg.baselineLatencyMs + jitter),
        baselineLatencyMs: cfg.baselineLatencyMs,
      })
    }
    latencyHistory.set(cfg.name, samples)
  }
}

initLatencyHistory()

function pushLatencySample(serviceName: string, latencyMs: number, baselineLatencyMs: number) {
  const arr = latencyHistory.get(serviceName)
  if (!arr) return
  arr.push({ timestamp: Date.now(), latencyMs, baselineLatencyMs })
  if (arr.length > MAX_LATENCY_SAMPLES) arr.shift()
}

function sampleAllLatencies() {
  for (const [name, svc] of services) {
    // Use current service latency (which may be spiked) with small jitter
    const baseLatency = svc.isCrashed ? 0 : svc.latencyMs
    const jitter = svc.health === 'Healthy' ? Math.floor(Math.random() * 8 - 4) : 0
    pushLatencySample(name, Math.max(0, baseLatency + jitter), svc.baselineLatencyMs)
  }
  io.emit('latency-sample', {
    services: Array.from(latencyHistory.entries()).map(([name, samples]) => ({
      serviceName: name,
      samples,
    })),
    timestamp: Date.now(),
  })
}

// ============================================================
// ANOMALY HISTORY (full timeline of all anomaly events)
// ============================================================

const anomalyHistory: AnomalyHistoryEntry[] = []
const MAX_ANOMALY_HISTORY = 200

function pushAnomalyStart(
  serviceName: string,
  type: AnomalyType,
  triggeredBy: 'auto' | 'manual' | 'scenario' = 'auto'
): AnomalyHistoryEntry {
  const entry: AnomalyHistoryEntry = {
    id: Math.random().toString(36).slice(2, 11),
    serviceName,
    type,
    startedAt: Date.now(),
    resolvedAt: null,
    recoveryTimeMs: null,
    triggeredBy,
  }
  anomalyHistory.push(entry)
  if (anomalyHistory.length > MAX_ANOMALY_HISTORY) anomalyHistory.shift()
  return entry
}

function markAnomalyResolved(serviceName: string) {
  // Find the most recent unresolved anomaly for this service
  for (let i = anomalyHistory.length - 1; i >= 0; i--) {
    const entry = anomalyHistory[i]
    if (entry.serviceName === serviceName && entry.resolvedAt === null) {
      entry.resolvedAt = Date.now()
      entry.recoveryTimeMs = entry.resolvedAt - entry.startedAt
      io.emit('anomaly-update', entry)
      return entry
    }
  }
  return null
}

// ============================================================
// LOG EVENT SYSTEM
// ============================================================

const eventLog: LogEvent[] = []
const MAX_LOG_ENTRIES = 200

function pushLog(level: LogEvent['level'], service: string, message: string): LogEvent {
  const now = new Date()
  const entry: LogEvent = {
    id: Math.random().toString(36).slice(2, 11),
    timestamp: now.toLocaleTimeString('en-US', { hour12: false }),
    level,
    service,
    message,
  }
  eventLog.push(entry)
  if (eventLog.length > MAX_LOG_ENTRIES) eventLog.shift()
  return entry
}

// ============================================================
// HTTP REQUEST HANDLER (REST API)
// ============================================================

function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }

  if (req.url?.startsWith('/api/telemetry')) {
    const snapshot = getTelemetrySnapshot()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ services: snapshot, timestamp: Date.now() }))
    return true
  }

  if (req.url?.startsWith('/api/anomalies')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ anomalies: anomalyHistory, timestamp: Date.now() }))
    return true
  }

  if (req.url?.startsWith('/api/latency-history')) {
    const data = Array.from(latencyHistory.entries()).map(([name, samples]) => ({
      serviceName: name,
      samples,
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ services: data, timestamp: Date.now() }))
    return true
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
    return true
  }

  return false
}

const httpServer = createServer((req, res) => {
  if (!handleHttpRequest(req, res)) {
    if (!req.url?.startsWith('/socket.io/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
    }
  }
})

// ============================================================
// SOCKET.IO
// ============================================================

const io = new SocketIOServer(httpServer, {
  path: '/socket.io/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowRequest: (req, callback) => {
    if (req.url?.startsWith('/api/') || req.url === '/health') {
      callback(null, false)
      return
    }
    callback(null, true)
  },
})

// ============================================================
// URL NORMALIZER — runs BEFORE socket.io's request handler.
// Next.js proxy strips trailing slashes from /socket.io/ to /socket.io,
// which socket.io rejects. We normalize the URL back before socket.io
// sees it. We use prependListener so our handler runs before engine.io's.
// ============================================================

function normalizeSocketIoUrl(req: IncomingMessage) {
  if (req.url === '/socket.io' || req.url?.startsWith('/socket.io?')) {
    req.url = req.url.replace(/^\/socket\.io(\?|$)/, '/socket.io/$1')
  }
}

httpServer.prependListener('request', (req: IncomingMessage, _res: ServerResponse) => {
  normalizeSocketIoUrl(req)
})

httpServer.prependListener('upgrade', (req: IncomingMessage, _socket, _head) => {
  normalizeSocketIoUrl(req)
})

// ============================================================
// TELEMETRY SNAPSHOT HELPER
// ============================================================

function getTelemetrySnapshot() {
  return Array.from(services.values()).map((s) => ({
    name: s.name,
    health: s.health,
    latencyMs: s.latencyMs,
    baselineLatencyMs: s.baselineLatencyMs,
    requestVolume: s.requestVolume,
    outagesPrevented: s.outagesPrevented,
    isCrashed: s.isCrashed,
    anomaly: s.anomaly,
  }))
}

function broadcastState() {
  const snapshot = getTelemetrySnapshot()
  io.emit('telemetry', { services: snapshot, timestamp: Date.now() })
}

function broadcastLog(entry: LogEvent) {
  io.emit('log', entry)
}

// ============================================================
// CHAOS INJECTOR ENGINE — every 30 seconds
// ============================================================

const ANOMALY_TYPES: AnomalyType[] = ['500_ERROR', 'LATENCY_SPIKE', 'SERVICE_CRASH']
const SERVICE_NAMES = SERVICES_CONFIG.map((s) => s.name)

let chaosInterval: ReturnType<typeof setInterval> | null = null
let chaosEnabled = true

function injectAnomaly(
  serviceName?: string,
  type?: AnomalyType,
  triggeredBy: 'auto' | 'manual' | 'scenario' = 'auto'
) {
  const target = serviceName || SERVICE_NAMES[Math.floor(Math.random() * SERVICE_NAMES.length)]
  const svc = services.get(target)
  if (!svc) return

  if (svc.health !== 'Healthy' && !type) return

  const anomalyType = type || ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)]
  svc.anomaly = anomalyType
  svc.anomalyStartedAt = Date.now()

  // Record anomaly start in history
  pushAnomalyStart(target, anomalyType, triggeredBy)

  switch (anomalyType) {
    case '500_ERROR': {
      svc.health = 'Down'
      const errorRate = Math.floor(Math.random() * 60) + 40
      const log = pushLog(
        'CRITICAL',
        target,
        `HTTP 500 Internal Server Error — ${errorRate}% of requests failing. Service marked DOWN.`
      )
      broadcastLog(log)
      break
    }
    case 'LATENCY_SPIKE': {
      svc.health = 'Degraded'
      const spikeLatency = Math.floor(Math.random() * 4000) + 2000
      svc.latencyMs = spikeLatency
      const log = pushLog(
        'CRITICAL',
        target,
        `Latency spiked to ${spikeLatency}ms (baseline: ${svc.baselineLatencyMs}ms). Service DEGRADED.`
      )
      broadcastLog(log)
      break
    }
    case 'SERVICE_CRASH': {
      svc.health = 'Down'
      svc.isCrashed = true
      svc.latencyMs = 0
      svc.requestVolume = 0
      const log = pushLog(
        'CRITICAL',
        target,
        `Service CRASHED — process terminated unexpectedly. All traffic halted.`
      )
      broadcastLog(log)
      break
    }
    case 'NETWORK_PARTITION': {
      svc.health = 'Down'
      svc.isCrashed = true
      svc.latencyMs = 0
      svc.requestVolume = 0
      const log = pushLog(
        'CRITICAL',
        target,
        `MASSIVE NETWORK PARTITION — complete connectivity loss. Service unreachable.`
      )
      broadcastLog(log)
      break
    }
  }

  broadcastState()
}

function startChaosLoop() {
  if (chaosInterval) return
  const log = pushLog(
    'INFO',
    'ChaosEngine',
    `Chaos Injector Engine started — injecting anomalies every 30 seconds.`
  )
  broadcastLog(log)
  chaosInterval = setInterval(() => {
    if (!chaosEnabled) return
    injectAnomaly()
  }, 30000)
}

// ============================================================
// SELF-HEALING RECOVERY WORKER — every 5s
// ============================================================

let healerInterval: ReturnType<typeof setInterval> | null = null

function runSelfHealingCycle() {
  for (const [name, svc] of services) {
    if (svc.health === 'Healthy') {
      svc.latencyMs = Math.max(1, svc.baselineLatencyMs + Math.floor(Math.random() * 20 - 10))
      svc.requestVolume = Math.max(
        100,
        svc.requestVolume + Math.floor(Math.random() * 60 - 30)
      )
      continue
    }

    if (
      svc.anomalyStartedAt &&
      Date.now() - svc.anomalyStartedAt >= 8000 + Math.random() * 7000
    ) {
      const prevAnomaly = svc.anomaly
      svc.health = 'Healthy'
      svc.latencyMs = svc.baselineLatencyMs
      svc.isCrashed = false
      svc.requestVolume =
        SERVICES_CONFIG.find((c) => c.name === name)!.baseRequestVolume +
        Math.floor(Math.random() * 200 - 100)
      svc.outagesPrevented += 1
      svc.anomaly = null
      svc.anomalyStartedAt = null

      const recoveryMsg =
        prevAnomaly === 'SERVICE_CRASH'
          ? `Self-healing worker successfully recycled worker pool. Service restarted and healthy.`
          : prevAnomaly === 'NETWORK_PARTITION'
          ? `Self-healing worker re-established network routes. Connectivity restored.`
          : prevAnomaly === '500_ERROR'
          ? `Self-healing worker performed automatic failover. Error rate normalized.`
          : `Self-healing worker scaled resources and restored baseline latency.`

      const log = pushLog('RESOLVED', name, recoveryMsg)
      broadcastLog(log)
      markAnomalyResolved(name)
      broadcastState()
    }
  }
}

function startHealerLoop() {
  if (healerInterval) return
  healerInterval = setInterval(runSelfHealingCycle, 5000)
}

// ============================================================
// REQUEST VOLUME SIMULATION — every 4s
// ============================================================

let volumeInterval: ReturnType<typeof setInterval> | null = null

function simulateTraffic() {
  for (const [, svc] of services) {
    if (svc.health === 'Healthy') {
      svc.requestVolume = Math.max(50, svc.requestVolume + Math.floor(Math.random() * 80 - 40))
    } else if (svc.health === 'Degraded') {
      svc.requestVolume = Math.max(20, svc.requestVolume - Math.floor(Math.random() * 50))
    }
  }
  broadcastState()
}

function startTrafficSimulator() {
  if (volumeInterval) return
  volumeInterval = setInterval(simulateTraffic, 4000)
}

// ============================================================
// LATENCY SAMPLER — every 1s
// ============================================================

let latencyInterval: ReturnType<typeof setInterval> | null = null

function startLatencySampler() {
  if (latencyInterval) return
  latencyInterval = setInterval(sampleAllLatencies, 1000)
}

// ============================================================
// SCENARIO RUNNER — executes a multi-step chaos scenario
// ============================================================

const activeScenarios: Map<string, ReturnType<typeof setInterval>[]> = new Map()

function runScenario(scenario: Scenario) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const scenarioLog = pushLog(
    'WARN',
    'ChaosEngine',
    `SCENARIO STARTED: "${scenario.name}" — ${scenario.steps.length} step(s) queued.`
  )
  broadcastLog(scenarioLog)

  let stepIndex = 0
  for (const step of scenario.steps) {
    const t = setTimeout(() => {
      stepIndex++
      const stepLog = pushLog(
        'INFO',
        'ChaosEngine',
        `Scenario step ${stepIndex}/${scenario.steps.length}: inject ${step.type} on ${step.service}`
      )
      broadcastLog(stepLog)
      io.emit('scenario-step', {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        stepIndex,
        totalSteps: scenario.steps.length,
        service: step.service,
        type: step.type,
        timestamp: Date.now(),
      })
      injectAnomaly(step.service, step.type, 'scenario')
    }, step.delayMs)
    timers.push(t)
  }

  // Final completion notification
  const totalDuration = scenario.steps.reduce((sum, s) => sum + s.delayMs, 0) + 2000
  const completionTimer = setTimeout(() => {
    const doneLog = pushLog(
      'INFO',
      'ChaosEngine',
      `SCENARIO COMPLETE: "${scenario.name}" — all ${scenario.steps.length} step(s) executed.`
    )
    broadcastLog(doneLog)
    io.emit('scenario-complete', {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      timestamp: Date.now(),
    })
  }, totalDuration)
  timers.push(completionTimer)

  // Track timers (we use setTimeout not setInterval; track for potential cancellation)
  const intervalIds = timers as unknown as ReturnType<typeof setInterval>[]
  activeScenarios.set(scenario.id, intervalIds)
}

// ============================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================

io.on('connection', (socket: Socket) => {
  console.log(`[ChaosEngine] Client connected: ${socket.id}`)

  // Send current state immediately
  socket.emit('telemetry', { services: getTelemetrySnapshot(), timestamp: Date.now() })
  socket.emit('log-history', eventLog.slice(-50))

  // Send latency history
  socket.emit('latency-history', {
    services: Array.from(latencyHistory.entries()).map(([name, samples]) => ({
      serviceName: name,
      samples,
    })),
    timestamp: Date.now(),
  })

  // Send anomaly history
  socket.emit('anomaly-history', { anomalies: anomalyHistory, timestamp: Date.now() })

  socket.on('manual-restart', (data: { service: string }) => {
    const svc = services.get(data.service)
    if (!svc) return
    const wasAnomalous = svc.anomaly !== null
    svc.health = 'Healthy'
    svc.latencyMs = svc.baselineLatencyMs
    svc.isCrashed = false
    svc.requestVolume = SERVICES_CONFIG.find((c) => c.name === data.service)!.baseRequestVolume
    svc.anomaly = null
    svc.anomalyStartedAt = null
    if (wasAnomalous) {
      markAnomalyResolved(data.service)
    }
    const log = pushLog(
      'INFO',
      data.service,
      `Manual restart triggered by operator. Service forcefully recycled and restored to HEALTHY.`
    )
    broadcastLog(log)
    broadcastState()
  })

  socket.on('trigger-partition', () => {
    pushLog(
      'WARN',
      'ChaosEngine',
      `OPERATOR TRIGGERED: Massive Network Partition — all services affected!`
    )
    broadcastLog(eventLog[eventLog.length - 1])
    for (const [name] of services) {
      injectAnomaly(name, 'NETWORK_PARTITION', 'manual')
    }
  })

  socket.on('toggle-chaos', (data: { enabled: boolean }) => {
    chaosEnabled = data.enabled
    const log = pushLog(
      'INFO',
      'ChaosEngine',
      `Chaos Injector Engine ${chaosEnabled ? 'ENABLED' : 'DISABLED'} by operator.`
    )
    broadcastLog(log)
  })

  socket.on('inject-anomaly', (data: { service: string; type: AnomalyType }) => {
    injectAnomaly(data.service, data.type, 'manual')
  })

  // NEW: Run a multi-step chaos scenario
  socket.on('run-scenario', (data: { name: string; steps: ScenarioStep[] }) => {
    const scenario: Scenario = {
      id: Math.random().toString(36).slice(2, 11),
      name: data.name || 'Custom Scenario',
      steps: data.steps,
    }
    runScenario(scenario)
    socket.emit('scenario-accepted', { scenarioId: scenario.id, scenarioName: scenario.name })
  })

  // NEW: Cancel a running scenario (best-effort)
  socket.on('cancel-scenario', (data: { scenarioId: string }) => {
    const timers = activeScenarios.get(data.scenarioId)
    if (timers) {
      timers.forEach(clearTimeout)
      activeScenarios.delete(data.scenarioId)
      pushLog('WARN', 'ChaosEngine', `Scenario ${data.scenarioId} cancelled by operator.`)
      broadcastLog(eventLog[eventLog.length - 1])
    }
  })

  socket.on('disconnect', () => {
    console.log(`[ChaosEngine] Client disconnected: ${socket.id}`)
  })

  socket.on('error', (error: Error) => {
    console.error(`[ChaosEngine] Socket error (${socket.id}):`, error)
  })
})

// ============================================================
// STARTUP
// ============================================================

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3030

httpServer.listen(PORT, () => {
  console.log(`\n🜄 Chaos Engine running on port ${PORT}`)
  console.log(`  REST API:  http://localhost:${PORT}/api/telemetry`)
  console.log(`  Anomalies: http://localhost:${PORT}/api/anomalies`)
  console.log(`  Latency:   http://localhost:${PORT}/api/latency-history`)
  console.log(`  Health:    http://localhost:${PORT}/health`)
  console.log(`  WebSocket: ws://localhost:${PORT}/socket.io/`)
  console.log(`\n  Microservices: ${SERVICE_NAMES.join(', ')}`)
  console.log(`  Chaos interval: 30s | Self-healing check: 5s | Latency sample: 1s\n`)

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

  startChaosLoop()
  startHealerLoop()
  startTrafficSimulator()
  startLatencySampler()

  broadcastState()
})

function shutdown() {
  console.log('Shutting down chaos engine...')
  if (chaosInterval) clearInterval(chaosInterval)
  if (healerInterval) clearInterval(healerInterval)
  if (volumeInterval) clearInterval(volumeInterval)
  if (latencyInterval) clearInterval(latencyInterval)
  for (const timers of activeScenarios.values()) {
    timers.forEach(clearTimeout)
  }
  activeScenarios.clear()
  io.close()
  httpServer.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
