'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Play,
  ChevronRight,
  ChevronLeft,
  Zap,
  Clock,
  Skull,
  Activity,
  Flame,
  Bomb,
} from 'lucide-react'
import type { AnomalyType, ScenarioStep } from '@/lib/chaos-types'
import { SERVICE_NAMES, ANOMALY_LABELS } from '@/lib/chaos-types'

interface Props {
  open: boolean
  onClose: () => void
  onRun: (name: string, steps: ScenarioStep[]) => void
}

const ANOMALY_TYPES: AnomalyType[] = [
  '500_ERROR',
  'LATENCY_SPIKE',
  'SERVICE_CRASH',
  'NETWORK_PARTITION',
]

const ANOMALY_ICONS: Record<AnomalyType, React.ReactNode> = {
  '500_ERROR': <Bomb className="size-3.5" />,
  LATENCY_SPIKE: <Activity className="size-3.5" />,
  SERVICE_CRASH: <Skull className="size-3.5" />,
  NETWORK_PARTITION: <Flame className="size-3.5" />,
}

const ANOMALY_COLORS: Record<AnomalyType, string> = {
  '500_ERROR': '#f97316',
  LATENCY_SPIKE: '#eab308',
  SERVICE_CRASH: '#ef4444',
  NETWORK_PARTITION: '#dc2626',
}

