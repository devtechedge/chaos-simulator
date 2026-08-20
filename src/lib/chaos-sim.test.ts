import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAnomalyToService,
  restartService,
  healService,
  recoveryMessage,
  appendBounded,
  totalOutagesPrevented,
  nextTrafficVolume,
  latencySampleForService,
  shouldHeal,
  makeHealthyService,
  MAX_LATENCY_SAMPLES,
} from './chaos-sim.ts'

describe('applyAnomalyToService', () => {
  it('marks 500 errors as Down', () => {
    const next = applyAnomalyToService(makeHealthyService(), '500_ERROR')
    assert.equal(next.health, 'Down')
    assert.equal(next.anomaly, '500_ERROR')
    assert.equal(next.isCrashed, false)
  })

  it('applies latency spikes as Degraded with the given spike', () => {
    const next = applyAnomalyToService(makeHealthyService(), 'LATENCY_SPIKE', 2500)
    assert.equal(next.health, 'Degraded')
    assert.equal(next.latencyMs, 2500)
    assert.equal(next.anomaly, 'LATENCY_SPIKE')
  })

  it('crashes and partitions zero traffic', () => {
    for (const type of ['SERVICE_CRASH', 'NETWORK_PARTITION'] as const) {
      const next = applyAnomalyToService(makeHealthyService(), type)
      assert.equal(next.health, 'Down')
      assert.equal(next.isCrashed, true)
      assert.equal(next.latencyMs, 0)
      assert.equal(next.requestVolume, 0)
    }
  })
})

describe('restartService / healService', () => {
  it('restart restores baseline without incrementing outagesPrevented', () => {
    const down = applyAnomalyToService(makeHealthyService(), 'SERVICE_CRASH')
    const up = restartService(down)
    assert.equal(up.health, 'Healthy')
    assert.equal(up.isCrashed, false)
    assert.equal(up.latencyMs, 45)
    assert.equal(up.requestVolume, 1200)
    assert.equal(up.anomaly, null)
    assert.equal(up.outagesPrevented, 0)
  })

  it('heal restores baseline and counts a prevented outage', () => {
    const down = applyAnomalyToService(makeHealthyService(), '500_ERROR')
    const up = healService(down, 10)
    assert.equal(up.health, 'Healthy')
    assert.equal(up.outagesPrevented, 1)
    assert.equal(up.requestVolume, 1210)
    assert.equal(up.anomaly, null)
  })
})

describe('recoveryMessage', () => {
  it('maps each anomaly to a distinct message', () => {
    assert.match(recoveryMessage('SERVICE_CRASH'), /recycled worker pool/)
    assert.match(recoveryMessage('NETWORK_PARTITION'), /network routes/)
    assert.match(recoveryMessage('500_ERROR'), /failover/)
    assert.match(recoveryMessage('LATENCY_SPIKE'), /baseline latency/)
    assert.match(recoveryMessage(null), /baseline latency/)
  })
})

describe('telemetry helpers', () => {
  it('appendBounded drops the oldest sample past the cap', () => {
    const seeded = Array.from({ length: MAX_LATENCY_SAMPLES }, (_, i) => i)
    const next = appendBounded(seeded, 999, MAX_LATENCY_SAMPLES)
    assert.equal(next.length, MAX_LATENCY_SAMPLES)
    assert.equal(next[0], 1)
    assert.equal(next.at(-1), 999)
  })

  it('sums outagesPrevented for the KPI strip', () => {
    assert.equal(
      totalOutagesPrevented([{ outagesPrevented: 2 }, { outagesPrevented: 5 }, { outagesPrevented: 0 }]),
      7
    )
  })

  it('traffic floors: healthy ≥50, degraded ≥20, down unchanged', () => {
    assert.equal(nextTrafficVolume({ health: 'Healthy', requestVolume: 40 }, -100), 50)
    assert.equal(nextTrafficVolume({ health: 'Degraded', requestVolume: 80 }, 90), 20)
    assert.equal(nextTrafficVolume({ health: 'Down', requestVolume: 0 }, 999), 0)
  })

  it('latency sample is 0 when crashed', () => {
    const crashed = applyAnomalyToService(makeHealthyService(), 'SERVICE_CRASH')
    const sample = latencySampleForService(crashed, 1_700_000_000_000, 10)
    assert.equal(sample.latencyMs, 0)
    assert.equal(sample.baselineLatencyMs, 45)
  })

  it('shouldHeal waits for the threshold', () => {
    assert.equal(shouldHeal(1000, 5000, 8000), false)
    assert.equal(shouldHeal(1000, 9000, 8000), true)
    assert.equal(shouldHeal(null, 9000, 8000), false)
  })
})
