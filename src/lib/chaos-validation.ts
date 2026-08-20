export const ALLOWED_SERVICES = new Set(['AuthService', 'PaymentService', 'InventoryService'])

export const ALLOWED_ANOMALIES = new Set([
  '500_ERROR',
  'LATENCY_SPIKE',
  'SERVICE_CRASH',
  'NETWORK_PARTITION',
] as const)

export type AllowedAnomaly = '500_ERROR' | 'LATENCY_SPIKE' | 'SERVICE_CRASH' | 'NETWORK_PARTITION'

export const MAX_SCENARIO_NAME_LEN = 80
export const MAX_SCENARIO_STEPS = 12
export const MAX_STEP_DELAY_MS = 120_000
export const MAX_SCENARIO_ID_LEN = 32

export function isAllowedService(name: unknown): name is string {
  return typeof name === 'string' && ALLOWED_SERVICES.has(name)
}

export function isAllowedAnomaly(type: unknown): type is AllowedAnomaly {
  return typeof type === 'string' && (ALLOWED_ANOMALIES as Set<string>).has(type)
}

export function sanitizeScenarioName(name: unknown): string {
  if (typeof name !== 'string') return 'Custom Scenario'
  const trimmed = name.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (!trimmed) return 'Custom Scenario'
  return trimmed.slice(0, MAX_SCENARIO_NAME_LEN)
}

export interface ParsedScenarioStep {
  delayMs: number
  service: string
  type: AllowedAnomaly
}

export function parseScenarioSteps(raw: unknown): ParsedScenarioStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SCENARIO_STEPS) return null
  const steps: ParsedScenarioStep[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const step = item as Record<string, unknown>
    if (!isAllowedService(step.service) || !isAllowedAnomaly(step.type)) return null
    const delayMs = Number(step.delayMs)
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > MAX_STEP_DELAY_MS) return null
    steps.push({
      delayMs: Math.floor(delayMs),
      service: step.service,
      type: step.type,
    })
  }
  return steps
}

export function isValidScenarioId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_SCENARIO_ID_LEN
}
