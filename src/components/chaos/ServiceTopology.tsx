'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Zap, Server } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ServiceData } from '@/lib/chaos-types'
import { SERVICE_META } from '@/lib/chaos-types'

interface Props {
  services: ServiceData[]
  chaosEnabled: boolean
}

interface Node {
  id: string
  label: string
  x: number
  y: number
  color: string
  service?: ServiceData
}

const SVG_W = 760
const SVG_H = 360

const GATEWAY: Node = {
  id: 'gateway',
  label: 'API Gateway',
  x: SVG_W / 2,
  y: SVG_H / 2,
  color: '#f97316',
}

function serviceIcon(name: string, className: string) {
  switch (name) {
    case 'AuthService': return <Shield className={className} />
    case 'PaymentService': return <Zap className={className} />
    case 'InventoryService': return <Server className={className} />
    default: return <Server className={className} />
  }
}

export function ServiceTopology({ services, chaosEnabled }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let raf: number
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const nodes: Node[] = useMemo(() => {
    return services.map((svc, i) => {
      const meta = SERVICE_META[svc.name] || { color: '#888' }
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3
      const radius = 130
      return {
        id: svc.name,
        label: svc.name,
        x: GATEWAY.x + Math.cos(angle) * radius,
        y: GATEWAY.y + Math.sin(angle) * radius,
        color: meta.color,
        service: svc,
      }
    })
  }, [services])

  const getHealthColor = (svc?: ServiceData) => {
    if (!svc) return 'var(--muted-foreground)'
    if (svc.health === 'Healthy') return 'var(--status-healthy)'
    if (svc.health === 'Degraded') return 'var(--status-degraded)'
    return 'var(--status-down)'
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-secondary/30 dark:bg-gradient-to-br dark:from-[#080b12] dark:to-[#0f1420] border border-border">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="grid-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(249,115,22,0.04)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strong-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#grid-bg)" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`vgrid-${i}`}
            x1={(i * SVG_W) / 12}
            y1="0"
            x2={(i * SVG_W) / 12}
            y2={SVG_H}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`hgrid-${i}`}
            x1="0"
            y1={(i * SVG_H) / 8}
            x2={SVG_W}
            y2={(i * SVG_H) / 8}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}

        {nodes.map((node) => {
          const health = node.service?.health || 'Healthy'
          const isDown = health === 'Down'
          const edgeColor = getHealthColor(node.service)
          return (
            <g key={`edge-${node.id}`}>
              <line
                x1={GATEWAY.x} y1={GATEWAY.y}
                x2={node.x} y2={node.y}
                stroke={isDown ? '#7f1d1d' : 'var(--border)'}
                strokeWidth="2"
                strokeDasharray={isDown ? '4 6' : '0'}
              />
              {!isDown && (
                <line
                  x1={GATEWAY.x} y1={GATEWAY.y}
                  x2={node.x} y2={node.y}
                  stroke={edgeColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                  strokeDasharray="6 14"
                  strokeDashoffset={-tick * (health === 'Degraded' ? 0.3 : 1.2)}
                />
              )}
              {!isDown &&
                Array.from({ length: 3 }).map((_, i) => {
                  const speed = health === 'Degraded' ? 0.0015 : 0.003
                  const phase = (tick * speed + i / 3) % 1
                  const px = GATEWAY.x + (node.x - GATEWAY.x) * phase
                  const py = GATEWAY.y + (node.y - GATEWAY.y) * phase
                  return (
                    <circle
                      key={`p-${node.id}-${i}`}
                      cx={px} cy={py}
                      r="3"
                      fill={edgeColor}
                      filter="url(#glow)"
                      opacity={0.9}
                    />
                  )
                })}
              {health === 'Degraded' &&
                Array.from({ length: 5 }).map((_, i) => {
                  const phase = (tick * 0.005 + i / 5) % 1
                  const px = GATEWAY.x + (node.x - GATEWAY.x) * phase
                  const py = GATEWAY.y + (node.y - GATEWAY.y) * phase
                  const jitter = Math.sin(tick * 0.1 + i) * 4
                  return (
                    <circle
                      key={`warn-${node.id}-${i}`}
                      cx={px} cy={py + jitter}
                      r="2"
                      fill="var(--status-degraded)"
                      opacity={0.7}
                    />
                  )
                })}
            </g>
          )
        })}

        <g>
          <circle
            cx={GATEWAY.x} cy={GATEWAY.y} r="34"
            fill="rgba(249,115,22,0.08)"
            stroke="rgba(249,115,22,0.4)"
            strokeWidth="1.5"
            strokeDasharray="3 4"
            strokeDashoffset={-tick * 0.5}
          />
          <circle
            cx={GATEWAY.x} cy={GATEWAY.y} r="26"
            fill="rgba(249,115,22,0.18)"
            stroke="#f97316"
            strokeWidth="2"
            filter="url(#glow)"
          />
          {[0, 1, 2].map((i) => {
            const phase = ((tick * 0.01 + i / 3) % 1)
            return (
              <circle
                key={`gw-pulse-${i}`}
                cx={GATEWAY.x} cy={GATEWAY.y}
                r={26 + phase * 28}
                fill="none"
                stroke="#f97316"
                strokeWidth="1.5"
                opacity={(1 - phase) * 0.35}
              />
            )
          })}
          <text x={GATEWAY.x} y={GATEWAY.y + 4} textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="700">
            GW
          </text>
          <text x={GATEWAY.x} y={GATEWAY.y + 56} textAnchor="middle" className="fill-orange-500" fontSize="10" fontWeight="600">
            API GATEWAY
          </text>
        </g>

        {nodes.map((node) => {
          const svc = node.service
          const health = svc?.health || 'Healthy'
          const isDown = health === 'Down'
          const isDegraded = health === 'Degraded'
          const healthColor = getHealthColor(svc)
          return (
            <g key={`node-${node.id}`}>
              <circle
                cx={node.x} cy={node.y} r="38"
                fill="none"
                stroke={healthColor}
                strokeWidth="1"
                strokeOpacity="0.25"
                strokeDasharray="2 6"
                strokeDashoffset={-tick * 0.6}
              />
              {(isDown || isDegraded) &&
                [0, 1].map((i) => {
                  const phase = ((tick * 0.012 + i / 2) % 1)
                  return (
                    <circle
                      key={`pulse-${node.id}-${i}`}
                      cx={node.x} cy={node.y}
                      r={24 + phase * 18}
                      fill="none"
                      stroke={healthColor}
                      strokeWidth="2"
                      opacity={(1 - phase) * (isDown ? 0.7 : 0.4)}
                    />
                  )
                })}
              <motion.circle
                cx={node.x} cy={node.y} r="24"
                fill={`${node.color}25`}
                stroke={healthColor}
                strokeWidth="2"
                filter="url(#strong-glow)"
                animate={{
                  fill: isDown
                    ? ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.45)', 'rgba(239,68,68,0.2)']
                    : isDegraded
                    ? ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.35)', 'rgba(245,158,11,0.2)']
                    : [`${node.color}20`, `${node.color}30`, `${node.color}20`],
                }}
                transition={{ duration: isDown ? 0.8 : isDegraded ? 1.6 : 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <text x={node.x} y={node.y - 2} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--foreground)">
                {SERVICE_META[node.label]?.shortName || node.label.slice(0, 4).toUpperCase()}
              </text>
              <text
                x={node.x} y={node.y + 10}
                textAnchor="middle"
                fontSize="8"
                fill={isDown ? 'var(--status-down)' : isDegraded ? 'var(--status-degraded)' : 'var(--muted-foreground)'}
              >
                {isDown ? 'DOWN' : isDegraded ? 'DEGRADED' : 'OK'}
              </text>
              <text x={node.x} y={node.y + 56} textAnchor="middle" fontSize="10" fill="var(--foreground)" fontWeight="600">
                {node.label}
              </text>
              <text x={node.x} y={node.y + 70} textAnchor="middle" fontSize="9" fill={healthColor}>
                {svc && !svc.isCrashed ? `${svc.latencyMs}ms` : '---'}
              </text>
              <circle
                cx={node.x + 18} cy={node.y - 18}
                r="4"
                fill={healthColor}
                filter="url(#glow)"
              >
                {isDown && (
                  <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
                )}
              </circle>
            </g>
          )
        })}

        <g>
          <rect x="16" y="16" width="160" height="32" rx="16" fill="var(--card)" stroke={chaosEnabled ? 'rgba(249,115,22,0.4)' : 'var(--border)'} strokeWidth="1" />
          <circle cx="32" cy="32" r="4" fill={chaosEnabled ? '#f97316' : 'var(--muted-foreground)'}>
            {chaosEnabled && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          <text x="44" y="36" fontSize="11" fill="var(--foreground)" fontWeight="600">
            {chaosEnabled ? 'Chaos Engine ARMED' : 'Engine DISARMED'}
          </text>
        </g>

        <g transform={`translate(${SVG_W - 180}, 16)`}>
          <rect x="0" y="0" width="164" height="76" rx="10" fill="var(--card)" stroke="var(--border)" />
          <text x="10" y="18" fontSize="10" fill="var(--muted-foreground)" fontWeight="600">Topology Legend</text>
          <circle cx="16" cy="34" r="4" fill="var(--status-healthy)" />
          <text x="26" y="38" fontSize="9" fill="var(--foreground)">Healthy</text>
          <circle cx="16" cy="50" r="4" fill="var(--status-degraded)" />
          <text x="26" y="54" fontSize="9" fill="var(--foreground)">Degraded</text>
          <circle cx="16" cy="66" r="4" fill="var(--status-down)" />
          <text x="26" y="70" fontSize="9" fill="var(--foreground)">Down / Partitioned</text>
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0" />

      <AnimatePresence>
        {services.some((s) => s.health === 'Down') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-[10px] font-bold text-red-500 backdrop-blur-sm"
          >
            ACTIVE OUTAGE — SELF-HEALING IN PROGRESS
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
