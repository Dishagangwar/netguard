import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Zap,
  TrendingUp,
  History,
  Radio,
  Waves,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react'

const GRID = [100, 75, 50, 25, 0]

const ALERT_CONFIG = {
  critical_high: {
    label: 'Immediate Dispatch',
    category: 'CRITICAL HIGH',
    bg: 'bg-red-500/15 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.35)]',
    badge: 'bg-red-500/20 border-red-500/60 text-red-400',
    dot: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
    bar: 'bg-red-500 shadow-[0_0_12px_#ef4444]',
    border: 'border-red-500/40',
    headerBg: 'bg-gradient-to-r from-red-950/50 via-panel to-panel shadow-[0_0_40px_rgba(239,68,68,0.22)]',
    halo: 'bg-red-500',
    Icon: AlertTriangle,
  },
  critical_borderline: {
    label: 'Review Queue',
    category: 'CRITICAL BORDERLINE',
    bg: 'bg-orange-500/15 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.35)]',
    badge: 'bg-orange-500/20 border-orange-500/60 text-orange-400',
    dot: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
    bar: 'bg-orange-500 shadow-[0_0_12px_#f97316]',
    border: 'border-orange-500/40',
    headerBg: 'bg-gradient-to-r from-orange-950/50 via-panel to-panel shadow-[0_0_40px_rgba(249,115,22,0.22)]',
    halo: 'bg-orange-500',
    Icon: ShieldAlert,
  },
  warning: {
    label: 'Monitor',
    category: 'WARNING',
    bg: 'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)]',
    badge: 'bg-amber-500/20 border-amber-500/60 text-amber-400',
    dot: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
    bar: 'bg-amber-500 shadow-[0_0_12px_#f59e0b]',
    border: 'border-amber-500/40',
    headerBg: 'bg-gradient-to-r from-amber-950/40 via-panel to-panel shadow-[0_0_40px_rgba(245,158,11,0.2)]',
    halo: 'bg-amber-500',
    Icon: Activity,
  },
  normal: {
    label: 'No Action',
    category: 'NOMINAL',
    bg: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]',
    badge: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400',
    dot: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
    bar: 'bg-emerald-500 shadow-[0_0_12px_#10b981]',
    border: 'border-emerald-500/40',
    headerBg: 'bg-gradient-to-r from-emerald-950/40 via-panel to-panel shadow-[0_0_40px_rgba(16,185,129,0.18)]',
    halo: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
}

const styleFor = (window) => {
  if (!window.has_data) {
    return {
      color: '#71717a',
      bgGrad: 'from-zinc-600/30 to-zinc-800/10',
      bar: 'bg-zinc-600',
      glow: 'shadow-[0_0_20px_rgba(113,113,122,0.3)]',
      border: 'border-zinc-600',
      text: 'text-zinc-400',
      chip: 'bg-zinc-800/80 text-zinc-300 border-zinc-600/50',
      label: 'NO DATA',
      stroke: '#71717a',
      fill: 'rgba(113, 113, 122, 0.15)',
      Icon: HelpCircle,
    }
  }
  if (window.fault) {
    return {
      color: '#ef4444',
      bgGrad: 'from-rose-500/30 via-red-500/20 to-red-950/40',
      bar: 'bg-gradient-to-t from-rose-600 to-red-500',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.65)]',
      border: 'border-red-500/60',
      text: 'text-red-400',
      chip: 'bg-red-500/15 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
      label: 'CRITICAL FAULT',
      stroke: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.25)',
      Icon: AlertTriangle,
    }
  }
  return {
    color: '#10b981',
    bgGrad: 'from-emerald-500/30 via-teal-500/20 to-emerald-950/40',
    bar: 'bg-gradient-to-t from-emerald-600 to-teal-400',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.55)]',
    border: 'border-emerald-500/60',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
    label: 'OPTIMAL / CLEAR',
    stroke: '#10b981',
    fill: 'rgba(16, 185, 129, 0.25)',
    Icon: CheckCircle2,
  }
}

const PHASE_ICONS = {
  past: History,
  present: Zap,
  future: TrendingUp,
}

