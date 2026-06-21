'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

type ConnState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

interface Props {
  state: ConnState
}

export function ConnectionIndicator({ state }: Props) {
  const config = {
    connected: {
      icon: <Wifi className="size-4" />,
      label: 'LIVE',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      pulse: false,
    },
    connecting: {
      icon: <Loader2 className="size-4 animate-spin" />,
      label: 'CONNECTING',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      pulse: true,
    },
    reconnecting: {
      icon: <Loader2 className="size-4 animate-spin" />,
      label: 'RECONNECTING',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      pulse: true,
    },
    disconnected: {
      icon: <WifiOff className="size-4" />,
      label: 'OFFLINE',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      pulse: false,
    },
  }[state]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${config.bg} border border-white/5`}
    >
      <motion.div
        animate={
          config.pulse
            ? { scale: [1, 1.15, 1] }
            : state === 'connected'
            ? { opacity: [1, 0.7, 1] }
            : {}
        }
        transition={{ duration: state === 'connected' ? 2 : 1, repeat: Infinity }}
        className={config.color}
      >
        {config.icon}
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.span
          key={config.label}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          className={`text-xs font-bold ${config.color}`}
        >
          {config.label}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}
