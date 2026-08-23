import { useState } from 'react'
import axios from 'axios'
import {
  ArrowLeft,
  Cpu,
  Layers,
  Loader2,
  Network,
  RotateCcw,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Siren,
  Zap,
  Minus,
  Plus,
  Dices,
  Sparkles,
  Radio,
  Activity,
  Flame,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react'
import FaultTimelineChart from '../components/FaultTimelineChart'
import AiCopilotPanel from '../components/AiCopilotPanel'

const API = typeof window !== 'undefined' && window.location.origin.includes('http')
  ? window.location.origin
  : 'https://netgaurd.onrender.com'

const PREDICTION_STAGES = [
  { at: 0, text: 'Model is predicting...' },
  { at: 1300, text: 'Ingesting node telemetry & log features...' },
  { at: 2700, text: 'Running XGBoost multi-window classifier...' },
  { at: 4000, text: 'Synthesizing Past, Present & Future risk timeline...' },
]

const DEFAULTS = {
  location: 704,
  severity_type: 1,
  num_events: 2,
  num_resources: 1,
  total_log_volume: 51,
}

const PRESET_SCENARIOS = [
  {
    name: 'Critical Outage',
    icon: Flame,
    color: 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20',
    data: { location: 704, severity_type: 2, num_events: 5, num_resources: 3, total_log_volume: 450 },
  },
  {
    name: 'Degraded Link',
    icon: AlertTriangle,
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
    data: { location: 1008, severity_type: 1, num_events: 3, num_resources: 2, total_log_volume: 120 },
  },
  {
    name: 'Normal Traffic',
    icon: CheckCircle2,
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
    data: { location: 534, severity_type: 0, num_events: 1, num_resources: 1, total_log_volume: 25 },
  },
]

const SEVERITY_OPTIONS = [
  {
    value: 0,
    label: 'Type 0',
    status: 'Baseline',
    desc: 'Normal / Nominal alarm',
    color: 'emerald',
    activeBg: 'border-emerald-500/80 bg-emerald-500/15 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
  },
  {
    value: 1,
    label: 'Type 1',
    status: 'Elevated',
    desc: 'Warning threshold',
    color: 'amber',
    activeBg: 'border-primary bg-primary/15 text-primary shadow-[0_0_15px_rgba(253,230,138,0.25)]',
  },
  {
    value: 2,
    label: 'Type 2',
    status: 'Critical',
    desc: 'Severe outage risk',
    color: 'red',
    activeBg: 'border-red-500/80 bg-red-500/15 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]',
  },
]

const CyberSlider = ({ Icon, label, hint, min, max, value, onChange, unit, quickPills = [] }) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  const decrement = () => onChange(Math.max(min, value - (max > 50 ? 50 : 1)))
  const increment = () => onChange(Math.min(max, value + (max > 50 ? 50 : 1)))

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 transition-all hover:border-zinc-700">
      <div className="mb-2.5 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </label>
        <div className="flex items-center gap-2 font-mono">
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary shadow-[0_0_10px_rgba(253,230,138,0.15)]">
            {value} {unit && <span className="text-[10px] text-zinc-400">{unit}</span>}
          </span>
        </div>
      </div>

      {/* Slider with Tactile - / + Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-dark text-zinc-400 transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Minus className="h-3 w-3" />
        </button>

        <div className="relative flex-1 py-1">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              background: `linear-gradient(to right, #fde68a 0%, #fde68a ${percentage}%, #27272a ${percentage}%, #27272a 100%)`,
            }}
            className="h-2 w-full cursor-pointer appearance-none rounded-full accent-primary shadow-inner"
          />
        </div>

        <button
          type="button"
          onClick={increment}
          disabled={value >= max}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-dark text-zinc-400 transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Subtitle & Quick Preset Tags */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
        <span>Min: {min}</span>
        {quickPills.length > 0 ? (
          <div className="flex items-center gap-1">
            {quickPills.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => onChange(pill)}
                className={`rounded border px-1.5 py-0.5 text-[9px] transition ${
                  value === pill
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-zinc-700 bg-dark/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        ) : (
          <span>{hint}</span>
        )}
        <span>Max: {max}</span>
      </div>
    </div>
  )
}

const PredictPage = ({ onNavigate }) => {
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState('Model is predicting...')
  const [progress, setProgress] = useState(0)
  const [activeRole, setActiveRole] = useState('L1 Engineer')
  const [error, setError] = useState(null)

  // GenAI copilot, only ever engaged when the model actually flags a fault
  const [copilot, setCopilot] = useState(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState(null)

  // bumped per prediction, used as a React key so the chart and the copilot
  // remount and replay their intro animations on every run
  const [runId, setRunId] = useState(0)

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  /**
   * Hand the flagged node to Gemini for a root cause read, the commands that
   * mend it now, and the changes that stop it recurring.
   */
  const askCopilot = async (timeline, role = activeRole) => {
    const byPhase = Object.fromEntries(timeline.windows.map((w) => [w.phase, w]))

    setCopilotLoading(true)
    setCopilotError(null)
    setCopilot(null)

    try {
      const res = await axios.post(`${API}/copilot/remediation`, {
        location: timeline.target_node,
        role: role,
        severity: byPhase.present?.severity ?? 0,
        severity_label: byPhase.present?.severity_label ?? 'Unknown',
        past_risk: byPhase.past?.risk ?? 0,
        present_risk: byPhase.present?.risk ?? 0,
        future_risk: byPhase.future?.risk ?? 0,
        past_summary: byPhase.past?.detail ?? '',
        severity_type: Number(timeline.inputs.severity_type),
        num_events: Number(timeline.inputs.num_events),
        num_resources: Number(timeline.inputs.num_resources),
        total_log_volume: Number(timeline.inputs.total_log_volume),
      })

      if (res.data?.error) {
        setCopilotError(res.data.trace || res.data.error)
      } else {
        setCopilot(res.data)
      }
    } catch (e) {
      console.error('copilot failed:', e)
      setCopilotError('Could not reach the copilot endpoint on the NetGuard API.')
    }

    setCopilotLoading(false)
  }

  const handleRoleChange = (newRole) => {
    setActiveRole(newRole)
    if (result && result.fault_count > 0) {
      askCopilot(result, newRole)
    }
  }

  const runPrediction = async () => {
    setLoading(true)
    setError(null)
    setCopilot(null)
    setCopilotError(null)
    setResult(null)
    setProgress(0)
    setLoadingPhase('Model is predicting...')

    const node = Number(form.location)
    if (!Number.isInteger(node) || node < 1 || node > 1126) {
      setError('Target Node ID must be a valid node number between 1 and 1126.')
      setLoading(false)
      return
    }

    // Scroll to result panel to show loading animation immediately
    setTimeout(
      () => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    )

    const payload = {
      location: node,
      severity_type: Number(form.severity_type),
      num_events: Number(form.num_events),
      num_resources: Number(form.num_resources),
      total_log_volume: Number(form.total_log_volume),
    }

    const startTime = Date.now()
    const DURATION = 5000

    // Set interval to update progress & phrases smoothly over 5 seconds
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const currentProgress = Math.min(99, (elapsed / DURATION) * 100)
      setProgress(currentProgress)

      const stage = PREDICTION_STAGES.slice().reverse().find((s) => elapsed >= s.at)
      if (stage) {
        setLoadingPhase(stage.text)
      }
    }, 50)

    try {
      // Run API call in parallel with the 5s timer
      const [res] = await Promise.all([
        axios.post(`${API}/predict/timeline`, payload),
        new Promise((resolve) => setTimeout(resolve, DURATION)),
      ])

      clearInterval(progressInterval)
      setProgress(100)

      if (res.data?.error) {
        setError(`Backend returned an error: ${res.data.error}`)
      } else {
        setResult(res.data)
        setRunId((n) => n + 1)
        setTimeout(
          () => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }),
          80,
        )
        // progressive disclosure: the copilot only wakes up on a real fault
        if (res.data.fault_count > 0) askCopilot(res.data)
      }
    } catch (e) {
      clearInterval(progressInterval)
      console.error('prediction failed:', e)
      setError(
        'Could not reach the NetGuard API. Please ensure the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setForm(DEFAULTS)
    setResult(null)
    setError(null)
    setCopilot(null)
    setCopilotError(null)
    setProgress(0)
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-dark/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2 font-mono font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            NETGUARD <span className="text-primary">AI</span>
          </div>
          <span className="hidden text-xs text-zinc-600 sm:block">
            XGBoost + Gemini
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            Fault prediction
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Analyse a network node</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">
            Set the five telemetry signals below and run the engine. You get one
            chart back covering the node&rsquo;s past, present and future fault
            state &mdash; red where a fault sits, green where it is clear.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* input panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-zinc-700 bg-panel p-6 shadow-xl">
              {/* Header & Live Input Stress Gauge */}
              <div className="mb-6 border-b border-zinc-700/80 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">
                    <ServerCog className="h-4 w-4 text-primary" />
                    Telemetry Control Deck
                  </h2>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                    LIVE HUD
                  </span>
                </div>

                {/* Real-time Telemetry Stress Level */}
                {(() => {
                  const stress = Math.min(
                    100,
                    Math.round(
                      Number(form.severity_type) * 35 +
                        Number(form.num_events) * 5 +
                        Number(form.num_resources) * 4 +
                        Number(form.total_log_volume) / 22,
                    ),
                  )
                  const stressColor =
                    stress >= 65
                      ? 'text-red-400 border-red-500/40 bg-red-500/10'
                      : stress >= 35
                      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                      : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'

                  return (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="flex items-center gap-1.5 text-zinc-400">
                          <Activity className="h-3.5 w-3.5 text-primary" /> Signal Stress Level:
                        </span>
                        <span className={`font-bold ${stressColor.split(' ')[0]}`}>
                          {stress}% ({stress >= 65 ? 'CRITICAL SURGE' : stress >= 35 ? 'ELEVATED' : 'NOMINAL'})
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            stress >= 65
                              ? 'bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_8px_#ef4444]'
                              : stress >= 35
                              ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${stress}%` }}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Quick Incident Simulation Presets */}
              <div className="mb-6">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  <Sparkles className="h-3 w-3 text-primary" /> Quick Test Scenarios:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_SCENARIOS.map((p) => {
                    const Icon = p.icon
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setForm(p.data)}
                        className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all ${p.color}`}
                      >
                        <Icon className="h-3.5 w-3.5 mb-1" />
                        <span className="text-[10px] font-bold tracking-tight">{p.name}</span>
                        <span className="font-mono text-[9px] opacity-75">#{p.data.location}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-5">
                {/* 1. Target Node ID Cyber Stepper */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="node-id"
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300"
                    >
                      <Network className="h-3.5 w-3.5 text-primary" />
                      Target Node ID
                    </label>
                    <button
                      type="button"
                      onClick={() => set('location')(Math.floor(Math.random() * 1126) + 1)}
                      className="flex items-center gap-1 rounded border border-zinc-700 bg-dark px-2 py-0.5 text-[10px] font-mono text-zinc-400 transition hover:border-primary hover:text-primary"
                    >
                      <Dices className="h-3 w-3" /> Random
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => set('location')(Math.max(1, Number(form.location) - 1))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-dark text-zinc-300 transition hover:border-primary hover:text-primary active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <div className="relative flex-1">
                      <input
                        id="node-id"
                        type="number"
                        min={1}
                        max={1126}
                        value={form.location}
                        onChange={(e) => set('location')(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-dark py-2.5 px-3 text-center font-mono text-xl font-black text-primary outline-none transition focus:border-primary focus:shadow-[0_0_15px_rgba(253,230,138,0.2)]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => set('location')(Math.min(1126, Number(form.location) + 1))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-dark text-zinc-300 transition hover:border-primary hover:text-primary active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[10px] font-mono text-zinc-500">
                    Range: Node 1 to 1126 (Telecom Topology Mesh)
                  </p>
                </div>

                {/* 2. Severity Type Cyber Radios */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
                    <Siren className="h-3.5 w-3.5 text-primary" />
                    Hardware Alarm Severity
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SEVERITY_OPTIONS.map((opt) => {
                      const isActive = Number(form.severity_type) === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set('severity_type')(opt.value)}
                          className={`group relative flex flex-col items-center justify-center rounded-xl border p-3 transition-all ${
                            isActive
                              ? opt.activeBg
                              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <span className="font-mono text-xs font-black">{opt.label}</span>
                          <span className="mt-0.5 text-[10px] font-semibold opacity-90">{opt.status}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. Event Burst Count */}
                <CyberSlider
                  Icon={Zap}
                  label="Event Burst Count"
                  hint="Frequency of event triggers"
                  min={1}
                  max={9}
                  value={form.num_events}
                  onChange={set('num_events')}
                  quickPills={[1, 3, 5, 9]}
                />

                {/* 4. Resource Count */}
                <CyberSlider
                  Icon={Layers}
                  label="Resource Types"
                  hint="Equipment modules involved"
                  min={1}
                  max={5}
                  value={form.num_resources}
                  onChange={set('num_resources')}
                  quickPills={[1, 2, 3, 5]}
                />

                {/* 5. Total Log Volume */}
                <CyberSlider
                  Icon={ScrollText}
                  label="Total Log Volume"
                  hint="Payload data generated"
                  min={1}
                  max={1650}
                  value={form.total_log_volume}
                  onChange={set('total_log_volume')}
                  unit="MB"
                  quickPills={[25, 120, 450, 1200]}
                />
              </div>

              {/* Action Button */}
              <button
                onClick={runPrediction}
                disabled={loading}
                className="group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-primary to-amber-200 py-4 font-mono font-black text-dark shadow-[0_0_25px_rgba(253,230,138,0.4)] transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(253,230,138,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-dark" />
                    <span>PREDICTING... ({Math.round(progress)}%)</span>
                  </>
                ) : (
                  <>
                    <Cpu className="h-5 w-5 transition-transform group-hover:rotate-12" />
                    <span>RUN FAULT PREDICTION</span>
                  </>
                )}
              </button>

              <button
                onClick={reset}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 py-2 text-xs font-mono text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Default Telemetry
              </button>
            </div>
          </div>

          {/* result panel */}
          <div id="result" className="lg:col-span-3">
            {error && (
              <div className="mb-6 rounded-lg border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 rounded-2xl border border-primary/30 bg-panel/90 p-8 text-center shadow-2xl backdrop-blur">
                {/* Glowing animated radar ring */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-24 w-24 animate-ping rounded-full bg-primary/15" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/50 bg-primary/10 shadow-[0_0_35px_rgba(253,230,138,0.25)]">
                    <Cpu className="h-8 w-8 animate-pulse text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono font-semibold text-primary">
                    <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                    XGBoost Inference Engine
                  </div>
                  <h3 className="font-mono text-xl font-bold text-white tracking-wide transition-all duration-300">
                    {loadingPhase}
                  </h3>
                  <p className="font-mono text-xs text-zinc-400">
                    Evaluating Node {form.location} • Telemetry parameters locked
                  </p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full max-w-sm">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80 p-0.5 border border-zinc-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-primary to-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.5)] transition-all duration-100 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-mono text-zinc-500">
                    <span>Processing Telemetry</span>
                    <span className="font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Real-time telemetry badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Node: <b className="text-zinc-200">#{form.location}</b>
                  </span>
                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Severity: <b className="text-zinc-200">Type {form.severity_type}</b>
                  </span>
                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Events: <b className="text-zinc-200">{form.num_events}</b>
                  </span>
                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Logs: <b className="text-zinc-200">{form.total_log_volume} MB</b>
                  </span>
                </div>
              </div>
            )}

            {!loading && !result && !error && (
              <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-700 bg-panel/40 px-8 text-center">
                <Cpu className="h-12 w-12 text-zinc-700" />
                <p className="font-mono text-zinc-500">Engine on standby</p>
                <p className="max-w-sm text-sm text-zinc-600">
                  Set your telemetry values and run the prediction. The past,
                  present and future chart appears here.
                </p>
              </div>
            )}

            {result && !loading && (
              <FaultTimelineChart key={`chart-${runId}`} result={result} />
            )}

            {result && !loading && (
              <AiCopilotPanel
                key={`copilot-${runId}-${activeRole}`}
                data={copilot}
                loading={copilotLoading}
                error={copilotError}
                node={result.target_node}
                activeRole={activeRole}
                onRoleChange={handleRoleChange}
              />
            )}

            {result && !loading && result.fault_count === 0 && (
              <p className="mt-8 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-zinc-400">
                All three windows are clear, so the GenAI incident commander was
                not engaged. It appears automatically the moment a window is
                flagged red.
              </p>
            )}

            {result && !loading && (
              <p className="mt-6 rounded-lg border border-zinc-800 bg-panel/40 p-4 text-xs leading-relaxed text-zinc-500">
                <b className="text-zinc-400">On the future bar:</b> the dataset
                has no time axis, so this is a transparent weighted projection
                rather than a trained forecaster. Its exact weighting is printed
                on the Future card above. Treat it as an early warning signal, not
                a scheduled failure.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default PredictPage
