// Shared types for the Chaos Simulator dashboard

export type HealthStatus = 'Healthy' | 'Degraded' | 'Down'
export type AnomalyType = '500_ERROR' | 'LATENCY_SPIKE' | 'SERVICE_CRASH' | 'NETWORK_PARTITION'
export type LogLevel = 'INFO' | 'WARN' | 'CRITICAL' | 'RESOLVED'

export interface ServiceData {
  name: string
  health: HealthStatus
  latencyMs: number
  baselineLatencyMs: number
  requestVolume: number
  outagesPrevented: number
  isCrashed: boolean
  anomaly: AnomalyType | null
}

export interface LogEvent {
  id: string
  timestamp: string
  level: LogLevel
  service: string
  message: string
}

export interface LatencySample {
  timestamp: number
  latencyMs: number
  baselineLatencyMs: number
}

export interface LatencyHistoryPayload {
  services: { serviceName: string; samples: LatencySample[] }[]
  timestamp: number
}

export interface AnomalyHistoryEntry {
  id: string
  serviceName: string
  type: AnomalyType
  startedAt: number
  resolvedAt: number | null
  recoveryTimeMs: number | null
  triggeredBy: 'auto' | 'manual' | 'scenario'
}

export interface ScenarioStep {
  delayMs: number
  service: string
  type: AnomalyType
}

export const SERVICE_NAMES = ['AuthService', 'PaymentService', 'InventoryService'] as const

export const SERVICE_META: Record<
  string,
  { color: string; shortName: string; description: string }
> = {
  AuthService: {
    color: '#f59e0b',
    shortName: 'AUTH',
    description: 'Identity & Session Management',
  },
  PaymentService: {
    color: '#10b981',
    shortName: 'PAY',
    description: 'Transaction Processing Gateway',
  },
  InventoryService: {
    color: '#ef4444',
    shortName: 'INV',
    description: 'Stock & Catalog Service',
  },
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  '500_ERROR': 'HTTP 500 Errors',
  LATENCY_SPIKE: 'Latency Spike',
  SERVICE_CRASH: 'Service Crash',
  NETWORK_PARTITION: 'Network Partition',
}

export const ANOMALY_COLORS: Record<AnomalyType, string> = {
  '500_ERROR': '#f97316',
  LATENCY_SPIKE: '#eab308',
  SERVICE_CRASH: '#ef4444',
  NETWORK_PARTITION: '#dc2626',
}
