'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Skull,
  Flame,
  X,
} from 'lucide-react'

export type ToastKind = 'critical' | 'resolved' | 'info' | 'scenario'

export interface ChaosToast {
  id: number
  kind: ToastKind
  title: string
  message: string
  service?: string
  createdAt: number
}

interface Props {
  toasts: ChaosToast[]
  onDismiss: (id: number) => void
}

const KIND_CONFIG: Record<
  ToastKind,
  {
    icon: React.ReactNode
    color: string
    bg: string
    border: string
    label: string
  }
> = {
  critical: {
    icon: <Skull className="size-5" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    label: 'CRITICAL',
  },
  resolved: {
    icon: <CheckCircle2 className="size-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    label: 'RESOLVED',
  },
  info: {
    icon: <Info className="size-5" />,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    label: 'INFO',
  },
  scenario: {
    icon: <Flame className="size-5" />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    label: 'SCENARIO',
  },
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed top-20 right-4 z-[70] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ChaosToast; onDismiss: (id: number) => void }) {
  const cfg = KIND_CONFIG[toast.kind]
  const [progress, setProgress] = useState(100)

  // Auto-dismiss after 6 seconds with progress bar
  useEffect(() => {
    const duration = 6000
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        onDismiss(toast.id)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [toast.id, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`pointer-events-auto relative overflow-hidden rounded-lg border ${cfg.border} ${cfg.bg} backdrop-blur-md p-3 shadow-xl`}
    >
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 transition-[width] duration-50"
        style={{
          width: `${progress}%`,
          backgroundColor: cfg.color.includes('red')
            ? '#ef4444'
            : cfg.color.includes('emerald')
            ? '#10b981'
            : cfg.color.includes('sky')
            ? '#0ea5e9'
            : '#f97316',
        }}
      />

      <div className="flex items-start gap-2">
        <motion.div
          initial={{ rotate: -20, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className={`shrink-0 ${cfg.color}`}
        >
          {cfg.icon}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
            {toast.service && (
              <span className="text-[10px] text-gray-500 font-mono">· {toast.service}</span>
            )}
          </div>
          <div className="text-sm text-white font-semibold truncate">{toast.title}</div>
          <div className="text-[11px] text-gray-400 leading-tight line-clamp-2">
            {toast.message}
          </div>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-gray-500 hover:text-white transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// Hook to manage toasts
export function useChaosToasts() {
  const [toasts, setToasts] = useState<ChaosToast[]>([])
  const nextIdRef = useRef(1)

  const pushToast = (toast: Omit<ChaosToast, 'id' | 'createdAt'>) => {
    const id = nextIdRef.current++
    setToasts((prev) => [
      ...prev,
      { ...toast, id, createdAt: Date.now() },
    ].slice(-4)) // keep max 4 visible
    return id
  }

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, pushToast, dismissToast }
}
