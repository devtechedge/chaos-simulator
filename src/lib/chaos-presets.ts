import type { ScenarioStep } from './chaos-types'

export const SCENARIO_PRESETS: { name: string; description: string; steps: ScenarioStep[] }[] = [
  {
    name: 'Rolling Thunder',
    description: 'Sequential crashes across all services with 5s gaps',
    steps: [
      { delayMs: 0, service: 'AuthService', type: 'SERVICE_CRASH' },
      { delayMs: 5000, service: 'PaymentService', type: 'SERVICE_CRASH' },
      { delayMs: 10000, service: 'InventoryService', type: 'SERVICE_CRASH' },
    ],
  },
  {
    name: 'Latency Cascade',
    description: 'Escalating latency spikes hitting each service in turn',
    steps: [
      { delayMs: 0, service: 'AuthService', type: 'LATENCY_SPIKE' },
      { delayMs: 8000, service: 'PaymentService', type: 'LATENCY_SPIKE' },
      { delayMs: 16000, service: 'InventoryService', type: 'LATENCY_SPIKE' },
    ],
  },
  {
    name: 'Black Friday',
    description: 'Mixed storm: errors + crashes + partitions',
    steps: [
      { delayMs: 0, service: 'PaymentService', type: '500_ERROR' },
      { delayMs: 4000, service: 'InventoryService', type: 'LATENCY_SPIKE' },
      { delayMs: 9000, service: 'AuthService', type: 'NETWORK_PARTITION' },
      { delayMs: 14000, service: 'PaymentService', type: 'SERVICE_CRASH' },
    ],
  },
  {
    name: 'Cascading Failure',
    description: 'Auth fails → payment fails → inventory fails',
    steps: [
      { delayMs: 0, service: 'AuthService', type: '500_ERROR' },
      { delayMs: 3000, service: 'PaymentService', type: 'SERVICE_CRASH' },
      { delayMs: 7000, service: 'InventoryService', type: 'NETWORK_PARTITION' },
    ],
  },
]
