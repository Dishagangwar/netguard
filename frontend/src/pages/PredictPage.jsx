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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
} from 'lucide-react'

import FaultTimelineChart from '../components/FaultTimelineChart'
import AiCopilotPanel from '../components/AiCopilotPanel'


/* ============================================================
   API CONFIGURATION
   ============================================================ */

const API =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '8000'
    ? window.location.origin
    : 'http://127.0.0.1:8000')


/* ============================================================
   PREDICTION LOADING STAGES
   ============================================================ */

const PREDICTION_STAGES = [
  { at: 0, text: 'Model is predicting...' },
  { at: 1300, text: 'Ingesting node telemetry & log features...' },
  { at: 2700, text: 'Running XGBoost multi-window classifier...' },
  { at: 4000, text: 'Synthesizing Past, Present & Future risk timeline...' },
]


/* ============================================================
   DEFAULT INPUTS
   ============================================================ */

const DEFAULTS = {
  location: 704,
  severity_type: 1,
  num_events: 2,
  num_resources: 1,
  total_log_volume: 51,
}


/* ============================================================
   SEVERITY OPTIONS
   ============================================================ */

const SEVERITY_OPTIONS = [
  {
    value: 0,
    label: 'Type 0',
    hint: 'Baseline alarm class',
  },
  {
    value: 1,
    label: 'Type 1',
    hint: 'Elevated alarm class',
  },
  {
    value: 2,
    label: 'Type 2',
    hint: 'Highest alarm class',
  },
]


/* ============================================================
   SLIDER COMPONENT
   ============================================================ */

const Slider = ({
  Icon,
  label,
  hint,
  min,
  max,
  value,
  onChange,
  unit,
}) => (
  <div>
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-bold text-zinc-300">
        <Icon className="h-4 w-4 text-zinc-500" />
        {label}
      </label>

      <span className="font-mono text-lg font-bold text-primary">
        {value}
        {unit ? (
          <span className="ml-1 text-xs text-zinc-500">{unit}</span>
        ) : null}
      </span>
    </div>

    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-primary"
    />

    <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600">
      <span>{min}</span>
      <span className="text-zinc-500">{hint}</span>
      <span>{max}</span>
    </div>
  </div>
)


/* ============================================================
   SHAP EXPLANATION COMPONENT
   ============================================================ */

