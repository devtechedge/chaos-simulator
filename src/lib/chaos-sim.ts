import type { AnomalyType, ServiceData, LatencySample } from './chaos-types'

export const SERVICES_CONFIG = [
  { name: 'AuthService', baselineLatencyMs: 45, baseRequestVolume: 1200 },
  { name: 'PaymentService', baselineLatencyMs: 78, baseRequestVolume: 850 },
  { name: 'InventoryService', baselineLatencyMs: 32, baseRequestVolume: 2100 },
] as const

export const MAX_LATENCY_SAMPLES = 60
export const MAX_LOG_ENTRIES = 200
export const MAX_ANOMALY_HISTORY = 200

export function makeHealthyService(
  cfg: (typeof SERVICES_CONFIG)[number] = SERVICES_CONFIG[0]
): ServiceData {
  return {
    name: cfg.name,
    health: 'Healthy',
    latencyMs: cfg.baselineLatencyMs,
    baselineLatencyMs: cfg.baselineLatencyMs,
    requestVolume: cfg.baseRequestVolume,
    outagesPrevented: 0,
    isCrashed: false,
    anomaly: null,
  }
}

export function applyAnomalyToService(
  svc: ServiceData,
  type: AnomalyType,
  spikeLatencyMs?: number
): ServiceData {
  switch (type) {
    case '500_ERROR':
      return { ...svc, health: 'Down', anomaly: type }
    case 'LATENCY_SPIKE': {
      const spike = spikeLatencyMs ?? Math.floor(Math.random() * 4000) + 2000
      return { ...svc, health: 'Degraded', latencyMs: spike, anomaly: type }
    }
    case 'SERVICE_CRASH':
    case 'NETWORK_PARTITION':
      return {
        ...svc,
        health: 'Down',
        isCrashed: true,
        latencyMs: 0,
        requestVolume: 0,
        anomaly: type,
      }
  }
}

export function restartService(svc: ServiceData): ServiceData {
  const cfg = SERVICES_CONFIG.find((c) => c.name === svc.name)
  return {
    ...svc,
    health: 'Healthy',
    latencyMs: cfg?.baselineLatencyMs ?? svc.baselineLatencyMs,
    isCrashed: false,
    requestVolume: cfg?.baseRequestVolume ?? svc.requestVolume,
    anomaly: null,
  }
}

export function healService(svc: ServiceData, volumeJitter = 0): ServiceData {
  const cfg = SERVICES_CONFIG.find((c) => c.name === svc.name)
  const baseline = cfg?.baselineLatencyMs ?? svc.baselineLatencyMs
  const volume = (cfg?.baseRequestVolume ?? svc.requestVolume) + volumeJitter
  return {
    ...svc,
    health: 'Healthy',
    latencyMs: baseline,
    isCrashed: false,
    requestVolume: volume,
    outagesPrevented: svc.outagesPrevented + 1,
    anomaly: null,
  }
}

export function recoveryMessage(prev: AnomalyType | null): string {
  if (prev === 'SERVICE_CRASH') {
    return 'Self-healing worker successfully recycled worker pool. Service restarted and healthy.'
  }
  if (prev === 'NETWORK_PARTITION') {
    return 'Self-healing worker re-established network routes. Connectivity restored.'
  }
  if (prev === '500_ERROR') {
    return 'Self-healing worker performed automatic failover. Error rate normalized.'
  }
  return 'Self-healing worker scaled resources and restored baseline latency.'
}

export function appendBounded<T>(arr: T[], item: T, max: number): T[] {
  const next = [...arr, item]
  if (next.length > max) next.shift()
  return next
}

export function totalOutagesPrevented(services: { outagesPrevented: number }[]): number {
  return services.reduce((sum, s) => sum + s.outagesPrevented, 0)
}

export function nextTrafficVolume(svc: Pick<ServiceData, 'health' | 'requestVolume'>, delta: number): number {
  if (svc.health === 'Healthy') return Math.max(50, svc.requestVolume + delta)
  if (svc.health === 'Degraded') return Math.max(20, svc.requestVolume - Math.abs(delta))
  return svc.requestVolume
}

export function latencySampleForService(
  svc: ServiceData,
  now = Date.now(),
  jitter = 0
): LatencySample {
  const baseLatency = svc.isCrashed ? 0 : svc.latencyMs
  const applied = svc.health === 'Healthy' ? jitter : 0
  return {
    timestamp: now,
    latencyMs: Math.max(0, baseLatency + applied),
    baselineLatencyMs: svc.baselineLatencyMs,
  }
}

export function shouldHeal(startedAt: number | null | undefined, now: number, thresholdMs: number): boolean {
  if (!startedAt) return false
  return now - startedAt >= thresholdMs
}
