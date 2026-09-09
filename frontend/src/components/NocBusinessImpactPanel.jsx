import React, { useMemo } from 'react'
import {
  DollarSign,
  TrendingDown,
  Clock,
  Users,
  ShieldAlert,
  BarChart2,
  Sparkles
} from 'lucide-react'

const NocBusinessImpactPanel = ({ telemetryData, initialNode = 704 }) => {
  // Extract or set default telemetry inputs
  const location = telemetryData?.location || initialNode
  const presentRisk = telemetryData?.present_risk ?? 84.5
  const severityType = telemetryData?.severity_type ?? 1
  const numResources = telemetryData?.num_resources ?? 1

  // Default Financial Simulation Parameters
  const subscribersPerNode = 18500
  const hourlySlaRate = 22000
  const truckRollCost = 750
  const arpu = 48

  // Real-time Calculated Financial & Operational Metrics
  const metrics = useMemo(() => {
    const riskFactor = Math.max(0.1, presentRisk / 100)
    const resourceMult = 1.0 + numResources * 0.2
    const severityMult = severityType === 0 ? 1.0 : severityType === 1 ? 1.8 : 3.2
    
    // Blast radius
    const blastRadius = Math.round(subscribersPerNode * (resourceMult / 1.2) * (severityMult / 1.8))
    
    // Hourly loss rate
    const hourlySlaLoss = hourlySlaRate * riskFactor * (1.0 + severityType * 0.35)
    const subscriberChurnLoss = blastRadius * (arpu / 720) * 0.18 * riskFactor
    const totalHourlyLoss = hourlySlaLoss + subscriberChurnLoss
    
    // 4.5h traditional unmitigated vs 35m NetGuard AI mitigated
    const unmitigatedHours = 4.5
    const mitigatedHours = 35 / 60
    const truckRoll = presentRisk >= 50 ? truckRollCost : 0
    
    const unmitigatedLoss = Math.round(totalHourlyLoss * unmitigatedHours + truckRoll * 1.5)
    const mitigatedLoss = Math.round(totalHourlyLoss * mitigatedHours + truckRoll * 0.25)
    const preventedLoss = Math.max(0, unmitigatedLoss - mitigatedLoss)
    const roiPercent = Math.round((preventedLoss / Math.max(500, mitigatedLoss)) * 100)
    
    // MTTR breakdown
    const tradMttr = { total: 270 }
    const netguardMttr = { total: 35 }
    const mttrSavedMins = tradMttr.total - netguardMttr.total
    const mttrSavedPercent = Math.round((mttrSavedMins / tradMttr.total) * 100)

    return {
      blastRadius,
      totalHourlyLoss: Math.round(totalHourlyLoss),
      unmitigatedLoss,
      mitigatedLoss,
      preventedLoss,
      roiPercent,
      mttrSavedMins,
      mttrSavedPercent
    }
  }, [presentRisk, severityType, numResources])

  return (
    <div className="space-y-8 rounded-2xl border border-amber-500/30 bg-dark/95 p-6 shadow-2xl backdrop-blur-xl">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 shadow-[0_0_20px_rgba(253,230,138,0.25)] text-primary">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                NOC Business Model &amp; Executive Loss Prevention
              </h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase font-bold text-amber-300">
                NOC Manager View
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Financial impact model for Node <b className="text-amber-300">#{location}</b> • Real-time SLA breach &amp; ROI projection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-panel/80 px-3 py-2 font-mono text-xs text-zinc-300">
          <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
          Live Risk Score: <b className={presentRisk >= 50 ? 'text-amber-400' : 'text-emerald-400'}>{presentRisk}%</b>
        </div>
      </div>

      {/* Top 4 KPI Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Prevented Outage Loss */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-panel to-dark p-5 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Capital Loss Saved</span>
            <TrendingDown className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-emerald-300">
            ${metrics.preventedLoss.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Net AI ROI:</span>
            <span className="font-mono font-bold text-emerald-400">+{metrics.roiPercent}%</span>
          </div>
        </div>

        {/* Card 2: Unmitigated Risk Exposure */}
        <div className="relative overflow-hidden rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-950/40 via-panel to-dark p-5 shadow-lg">
          <div className="flex items-center justify-between text-rose-400">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Unmitigated Exposure (4.5h)</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-rose-300">
            ${metrics.unmitigatedLoss.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Hourly Loss Rate:</span>
            <span className="font-mono font-bold text-rose-400">${metrics.totalHourlyLoss.toLocaleString()}/hr</span>
          </div>
        </div>

        {/* Card 3: MTTR Saved */}
        <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-panel to-dark p-5 shadow-lg">
          <div className="flex items-center justify-between text-amber-400">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">MTTR Saved</span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-300">
            {metrics.mttrSavedMins} <span className="text-xs font-normal text-zinc-400">mins</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Resolution Speedup:</span>
            <span className="font-mono font-bold text-amber-400">{metrics.mttrSavedPercent}% faster</span>
          </div>
        </div>

        {/* Card 4: Subscriber Blast Radius */}
        <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-panel to-dark p-5 shadow-lg">
          <div className="flex items-center justify-between text-amber-400">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Subscriber Blast Radius</span>
            <Users className="h-4 w-4" />
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-amber-300">
            {metrics.blastRadius.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Target Node:</span>
            <span className="font-mono font-bold text-amber-400">Node #{location}</span>
          </div>
        </div>
      </div>

      {/* Financial Exposure vs Mitigated Cost (SVG Bar Chart) */}
      <div className="rounded-xl border border-zinc-800 bg-panel/70 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-mono text-sm font-bold text-zinc-200">
            <BarChart2 className="h-4 w-4 text-primary" />
            Financial Loss vs. NetGuard AI Saved Capital
          </h3>
          <span className="text-[10px] text-zinc-500">4.5h Outage Window</span>
        </div>

        {/* Dynamic SVG Comparison Chart */}
        <div className="space-y-4 pt-2">
          {/* Unmitigated Bar */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs font-mono">
              <span className="text-rose-400 font-semibold">Traditional Unmitigated Outage (4.5h)</span>
              <span className="font-bold text-rose-300">${metrics.unmitigatedLoss.toLocaleString()}</span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-800 p-0.5 border border-rose-900/50">
              <div
                className="h-full rounded bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Mitigated Bar */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs font-mono">
              <span className="text-emerald-400 font-semibold">NetGuard AI Mitigated Cost (35m MTTR)</span>
              <span className="font-bold text-emerald-300">${metrics.mitigatedLoss.toLocaleString()}</span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-zinc-800 p-0.5 border border-emerald-900/50">
              <div
                className="h-full rounded bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] transition-all duration-500"
                style={{ width: `${Math.max(8, Math.round((metrics.mitigatedLoss / metrics.unmitigatedLoss) * 100))}%` }}
              />
            </div>
          </div>

          {/* Savings Callout Banner */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
            <span className="flex items-center gap-2 font-mono text-emerald-300">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Capital Preserved by Autonomous Resolution:
            </span>
            <span className="font-mono text-sm font-black text-emerald-300">
              ${metrics.preventedLoss.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NocBusinessImpactPanel