const PRESETS: { name: string; description: string; steps: ScenarioStep[] }[] = [
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

export function ChaosScenarioBuilder({ open, onClose, onRun }: Props) {
  const [step, setStep] = useState(0)
  const [scenarioName, setScenarioName] = useState('')
  const [steps, setSteps] = useState<ScenarioStep[]>([
    { delayMs: 0, service: 'AuthService', type: '500_ERROR' },
  ])
  const [running, setRunning] = useState(false)

  const reset = () => {
    setStep(0)
    setScenarioName('')
    setSteps([{ delayMs: 0, service: 'AuthService', type: '500_ERROR' }])
    setRunning(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        delayMs: prev.length > 0 ? prev[prev.length - 1].delayMs + 5000 : 0,
        service: 'PaymentService',
        type: 'LATENCY_SPIKE',
      },
    ])
  }

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateStep = (idx: number, patch: Partial<ScenarioStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const applyPreset = (presetIdx: number) => {
    const preset = PRESETS[presetIdx]
    setScenarioName(preset.name)
    setSteps(preset.steps.map((s) => ({ ...s })))
    setStep(1)
  }

  const handleRun = () => {
    setRunning(true)
    onRun(scenarioName || 'Custom Scenario', steps)
    setTimeout(() => {
      handleClose()
    }, 1200)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl bg-[#0d1220] border-white/10 text-gray-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Flame className="size-5 text-orange-500" />
            Chaos Scenario Builder
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Compose a multi-step chaos scenario. Each step runs after a configurable delay.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-4">
          {['Select Template', 'Compose Steps', 'Review & Launch'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= i
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs ${step >= i ? 'text-white font-medium' : 'text-gray-500'}`}
              >
                {label}
              </span>
              {i < 2 && <ChevronRight className="size-3 text-gray-600 ml-auto" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0: Template selection */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESETS.map((preset, i) => (
                  <motion.button
                    key={preset.name}
                    whileHover={{ y: -2 }}
                    onClick={() => applyPreset(i)}
                    className="text-left p-4 rounded-lg border border-white/10 bg-white/3 hover:bg-white/5 hover:border-orange-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{preset.name}</span>
                      <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30">
                        {preset.steps.length} steps
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{preset.description}</p>
                    <div className="flex gap-1 flex-wrap">
                      {preset.steps.map((s, j) => (
                        <span
                          key={j}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${ANOMALY_COLORS[s.type]}20`,
                            color: ANOMALY_COLORS[s.type],
                          }}
                        >
                          {s.service.replace('Service', '')}·{s.type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full p-3 rounded-lg border border-dashed border-white/10 hover:border-orange-500/30 text-xs text-gray-500 hover:text-orange-400 transition-all"
              >
                + Start from scratch instead
              </button>
            </motion.div>
          )}

          {/* STEP 1: Compose steps */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Scenario name</label>
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g. Friday Night Special"
                  className="bg-white/3 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Steps ({steps.length})</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addStep}
                    className="h-7 text-xs border-white/10 hover:bg-white/5"
                  >
                    <Plus className="size-3" /> Add Step
                  </Button>
                </div>
                {steps.map((s, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-md bg-white/3 border border-white/5"
                  >
                    <div className="col-span-1 text-center text-xs text-gray-500 font-mono">
                      #{i + 1}
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5">
                        <Clock className="size-3" /> Delay (ms)
                      </div>
                      <Input
                        type="number"
                        value={s.delayMs}
                        onChange={(e) =>
                          updateStep(i, { delayMs: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="h-8 bg-white/3 border-white/10 text-white text-xs"
                      />
                    </div>
                    <div className="col-span-4">
                      <div className="text-[10px] text-gray-500 mb-0.5">Service</div>
                      <Select
                        value={s.service}
                        onValueChange={(v) => updateStep(i, { service: v })}
                      >
                        <SelectTrigger className="h-8 bg-white/3 border-white/10 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d1220] border-white/10">
                          {SERVICE_NAMES.map((n) => (
                            <SelectItem key={n} value={n} className="text-white text-xs">
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <div className="text-[10px] text-gray-500 mb-0.5">Anomaly</div>
                      <Select
                        value={s.type}
                        onValueChange={(v) => updateStep(i, { type: v as AnomalyType })}
                      >
                        <SelectTrigger className="h-8 bg-white/3 border-white/10 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d1220] border-white/10">
                          {ANOMALY_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-white text-xs">
                              <span className="flex items-center gap-1">
                                {ANOMALY_ICONS[t]}
                                {ANOMALY_LABELS[t]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeStep(i)}
                        disabled={steps.length === 1}
                        className="size-7 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Review & Launch */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="p-4 rounded-lg bg-white/3 border border-white/5">
                <div className="text-xs text-gray-500 mb-1">Scenario name</div>
                <div className="text-sm font-semibold text-white">
                  {scenarioName || 'Custom Scenario'}
                </div>
              </div>
              <div className="text-xs text-gray-400">Execution timeline:</div>
              <div className="relative pl-4 space-y-2">
                <div className="absolute left-1 top-2 bottom-2 w-px bg-white/10" />
                {steps.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative flex items-center gap-3"
                  >
                    <div
                      className="size-2 rounded-full -ml-3.5 ring-2 ring-[#0d1220]"
                      style={{ backgroundColor: ANOMALY_COLORS[s.type] }}
                    />
                    <div className="flex-1 flex items-center justify-between p-2 rounded-md bg-white/3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">
                          +{String(Math.floor(s.delayMs / 1000)).padStart(2, '0')}s
                        </span>
                        <span className="text-xs text-white">{s.service}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{
                            backgroundColor: `${ANOMALY_COLORS[s.type]}20`,
                            color: ANOMALY_COLORS[s.type],
                          }}
                        >
                          {ANOMALY_ICONS[s.type]}
                          {ANOMALY_LABELS[s.type]}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-600">Step {i + 1}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="p-3 rounded-md bg-orange-500/5 border border-orange-500/20 flex items-start gap-2">
                <Zap className="size-4 text-orange-400 mt-0.5 shrink-0" />
                <div className="text-xs text-gray-400">
                  Total execution time:{' '}
                  <span className="text-orange-400 font-mono">
                    {(
                      (steps[steps.length - 1]?.delayMs || 0) / 1000
                    ).toFixed(1)}
                    s
                  </span>
                  . Self-healing will run in parallel and attempt recovery on each
                  service within 8-15 seconds of its anomaly.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="border-white/10 hover:bg-white/5"
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
            )}
            {step < 2 && (
              <Button
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={step === 1 && steps.length === 0}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            )}
            {step === 2 && (
              <motion.div
                animate={running ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.4, repeat: running ? Infinity : 0 }}
              >
                <Button
                  onClick={handleRun}
                  disabled={running}
                  className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
                >
                  {running ? (
                    <>Launching...</>
                  ) : (
                    <>
                      <Play className="size-4" /> Launch Scenario
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
