// SoundManager — Web Audio API based sound effects for chaos events.
// Generates short synthesized tones without needing any audio files.

type SoundType = 'critical' | 'warning' | 'resolved' | 'click' | 'alarm'

class SoundManagerClass {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private enabled = true

  constructor() {
    if (typeof window !== 'undefined') {
      // Defer AudioContext creation until first user interaction
      // (browsers block autoplay until user has interacted with the page).
    }
  }

  private ensureContext() {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new AudioCtx()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.value = 0.18
        this.masterGain.connect(this.ctx.destination)
      } catch {
        return null
      }
    }
    // Resume if suspended (autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isEnabled() {
    return this.enabled
  }

  private playTone(
    freq: number,
    durationMs: number,
    type: OscillatorType = 'sine',
    delayMs = 0,
    gain = 1
  ) {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain || !this.enabled) return

    const startAt = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    env.gain.setValueAtTime(0, startAt)
    env.gain.linearRampToValueAtTime(gain, startAt + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000)
    osc.connect(env)
    env.connect(this.masterGain)
    osc.start(startAt)
    osc.stop(startAt + durationMs / 1000 + 0.02)
  }

  play(sound: SoundType) {
    if (!this.enabled) return
    switch (sound) {
      case 'critical':
        // Descending two-tone alarm
        this.playTone(880, 220, 'square', 0, 0.7)
        this.playTone(440, 320, 'square', 180, 0.7)
        this.playTone(220, 480, 'sawtooth', 360, 0.5)
        break
      case 'warning':
        this.playTone(660, 180, 'triangle', 0, 0.6)
        this.playTone(660, 180, 'triangle', 220, 0.6)
        break
      case 'alarm':
        // Rapid siren
        for (let i = 0; i < 4; i++) {
          this.playTone(700 + i * 80, 120, 'sawtooth', i * 180, 0.5)
          this.playTone(500 - i * 40, 120, 'sawtooth', i * 180 + 90, 0.5)
        }
        break
      case 'resolved':
        // Pleasant rising arpeggio
        this.playTone(523, 140, 'sine', 0, 0.6)
        this.playTone(659, 140, 'sine', 100, 0.6)
        this.playTone(784, 220, 'sine', 200, 0.6)
        break
      case 'click':
        this.playTone(440, 60, 'sine', 0, 0.3)
        break
    }
  }
}

// Singleton
export const soundManager = new SoundManagerClass()
