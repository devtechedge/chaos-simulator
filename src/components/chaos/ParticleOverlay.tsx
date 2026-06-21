'use client'

import { useEffect, useRef } from 'react'

// A particle burst overlay that fires whenever a "burst" event is emitted.
// Renders onto a fixed full-screen canvas; particles spawn from the center of
// the screen (or a custom origin) and fade out.

export interface ParticleBurstRequest {
  id: number
  x?: number // default: window center
  y?: number
  color: string
  count?: number
  intensity?: 'normal' | 'big'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

interface Shockwave {
  x: number
  y: number
  radius: number
  maxRadius: number
  life: number
  maxLife: number
  color: string
}

const MAX_PARTICLES = 1200

// Module-level pending bursts queue (so any code can push bursts)
const pendingBursts: ParticleBurstRequest[] = []
let nextBurstId = 1

export function emitParticleBurst(req: Omit<ParticleBurstRequest, 'id'>) {
  pendingBursts.push({ ...req, id: nextBurstId++ })
}

export function ParticleOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const shockwavesRef = useRef<Shockwave[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      // Drain pending bursts
      while (pendingBursts.length > 0) {
        const burst = pendingBursts.shift()!
        const x = burst.x ?? window.innerWidth / 2
        const y = burst.y ?? window.innerHeight / 2
        const count = burst.count ?? (burst.intensity === 'big' ? 80 : 36)
        const isBig = burst.intensity === 'big'

        // Spawn shockwave
        shockwavesRef.current.push({
          x,
          y,
          radius: 8,
          maxRadius: isBig ? 380 : 180,
          life: 1,
          maxLife: 1,
          color: burst.color,
        })

        // Spawn particles
        for (let i = 0; i < count; i++) {
          if (particlesRef.current.length >= MAX_PARTICLES) break
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
          const speed = (isBig ? 4 : 2.5) + Math.random() * (isBig ? 8 : 5)
          const life = 0.7 + Math.random() * 0.6
          particlesRef.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            size: 1.5 + Math.random() * (isBig ? 4 : 2.5),
            color: burst.color,
          })
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'

      // Update + render shockwaves
      const newShockwaves: Shockwave[] = []
      for (const sw of shockwavesRef.current) {
        sw.radius += (sw.maxRadius - sw.radius) * 0.08
        sw.life -= 0.025
        if (sw.life > 0) {
          ctx.beginPath()
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
          ctx.strokeStyle = sw.color
          ctx.globalAlpha = Math.max(0, sw.life) * 0.6
          ctx.lineWidth = 2 + (1 - sw.life) * 4
          ctx.stroke()
          newShockwaves.push(sw)
        }
      }
      shockwavesRef.current = newShockwaves

      // Update + render particles
      const newParticles: Particle[] = []
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy *= 0.96
        p.vy += 0.04 // gravity
        p.life -= 0.018
        if (p.life > 0) {
          const alpha = Math.max(0, p.life / p.maxLife)
          ctx.globalAlpha = alpha
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
          ctx.fill()
          // Glow
          ctx.globalAlpha = alpha * 0.35
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * alpha * 3, 0, Math.PI * 2)
          ctx.fill()
          newParticles.push(p)
        }
      }
      particlesRef.current = newParticles

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden="true"
    />
  )
}