const FaultTimelineChart = ({ result }) => {
  const [grown, setGrown] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 100)
    return () => clearTimeout(t)
  }, [])

  const { windows, threshold, verdict, fault_count: faultCount, target_node: node } = result
  const anyFault = faultCount > 0

  const alertLevel =
    result.alert_level ||
    windows.find((w) => w.phase === 'present')?.alert_level ||
    (anyFault ? 'critical_high' : 'normal')
  const alert = ALERT_CONFIG[alertLevel] || ALERT_CONFIG.normal
  const AlertIcon = alert.Icon

  // SVG Coordinates for 3-Point Cyber Spline
  // Box: 600 width x 230 height
  const points = windows.map((w, i) => {
    const x = 100 + i * 200 // 100, 300, 500
    const risk = grown ? Math.max(0, Math.min(100, w.risk)) : 0
    const y = 190 - (risk / 100) * 160 // y from 190 (0%) to 30 (100%)
    return { x, y, risk, window: w }
  })

  // Smooth Bezier Curve Path generator
  const p0 = points[0] || { x: 100, y: 190 }
  const p1 = points[1] || { x: 300, y: 190 }
  const p2 = points[2] || { x: 500, y: 190 }

  const splinePath = `M ${p0.x} ${p0.y} C ${p0.x + 80} ${p0.y}, ${p1.x - 80} ${p1.y}, ${p1.x} ${p1.y} C ${p1.x + 80} ${p1.y}, ${p2.x - 80} ${p2.y}, ${p2.x} ${p2.y}`
  const areaPath = `${splinePath} L ${p2.x} 210 L ${p0.x} 210 Z`
  const thresholdY = 190 - (threshold / 100) * 160

  return (
    <div className="space-y-6">
      {/* 1. Futuristic Cyber HUD Verdict Card with Tiered Alert Status */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-500 ${alert.border} ${alert.headerBg}`}
      >
        <div
          className={`absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl opacity-20 pointer-events-none ${alert.halo}`}
        />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="relative mt-1">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl border ${alert.badge}`}
              >
                <AlertIcon className={`h-6 w-6 ${alertLevel === 'critical_high' ? 'animate-pulse' : ''}`} />
              </div>
              <span
                className={`absolute -right-1 -top-1 flex h-3 w-3 ${
                  anyFault ? 'flex' : 'hidden'
                }`}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Node Telemetry Verdict
                </span>
                <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-primary">
                  ID: #{node}
                </span>
                {/* Tiered Alert Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${alert.bg}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${alert.dot} animate-pulse`} />
                  {alert.label}
                </span>
              </div>
              <h2
                className={`mt-1 text-xl font-extrabold tracking-tight sm:text-2xl ${
                  alertLevel === 'critical_high'
                    ? 'text-red-400'
                    : alertLevel === 'critical_borderline'
                    ? 'text-orange-400'
                    : alertLevel === 'warning'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {anyFault
                  ? `Active Outage Alert: ${faultCount} of 3 Windows Flagged`
                  : `All Systems Operational: Node ${node} is Clear`}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl font-sans">
                {verdict}
              </p>
            </div>
          </div>

          {/* Tiered Action Status Pill */}
          <div className="flex shrink-0 items-center gap-3 self-start md:self-auto rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3">
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                Tiered Action
              </p>
              <p
                className={`font-mono text-sm font-black uppercase ${
                  alertLevel === 'critical_high'
                    ? 'text-red-400'
                    : alertLevel === 'critical_borderline'
                    ? 'text-orange-400'
                    : alertLevel === 'warning'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {alert.label}
              </p>
            </div>
            <div className={`h-9 w-1.5 rounded-full ${alert.bar}`} />
          </div>
        </div>
      </div>

      {/* 2. Main Cyber Wave Telemetry Canvas */}
      <div className="relative rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-[#13141a] to-[#0d0e12] p-6 shadow-2xl backdrop-blur">
        {/* Header Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary animate-pulse" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-200">
                Predictive Risk Matrix (3-Horizon Engine)
              </h3>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400 font-sans">
              Node #{node} &middot; Real-time AI confidence score trajectory
            </p>
          </div>

          {/* Dedicated Cyber Wave Badge */}
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold text-primary shadow-[0_0_12px_rgba(253,230,138,0.2)]">
            <Waves className="h-3.5 w-3.5 animate-pulse" />
            <span>CYBER WAVE SPLINE</span>
          </div>
        </div>

        {/* Dedicated Cyber Wave Spline Curve Area */}
        <div className="pt-6">
          <div className="relative h-72 w-full overflow-hidden">
            <svg
              viewBox="0 0 600 230"
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Linear Gradient for Spline Stroke */}
                <linearGradient id="splineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={styleFor(windows[0] || {}).color} />
                  <stop offset="50%" stopColor={styleFor(windows[1] || {}).color} />
                  <stop offset="100%" stopColor={styleFor(windows[2] || {}).color} />
                </linearGradient>

                {/* Gradient for Filled Area */}
                <linearGradient id="splineArea" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop
                    offset="0%"
                    stopColor={anyFault ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)'}
                  />
                  <stop
                    offset="60%"
                    stopColor={anyFault ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)'}
                  />
                  <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
                </linearGradient>

                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid Scan Lines */}
              {GRID.map((tick) => {
                const y = 190 - (tick / 100) * 160
                return (
                  <g key={tick}>
                    <line
                      x1="40"
                      y1={y}
                      x2="560"
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x="32"
                      y={y + 3}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {tick}%
                    </text>
                  </g>
                )
              })}

              {/* 50% Threshold Laser Line */}
              <g>
                <line
                  x1="40"
                  y1={thresholdY}
                  x2="560"
                  y2={thresholdY}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  opacity="0.85"
                />
                <rect
                  x="455"
                  y={thresholdY - 14}
                  width="105"
                  height="16"
                  rx="3"
                  fill="#18181b"
                  stroke="#f59e0b"
                  strokeWidth="0.8"
                />
                <text
                  x="507"
                  y={thresholdY - 3}
                  fill="#f59e0b"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  THRESHOLD {threshold}%
                </text>
              </g>

              {/* Filled Spline Area */}
              <path
                d={areaPath}
                fill="url(#splineArea)"
                className="transition-all duration-1000 ease-out"
              />

              {/* Glowing Spline Stroke Curve */}
              <path
                d={splinePath}
                fill="none"
                stroke="url(#splineStroke)"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#neonGlow)"
                className="transition-all duration-1000 ease-out"
              />

              {/* Vertical Phase Drop-Down Laser Lines */}
              {points.map((p, idx) => {
                const s = styleFor(p.window)
                return (
                  <g key={idx}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x}
                      y2="210"
                      stroke={s.color}
                      strokeWidth="1.2"
                      strokeDasharray="2 4"
                      opacity="0.5"
                    />
                  </g>
                )
              })}

              {/* Interactive Data Hub Nodes (Points) */}
              {points.map((p, idx) => {
                const s = styleFor(p.window)
                const isHovered = hoveredIndex === idx

                return (
                  <g
                    key={idx}
                    className="cursor-pointer transition-transform duration-300"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Outer Halo Wave */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? '16' : '11'}
                      fill={s.color}
                      opacity="0.2"
                      className="animate-ping"
                    />

                    {/* Main Node Circle */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? '9' : '7'}
                      fill="#09090b"
                      stroke={s.color}
                      strokeWidth="3"
                      filter="url(#neonGlow)"
                      className="transition-all duration-300"
                    />

                    {/* Center Point */}
                    <circle cx={p.x} cy={p.y} r="2.5" fill={s.color} />

                    {/* Floating Percentage Tag */}
                    <g transform={`translate(${p.x}, ${p.y - 16})`}>
                      <rect
                        x="-28"
                        y="-16"
                        width="56"
                        height="18"
                        rx="4"
                        fill="#09090b"
                        stroke={s.color}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-3.5"
                        fill={s.color}
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {p.risk}%
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Timeline Trajectory Navigator Footer */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800/80 pt-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <History className="h-3.5 w-3.5 text-zinc-400" /> Recorded History
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className="flex items-center gap-1.5 text-primary">
              <Zap className="h-3.5 w-3.5 text-primary" /> Live XGBoost
            </span>
            <ArrowRight className="h-3 w-3 text-zinc-600" />
            <span className="flex items-center gap-1.5 text-zinc-300">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-400" /> Load Horizon
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
              Dispatch (&ge;70%)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
              Review (47-70%)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
              Monitor (50% W)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              No Action (&lt;50%)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Per-Window Deep Diagnostics Glass Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {windows.map((w) => {
          const s = styleFor(w)
          const Icon = PHASE_ICONS[w.phase] || Activity

          return (
            <div
              key={w.phase}
              className={`relative overflow-hidden rounded-xl border border-zinc-700/70 bg-gradient-to-b from-[#16171e] to-panel p-5 backdrop-blur shadow-lg transition-all duration-300 hover:border-zinc-500/80 hover:-translate-y-1`}
            >
              <div
                className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${
                  w.fault
                    ? 'from-red-600 via-rose-500 to-red-400'
                    : 'from-emerald-600 via-teal-500 to-emerald-400'
                }`}
              />

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg border ${s.chip}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-100 text-sm">{w.title} Phase</h4>
                      {w.phase === 'present' && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-mono font-black uppercase ${alert.badge}`}
                        >
                          {alert.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                      {w.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className={`text-lg font-black ${s.text}`}>{w.risk}%</span>
                  <p className="text-[9px] uppercase tracking-widest text-zinc-500">Risk</p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-zinc-300 font-sans">{w.detail}</p>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[10px] font-mono text-zinc-500">
                <span className="truncate max-w-[150px]">Source: {w.source}</span>
                {w.confidence !== undefined ? (
                  <span className="font-bold text-primary">
                    AI CONF: {w.confidence}%
                  </span>
                ) : (
                  <span className={`font-bold ${s.text}`}>
                    {w.fault ? 'TRIGGERED' : 'NOMINAL'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FaultTimelineChart