const ShapExplanation = ({ explanation }) => {
  if (!explanation) {
    return null
  }

  const features = Array.isArray(explanation.features)
    ? explanation.features
    : []

  if (features.length === 0) {
    return null
  }

  const maxAbs = Math.max(
    ...features.map((item) => Math.abs(Number(item.shap_value) || 0)),
    0.0001,
  )

  const prediction = explanation.prediction

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-primary/20 bg-panel shadow-xl">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="border-b border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                  Explainable AI
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Why did the model make this prediction?
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
              SHAP shows how each telemetry feature influenced the XGBoost
              prediction. A positive value pushes the prediction higher,
              while a negative value pushes it lower.
            </p>
          </div>

          {/* Prediction badge */}

          <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Predicted Class
            </p>

            <p className="mt-1 font-mono text-3xl font-bold text-primary">
              {prediction}
            </p>
          </div>
        </div>
      </div>


      {/* ======================================================
          SHAP LEGEND
          ====================================================== */}

      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" />
            <span>Positive contribution</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            <span className="h-3 w-3 rounded-sm bg-red-500" />
            <span>Negative contribution</span>
          </div>

          <div className="flex items-center gap-2 text-zinc-500">
            <Info className="h-3.5 w-3.5" />
            <span>Larger bar = stronger influence</span>
          </div>
        </div>
      </div>


      {/* ======================================================
          FEATURE EXPLANATIONS
          ====================================================== */}

      <div className="space-y-5 p-6">
        {features.map((item, index) => {
          const shapValue = Number(item.shap_value) || 0
          const absValue = Math.abs(shapValue)

          const width = Math.max(
            4,
            Math.min(100, (absValue / maxAbs) * 100),
          )

          const positive = shapValue >= 0

          return (
            <div key={`${item.feature}-${index}`}>
              {/* Feature title */}

              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {positive ? (
                    <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 shrink-0 text-red-400" />
                  )}

                  <span className="truncate font-mono text-sm font-bold text-zinc-200">
                    {item.feature}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500">
                    value: {item.value}
                  </span>

                  <span
                    className={`font-mono text-sm font-bold ${
                      positive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {shapValue.toFixed(4)}
                  </span>
                </div>
              </div>


              {/* Bar */}

              <div className="h-4 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                <div
                  className={`h-full rounded-md transition-all duration-700 ${
                    positive
                      ? 'bg-emerald-500/80'
                      : 'bg-red-500/80'
                  }`}
                  style={{
                    width: `${width}%`,
                  }}
                />
              </div>


              {/* Explanation */}

              <div className="mt-1.5 text-[11px] text-zinc-600">
                {positive ? (
                  <span>
                    This feature pushed the model toward the predicted class.
                  </span>
                ) : (
                  <span>
                    This feature pushed the model away from the predicted
                    class.
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>


      {/* ======================================================
          SUMMARY
          ====================================================== */}

      <div className="border-t border-zinc-800 bg-zinc-950/40 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

          <div>
            <h3 className="font-bold text-zinc-200">
              What this means
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              The SHAP values provide evidence for the model's decision by
              showing which network telemetry signals contributed most to the
              prediction. This makes the XGBoost model easier to understand
              instead of treating it as a black box.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


/* ============================================================
   MAIN PAGE
   ============================================================ */

const PredictPage = ({ onNavigate }) => {
  const [form, setForm] = useState(DEFAULTS)

  const [result, setResult] = useState(null)

  const [loading, setLoading] = useState(false)

  const [loadingPhase, setLoadingPhase] = useState(
    'Model is predicting...',
  )

  const [progress, setProgress] = useState(0)

  const [activeRole, setActiveRole] = useState('L1 Engineer')

  const [error, setError] = useState(null)


  /* ==========================================================
     SHAP STATE
     ========================================================== */

  const [shapExplanation, setShapExplanation] = useState(null)

  const [shapLoading, setShapLoading] = useState(false)

  const [shapError, setShapError] = useState(null)


  /* ==========================================================
     COPILOT STATE
     ========================================================== */

  const [copilot, setCopilot] = useState(null)

  const [copilotLoading, setCopilotLoading] = useState(false)

  const [copilotError, setCopilotError] = useState(null)


  /* ==========================================================
     RUN ID
     ========================================================== */

  const [runId, setRunId] = useState(0)


  /* ==========================================================
     INPUT SETTER
     ========================================================== */

  const set = (key) => (value) =>
    setForm((f) => ({
      ...f,
      [key]: value,
    }))


  /* ==========================================================
     GEMINI COPILOT
     ========================================================== */

  const askCopilot = async (timeline, role = activeRole) => {
    const byPhase = Object.fromEntries(
      timeline.windows.map((w) => [w.phase, w]),
    )

    setCopilotLoading(true)
    setCopilotError(null)
    setCopilot(null)

    try {
      const res = await axios.post(
        `${API}/copilot/remediation`,
        {
          location: timeline.target_node,

          role: role,

          severity: byPhase.present?.severity ?? 0,

          severity_label:
            byPhase.present?.severity_label ?? 'Unknown',

          past_risk: byPhase.past?.risk ?? 0,

          present_risk: byPhase.present?.risk ?? 0,

          future_risk: byPhase.future?.risk ?? 0,

          past_summary: byPhase.past?.detail ?? '',

          severity_type: Number(
            timeline.inputs.severity_type,
          ),

          num_events: Number(
            timeline.inputs.num_events,
          ),

          num_resources: Number(
            timeline.inputs.num_resources,
          ),

          total_log_volume: Number(
            timeline.inputs.total_log_volume,
          ),
        },
        {
          timeout: 25000,
        },
      )

      if (res.data?.error) {
        setCopilotError(
          res.data.trace || res.data.error,
        )
      } else {
        setCopilot(res.data)
      }
    } catch (e) {
      console.warn(
        'copilot network/timeout fallback:',
        e,
      )

      setCopilot({
        role: role,

        root_cause: `Hardware alert and elevated error log volume on Node ${timeline.target_node}. Present fault probability is ${
          byPhase.present?.risk ?? 0
        }%.`,

        impact: `Subscribers connected to Node ${timeline.target_node} may experience packet degradation or localized service dropouts.`,

        immediate_actions:
          role === 'NOC Manager'
            ? [
                {
                  step: 'Notify Tier-2 Operations Lead',

                  detail:
                    'Issue executive advisory and monitor regional SLA threshold.',

                  command:
                    'ESCALATE-TIER2-ADVISORY',
                },

                {
                  step: 'Authorize Field Dispatch',

                  detail:
                    'Deploy on-call fiber technician to verify node physical rack.',

                  command: `DISPATCH-TECH-NODE-${timeline.target_node}`,
                },
              ]
            : [
                {
                  step: 'Check Interface Port Status',

                  detail:
                    'Inspect optical link errors and interface carrier health.',

                  command:
                    'sudo ip -s link show dev eth0',
                },

                {
                  step: 'Inspect Error Log Stream',

                  detail:
                    'Filter recent critical error messages on the node.',

                  command:
                    'journalctl -p err -n 100 --no-pager',
                },

                {
                  step: 'Restart Interface',

                  detail:
                    'Perform controlled restart of the degraded network interface.',

                  command:
                    'sudo ip link set dev eth0 down && sleep 2 && sudo ip link set dev eth0 up',
                },
              ],

        prevention: [
          `Review optical transceiver health and log volume trends on Node ${timeline.target_node}.`,

          `Schedule routine switch maintenance during next low-traffic maintenance window.`,
        ],

        verification:
          'Confirm 0% packet loss and verify alarm severity returns to baseline.',

        model: 'NetGuard-Offline-Fallback',
      })
    }

    setCopilotLoading(false)
  }


  /* ==========================================================
     ROLE CHANGE
     ========================================================== */

  const handleRoleChange = (newRole) => {
    setActiveRole(newRole)

    if (
      result &&
      result.fault_count > 0
    ) {
      askCopilot(result, newRole)
    }
  }


  /* ==========================================================
     SHAP EXPLANATION
     ========================================================== */

  const explainPrediction = async (payload) => {
    setShapLoading(true)
    setShapError(null)
    setShapExplanation(null)

    try {
      const res = await axios.post(
        `${API}/explain`,
        payload,
        {
          timeout: 20000,
        },
      )

      if (res.data?.error) {
        setShapError(
          res.data.trace ||
            res.data.error,
        )

        return
      }

      setShapExplanation(res.data)
    } catch (e) {
      console.error(
        'SHAP explanation failed:',
        e,
      )

      setShapError(
        'SHAP explanation could not be generated. The prediction itself is still available.',
      )
    } finally {
      setShapLoading(false)
    }
  }


  /* ==========================================================
     RUN PREDICTION
     ========================================================== */

  const runPrediction = async () => {
    setLoading(true)

    setError(null)

    setCopilot(null)

    setCopilotError(null)

    setShapExplanation(null)

    setShapError(null)

    setProgress(0)

    setLoadingPhase(
      'Model is predicting...',
    )

    const node = Number(form.location)

    if (
      !Number.isInteger(node) ||
      node < 1 ||
      node > 1126
    ) {
      setError(
        'Target Node ID must be a valid node number between 1 and 1126.',
      )

      setLoading(false)

      return
    }


    /* Scroll to result */

    setTimeout(
      () =>
        document
          .getElementById('result')
          ?.scrollIntoView({
            behavior: 'smooth',
          }),
      50,
    )


    /* ========================================================
       PREPARE PAYLOAD
       ======================================================== */

    const payload = {
      location: node,

      severity_type: Number(
        form.severity_type,
      ),

      num_events: Number(
        form.num_events,
      ),

      num_resources: Number(
        form.num_resources,
      ),

      total_log_volume: Number(
        form.total_log_volume,
      ),
    }


    /* ========================================================
       LOADING ANIMATION
       ======================================================== */

    const startTime = Date.now()

    const DURATION = 5000

    const progressInterval =
      setInterval(() => {
        const elapsed =
          Date.now() - startTime

        const currentProgress =
          Math.min(
            99,
            (elapsed / DURATION) * 100,
          )

        setProgress(
          currentProgress,
        )

        const stage =
          PREDICTION_STAGES
            .slice()
            .reverse()
            .find(
              (s) =>
                elapsed >= s.at,
            )

        if (stage) {
          setLoadingPhase(
            stage.text,
          )
        }
      }, 50)


    /* ========================================================
       API REQUESTS
       ======================================================== */

    try {
      /*
       * Timeline prediction and SHAP explanation are requested
       * independently.
       *
       * SHAP failure will NOT break the main prediction.
       */

      const timelinePromise =
        axios.post(
          `${API}/predict/timeline`,
          payload,
        )

      const shapPromise =
        axios
          .post(
            `${API}/explain`,
            payload,
            {
              timeout: 20000,
            },
          )
          .catch((err) => {
            console.warn(
              'SHAP request failed:',
              err,
            )

            return {
              data: {
                __shapError: true,
              },
            }
          })


      const [
        timelineRes,
        shapRes,
      ] = await Promise.all([
        timelinePromise,
        shapPromise,
      ])


      /* ======================================================
         WAIT FOR UI ANIMATION
         ====================================================== */

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            DURATION,
          ),
      )


      clearInterval(
        progressInterval,
      )

      setProgress(100)


      /* ======================================================
         HANDLE TIMELINE
         ====================================================== */

      if (
        timelineRes.data?.error
      ) {
        setError(
          `Backend returned an error: ${timelineRes.data.error}`,
        )

        return
      }


      /* ======================================================
         SET TIMELINE RESULT
         ====================================================== */

      setResult(
        timelineRes.data,
      )

      setRunId(
        (n) => n + 1,
      )


      /* ======================================================
         HANDLE SHAP RESULT
         ====================================================== */

      if (
        shapRes.data &&
        !shapRes.data.__shapError &&
        Array.isArray(
          shapRes.data.features,
        )
      ) {
        setShapExplanation(
          shapRes.data,
        )

        setShapError(null)
      } else {
        setShapError(
          'SHAP explanation could not be generated for this prediction.',
        )
      }


      /* ======================================================
         SCROLL
         ====================================================== */

      setTimeout(
        () =>
          document
            .getElementById(
              'result',
            )
            ?.scrollIntoView({
              behavior: 'smooth',
            }),
        80,
      )


      /* ======================================================
         GEMINI COPILOT
         ====================================================== */

      if (
        timelineRes.data
          .fault_count > 0
      ) {
        askCopilot(
          timelineRes.data,
        )
      }
    } catch (e) {
      clearInterval(
        progressInterval,
      )

      console.error(
        'prediction failed:',
        e,
      )

      setError(
        'Could not reach the NetGuard API. Please ensure the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }


  /* ==========================================================
     RESET
     ========================================================== */

  const reset = () => {
    setForm(DEFAULTS)

    setResult(null)

    setError(null)

    setCopilot(null)

    setCopilotError(null)

    setShapExplanation(null)

    setShapError(null)

    setShapLoading(false)

    setProgress(0)
  }


  /* ==========================================================
     UI
     ========================================================== */

  return (
    <div className="min-h-screen bg-dark text-white">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-dark/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

          <button
            onClick={() =>
              onNavigate('home')
            }
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2 font-mono font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" />

            NETGUARD{' '}

            <span className="text-primary">
              AI
            </span>
          </div>

          <span className="hidden text-xs text-zinc-600 sm:block">
            XGBoost + SHAP + Gemini
          </span>
        </div>
      </header>


      {/* ======================================================
          MAIN
          ====================================================== */}

      <main className="mx-auto max-w-6xl px-6 py-12">

        {/* PAGE TITLE */}

        <div className="mb-10">

          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            Fault prediction
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Analyse a network node
          </h1>

          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">
            Set the five telemetry signals below and run the engine.
            You get a prediction covering the node's past, present
            and future fault state, together with an explainable AI
            breakdown showing why the model made its decision.
          </p>

        </div>


        {/* ====================================================
            INPUT + RESULT GRID
            ==================================================== */}

        <div className="grid gap-8 lg:grid-cols-5">


          {/* ==================================================
              INPUT PANEL
              ================================================== */}

          <div className="lg:col-span-2">

            <div className="sticky top-24 rounded-xl border border-zinc-700 bg-panel p-6 shadow-xl">

              <h2 className="mb-6 flex items-center gap-2 border-b border-zinc-700 pb-3 font-bold text-zinc-200">
                <ServerCog className="h-5 w-5 text-primary" />

                Telemetry input
              </h2>


              <div className="space-y-6">

                {/* NODE */}

                <div>

                  <label
                    htmlFor="node-id"
                    className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-300"
                  >
                    <Network className="h-4 w-4 text-zinc-500" />

                    Target Node ID
                  </label>

                  <input
                    id="node-id"
                    type="number"
                    min={1}
                    max={1126}
                    value={
                      form.location
                    }
                    onChange={(e) =>
                      set('location')(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-md border border-zinc-600 bg-dark p-3 font-mono text-lg font-bold text-primary outline-none transition focus:border-primary"
                  />

                  <p className="mt-1.5 text-[10px] text-zinc-600">
                    Nodes 1–1126 appear in
                    the training telemetry.
                  </p>

                </div>


                {/* SEVERITY */}

                <div>

                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-300">

                    <Siren className="h-4 w-4 text-zinc-500" />

                    Severity Type

                  </label>

                  <div className="grid grid-cols-3 gap-2">

                    {SEVERITY_OPTIONS.map(
                      (opt) => (
                        <button
                          key={
                            opt.value
                          }
                          onClick={() =>
                            set(
                              'severity_type',
                            )(
                              opt.value,
                            )
                          }
                          title={
                            opt.hint
                          }
                          className={`rounded-md border py-2.5 font-mono text-sm font-bold transition ${
                            Number(
                              form.severity_type,
                            ) ===
                            opt.value
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-zinc-600 bg-dark text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          {
                            opt.label
                          }
                        </button>
                      ),
                    )}

                  </div>

                </div>


                {/* EVENTS */}

                <Slider
                  Icon={Zap}
                  label="Event Burst Count"
                  hint="events fired"
                  min={1}
                  max={9}
                  value={
                    form.num_events
                  }
                  onChange={set(
                    'num_events',
                  )}
                />


                {/* RESOURCES */}

                <Slider
                  Icon={Layers}
                  label="Resource Count"
                  hint="resource types"
                  min={1}
                  max={5}
                  value={
                    form.num_resources
                  }
                  onChange={set(
                    'num_resources',
                  )}
                />


                {/* LOG VOLUME */}

                <Slider
                  Icon={ScrollText}
                  label="Log Volume"
                  hint="log payload"
                  min={1}
                  max={1650}
                  value={
                    form.total_log_volume
                  }
                  onChange={set(
                    'total_log_volume',
                  )}
                  unit="MB"
                />

              </div>


              {/* RUN BUTTON */}

              <button
                onClick={
                  runPrediction
                }
                disabled={loading}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-mono font-bold text-dark shadow-[0_0_20px_rgba(253,230,138,0.35)] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-80"
              >

                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />

                    PREDICTING... (
                    {Math.round(
                      progress,
                    )}
                    %)
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4" />

                    RUN FAULT PREDICTION
                  </>
                )}

              </button>


              {/* RESET */}

              <button
                onClick={reset}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 py-2.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />

                Reset inputs
              </button>

            </div>
          </div>


          {/* ==================================================
              RESULT PANEL
              ================================================== */}

          <div
            id="result"
            className="lg:col-span-3"
          >

            {/* ERROR */}

            {error && (
              <div className="mb-6 rounded-lg border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
                {error}
              </div>
            )}


            {/* =================================================
                LOADING
                ================================================= */}

            {loading && (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 rounded-2xl border border-primary/30 bg-panel/90 p-8 text-center shadow-2xl backdrop-blur">

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

                  <h3 className="font-mono text-xl font-bold tracking-wide text-white transition-all duration-300">

                    {loadingPhase}

                  </h3>

                  <p className="font-mono text-xs text-zinc-400">

                    Evaluating Node{' '}

                    {form.location}

                    {' '}• Telemetry parameters locked

                  </p>

                </div>


                {/* PROGRESS BAR */}

                <div className="w-full max-w-sm">

                  <div className="h-2 w-full overflow-hidden rounded-full border border-zinc-700 bg-zinc-800/80 p-0.5">

                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-primary to-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.5)] transition-all duration-100 ease-out"
                      style={{
                        width: `${progress}%`,
                      }}
                    />

                  </div>

                  <div className="mt-2 flex justify-between text-xs font-mono text-zinc-500">

                    <span>
                      Processing Telemetry
                    </span>

                    <span className="font-bold text-primary">
                      {Math.round(
                        progress,
                      )}
                      %
                    </span>

                  </div>

                </div>


                {/* TELEMETRY BADGES */}

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">

                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Node:{' '}
                    <b className="text-zinc-200">
                      #{form.location}
                    </b>
                  </span>

                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Severity:{' '}
                    <b className="text-zinc-200">
                      Type{' '}
                      {
                        form.severity_type
                      }
                    </b>
                  </span>

                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Events:{' '}
                    <b className="text-zinc-200">
                      {
                        form.num_events
                      }
                    </b>
                  </span>

                  <span className="rounded border border-zinc-700/60 bg-dark/60 px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Logs:{' '}
                    <b className="text-zinc-200">
                      {
                        form.total_log_volume
                      }{' '}
                      MB
                    </b>
                  </span>

                </div>

              </div>
            )}


            {/* =================================================
                EMPTY STATE
                ================================================= */}

            {!loading &&
              !result &&
              !error && (
                <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-700 bg-panel/40 px-8 text-center">

                  <Cpu className="h-12 w-12 text-zinc-700" />

                  <p className="font-mono text-zinc-500">
                    Engine on standby
                  </p>

                  <p className="max-w-sm text-sm text-zinc-600">
                    Set your telemetry values
                    and run the prediction.
                    The prediction,
                    SHAP explanation and
                    incident response
                    appear here.
                  </p>

                </div>
              )}


            {/* =================================================
                TIMELINE CHART
                ================================================= */}

            {result &&
              !loading && (
                <FaultTimelineChart
                  key={`chart-${runId}`}
                  result={result}
                />
              )}


            {/* =================================================
                SHAP LOADING
                ================================================= */}

            {result &&
              !loading &&
              shapLoading && (
                <div className="mt-8 rounded-xl border border-primary/20 bg-panel p-8 text-center">

                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">

                    <BarChart3 className="h-6 w-6 animate-pulse text-primary" />

                  </div>

                  <h3 className="mt-4 font-mono font-bold text-zinc-200">
                    Generating SHAP explanation...
                  </h3>

                  <p className="mt-2 text-xs text-zinc-500">
                    Calculating how each telemetry
                    feature influenced the XGBoost
                    prediction.
                  </p>

                </div>
              )}


            {/* =================================================
                SHAP ERROR
                ================================================= */}

            {result &&
              !loading &&
              !shapLoading &&
              shapError && (
                <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">

                  <div className="flex items-start gap-3">

                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

                    <div>

                      <h3 className="font-bold text-amber-300">
                        SHAP explanation unavailable
                      </h3>

                      <p className="mt-1 text-sm text-zinc-500">
                        {shapError}
                      </p>

                    </div>

                  </div>

                </div>
              )}


            {/* =================================================
                SHAP EXPLANATION
                ================================================= */}

            {result &&
              !loading &&
              shapExplanation && (
                <ShapExplanation
                  explanation={
                    shapExplanation
                  }
                />
              )}


            {/* =================================================
                COPILOT
                ================================================= */}

            {result &&
              !loading && (
                <AiCopilotPanel
                  key={`copilot-${runId}-${activeRole}`}
                  data={copilot}
                  loading={
                    copilotLoading
                  }
                  error={
                    copilotError
                  }
                  node={
                    result.target_node
                  }
                  activeRole={
                    activeRole
                  }
                  onRoleChange={
                    handleRoleChange
                  }
                  telemetryData={{
                    location:
                      Number(
                        form.location,
                      ),

                    severity_type:
                      Number(
                        form.severity_type,
                      ),

                    num_events:
                      Number(
                        form.num_events,
                      ),

                    num_resources:
                      Number(
                        form.num_resources,
                      ),

                    total_log_volume:
                      Number(
                        form.total_log_volume,
                      ),

                    present_risk:
                      result.windows?.find(
                        (w) =>
                          w.phase ===
                          'present',
                      )?.risk ??
                      84.5,
                  }}
                />
              )}


            {/* =================================================
                NO FAULT MESSAGE
                ================================================= */}

            {result &&
              !loading &&
              result.fault_count ===
                0 && (
                <p className="mt-8 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-zinc-400">

                  All three windows are clear,
                  so the GenAI incident commander
                  was not engaged. The SHAP
                  explanation above still shows
                  which telemetry features
                  influenced the model's decision.

                </p>
              )}


            {/* =================================================
                FUTURE BAR DISCLAIMER
                ================================================= */}

            {result &&
              !loading && (
                <p className="mt-6 rounded-lg border border-zinc-800 bg-panel/40 p-4 text-xs leading-relaxed text-zinc-500">

                  <b className="text-zinc-400">
                    On the future bar:
                  </b>{' '}
                  the dataset has no time axis,
                  so this is a transparent weighted
                  projection rather than a trained
                  forecaster. Its exact weighting
                  is printed on the Future card
                  above. Treat it as an early warning
                  signal, not a scheduled failure.

                </p>
              )}

          </div>

        </div>

      </main>
    </div>
  )
}


export default PredictPage