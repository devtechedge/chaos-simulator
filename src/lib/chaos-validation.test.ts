import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isAllowedService,
  isAllowedAnomaly,
  sanitizeScenarioName,
  parseScenarioSteps,
  isValidScenarioId,
  MAX_SCENARIO_NAME_LEN,
  MAX_SCENARIO_STEPS,
  MAX_STEP_DELAY_MS,
} from './chaos-validation.ts'

describe('isAllowedService', () => {
  it('accepts the three mock services', () => {
    assert.equal(isAllowedService('AuthService'), true)
    assert.equal(isAllowedService('PaymentService'), true)
    assert.equal(isAllowedService('InventoryService'), true)
  })

  it('rejects unknown or non-string names', () => {
    assert.equal(isAllowedService('auth'), false)
    assert.equal(isAllowedService('AuthService '), false)
    assert.equal(isAllowedService(''), false)
    assert.equal(isAllowedService(null), false)
    assert.equal(isAllowedService({ name: 'AuthService' }), false)
  })
})

describe('isAllowedAnomaly', () => {
  it('accepts known anomaly types', () => {
    assert.equal(isAllowedAnomaly('500_ERROR'), true)
    assert.equal(isAllowedAnomaly('LATENCY_SPIKE'), true)
    assert.equal(isAllowedAnomaly('SERVICE_CRASH'), true)
    assert.equal(isAllowedAnomaly('NETWORK_PARTITION'), true)
  })

  it('rejects unknown types', () => {
    assert.equal(isAllowedAnomaly('CRASH'), false)
    assert.equal(isAllowedAnomaly('500_error'), false)
    assert.equal(isAllowedAnomaly(undefined), false)
  })
})

describe('sanitizeScenarioName', () => {
  it('falls back for non-strings and blank names', () => {
    assert.equal(sanitizeScenarioName(undefined), 'Custom Scenario')
    assert.equal(sanitizeScenarioName('   '), 'Custom Scenario')
    assert.equal(sanitizeScenarioName('\n\t'), 'Custom Scenario')
  })

  it('strips control characters and trims', () => {
    assert.equal(sanitizeScenarioName('  Black Friday\u0000  '), 'Black Friday')
  })

  it('caps length', () => {
    const long = 'x'.repeat(MAX_SCENARIO_NAME_LEN + 40)
    assert.equal(sanitizeScenarioName(long).length, MAX_SCENARIO_NAME_LEN)
  })
})

describe('parseScenarioSteps', () => {
  const ok = [{ delayMs: 0, service: 'AuthService', type: '500_ERROR' }]

  it('accepts a valid step list', () => {
    const parsed = parseScenarioSteps(ok)
    assert.ok(parsed)
    assert.equal(parsed!.length, 1)
    assert.equal(parsed![0].service, 'AuthService')
    assert.equal(parsed![0].delayMs, 0)
  })

  it('floors delayMs', () => {
    const parsed = parseScenarioSteps([{ delayMs: 1500.9, service: 'AuthService', type: 'LATENCY_SPIKE' }])
    assert.equal(parsed![0].delayMs, 1500)
  })

  it('rejects empty, oversized, or malformed payloads', () => {
    assert.equal(parseScenarioSteps([]), null)
    assert.equal(parseScenarioSteps('not-array'), null)
    assert.equal(parseScenarioSteps([{ delayMs: 0, service: 'Nope', type: '500_ERROR' }]), null)
    assert.equal(parseScenarioSteps([{ delayMs: 0, service: 'AuthService', type: 'BOOM' }]), null)
    assert.equal(parseScenarioSteps([{ delayMs: -1, service: 'AuthService', type: '500_ERROR' }]), null)
    assert.equal(
      parseScenarioSteps([{ delayMs: MAX_STEP_DELAY_MS + 1, service: 'AuthService', type: '500_ERROR' }]),
      null
    )
    assert.equal(parseScenarioSteps(new Array(MAX_SCENARIO_STEPS + 1).fill(ok[0])), null)
  })
})

describe('isValidScenarioId', () => {
  it('accepts short ids', () => {
    assert.equal(isValidScenarioId('abc123'), true)
  })
  it('rejects empty or overlong ids', () => {
    assert.equal(isValidScenarioId(''), false)
    assert.equal(isValidScenarioId('x'.repeat(33)), false)
    assert.equal(isValidScenarioId(12), false)
  })
})
