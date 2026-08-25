import React, { useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ShieldCheck
} from 'lucide-react'
import NocBusinessImpactPanel from '../components/NocBusinessImpactPanel'

const PRESET_NODES = [
  { id: 704, label: 'Node #704 (Metro Core Optical Cluster)', severity: 1, events: 3, resources: 2, logs: 120, risk: 84.5, type: 'Warning' },
  { id: 215, label: 'Node #215 (Sub-regional Switching Trunk)', severity: 2, events: 7, resources: 4, logs: 450, risk: 94.2, type: 'Critical' },
  { id: 48, label: 'Node #48 (Edge Gateway Aggregator)', severity: 0, events: 1, resources: 1, logs: 32, risk: 18.0, type: 'Normal' },
  { id: 912, label: 'Node #912 (Enterprise 5G Backbone Node)', severity: 2, events: 5, resources: 3, logs: 280, risk: 91.0, type: 'Critical' }
]

const NocDashboardPage = ({ onNavigate }) => {
  const [selectedNode, setSelectedNode] = useState(PRESET_NODES[0])

  return (
    <div className="min-h-screen bg-dark text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-dark/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
          
          <div className="flex items-center gap-2.5 font-mono font-bold text-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
            NETGUARD <span className="text-primary">AI</span>
            <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-amber-300">
              NOC EXECUTIVE HUB
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('predict')}
              className="rounded-md border border-zinc-700 bg-panel px-3.5 py-1.5 text-xs font-mono text-zinc-300 transition hover:border-primary hover:text-primary"
            >
              Predict Console
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Banner Section */}
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-panel to-dark p-8 shadow-2xl">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-300 mb-4">
              <Building2 className="h-3.5 w-3.5" />
              Executive Operations &amp; Financial Risk Command Center
            </div>
            <h1 className="text-3xl font-black sm:text-4xl text-white">
              Telecom Network NOC Manager Business Model
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Transforming complex multi-node telemetry bursts into concrete financial impact metrics, SLA breach prevention ROI, MTTR reduction breakdown, and executive operational directives.
            </p>
          </div>
        </div>

        {/* Node Selector Cards Bar */}
        <div className="mb-8">
          <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            Select Active Network Mesh Node for Financial Assessment:
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRESET_NODES.map((node) => {
              const isSelected = selectedNode.id === node.id
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(253,230,138,0.25)]'
                      : 'border-zinc-800 bg-panel/60 hover:border-zinc-700 hover:bg-panel'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-300">
                      Node #{node.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        node.type === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : node.type === 'Warning'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {node.type} ({node.risk}%)
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-zinc-200 line-clamp-1">
                    {node.label}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2 font-mono text-[10px] text-zinc-400">
                    <span>Logs: {node.logs}MB</span>
                    <span>Events: {node.events}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Embedded NocBusinessImpactPanel Component */}
        <NocBusinessImpactPanel
          telemetryData={{
            location: selectedNode.id,
            present_risk: selectedNode.risk,
            severity_type: selectedNode.severity,
            num_events: selectedNode.events,
            num_resources: selectedNode.resources,
            total_log_volume: selectedNode.logs
          }}
          initialNode={selectedNode.id}
        />
      </main>
    </div>
  )
}

export default NocDashboardPage

