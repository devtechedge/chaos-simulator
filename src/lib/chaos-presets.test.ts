import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SCENARIO_PRESETS } from './chaos-presets.ts'
import { SERVICE_NAMES, ANOMALY_LABELS, SERVICE_META } from './chaos-types.ts'
import { isAllowedService, isAllowedAnomaly, parseScenarioSteps } from './chaos-validation.ts'

describe('dashboard catalog', () => {
  it('SERVICE_META covers every SERVICE_NAMES entry', () => {
    for (const name of SERVICE_NAMES) {
      assert.ok(SERVICE_META[name], name)
      assert.ok(SERVICE_META[name].shortName)
    }
  })

  it('ANOMALY_LABELS covers every allowed type', () => {
    for (const type of Object.keys(ANOMALY_LABELS)) {
      assert.equal(isAllowedAnomaly(type), true)
    }
  })
})

describe('scenario presets (builder UI)', () => {
  it('ships four named presets', () => {
    assert.equal(SCENARIO_PRESETS.length, 4)
    const names = SCENARIO_PRESETS.map((p) => p.name)
    assert.deepEqual(names, ['Rolling Thunder', 'Latency Cascade', 'Black Friday', 'Cascading Failure'])
  })

  it('every preset step is a valid engine payload', () => {
    for (const preset of SCENARIO_PRESETS) {
      assert.ok(preset.steps.length >= 1)
      for (const step of preset.steps) {
        assert.equal(isAllowedService(step.service), true, `${preset.name} ${step.service}`)
        assert.equal(isAllowedAnomaly(step.type), true, `${preset.name} ${step.type}`)
        assert.ok(step.delayMs >= 0)
      }
      assert.ok(parseScenarioSteps(preset.steps), preset.name)
    }
  })
})
