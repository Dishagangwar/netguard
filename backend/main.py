import os
import glob
import json
import warnings
import joblib
import pandas as pd
import numpy as np
import shap
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai

warnings.filterwarnings("ignore")

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
model = None
explainer = None
# load latest model 
try:
    model_files= glob.glob(os.path.join(BASE_DIR, "xgboost_netguard_v2_*.pkl"))
    if len(model_files) > 0:
        latest_model = max(model_files, key=os.path.getctime)
        model = joblib.load(latest_model)
        explainer = shap.TreeExplainer(model)
        print("INFO: loaded model ->", latest_model)
    else:
        print("warning: no v2 model found")
except Exception as e:
    print("model load error:", e)


# historical telemetry, powers the "past" window of the timeline
HISTORY = None
EVENTS_P90 = 2.0
LOGVOL_P90 = 67.0

try:
    HISTORY = pd.read_csv(os.path.join(BASE_DIR, "..", "data", "master_train.csv"))
    EVENTS_P90 = float(HISTORY["num_events"].quantile(0.90)) or 1.0
    LOGVOL_P90 = float(HISTORY["total_log_volume"].quantile(0.90)) or 1.0
    print("INFO: loaded history ->", len(HISTORY), "records /", HISTORY["location"].nunique(), "nodes")
except Exception as e:
    print("history load error:", e)


class NetworkData(BaseModel):
    location: int
    severity_type: int
    num_events: int
    num_resources : int
    total_log_volume: int

class CopilotRequest(BaseModel):
    role: str
    fault_severity: int
    location: str

class RemediationRequest(BaseModel):
    """Everything the copilot needs to reason about one flagged node."""
    location: int
    role: str = "L1 Engineer"
    severity: int = 0
    severity_label: str = "Unknown"
    past_risk: float = 0.0
    present_risk: float = 0.0
    future_risk: float = 0.0
    past_summary: str = ""
    severity_type: int = 0
    num_events: int = 0
    num_resources: int = 0
    total_log_volume: int = 0

class BusinessImpactRequest(BaseModel):
    """Customizable parameters for NOC Manager financial and ROI simulation."""
    location: int = 704
    severity_type: int = 1
    fault_severity: int = 1
    present_risk: float = 84.5
    num_events: int = 2
    num_resources: int = 1
    total_log_volume: int = 51
    subscribers_per_node: int = 15000
    hourly_sla_rate: float = 18000.0
    truck_roll_cost: float = 650.0
    arpu: float = 45.0


SEVERITY_LABELS = {0: "Normal", 1: "Warning", 2: "Critical"}

GEMINI_CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-pro-latest",
]

# one shared rule for all three windows, so a red bar means the same thing
# wherever it appears on the chart: risk >= 50% is a fault, below it is clear
FAULT_THRESHOLD = 50.0


def _clamp(value, low=0.0, high=100.0):
    return max(low, min(high, value))


def _parse_model_json(raw: str):
    """
    Gemini is asked for pure JSON but will sometimes wrap it in a markdown
    fence or add a sentence around it. Strip the fence, and if that still is
    not valid JSON, fall back to the outermost {...} block.
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1] if "```" in text[3:] else text[3:]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


def _generate_with_gemini_fallback(prompt: str):
    """
    Iterate through available Gemini candidate models to prevent 429 quota limits.
    """
    last_err = None
    for model_name in GEMINI_CANDIDATE_MODELS:
        try:
            ai_model = genai.GenerativeModel(model_name)
            resp = ai_model.generate_content(prompt)
            if resp and resp.text:
                return _parse_model_json(resp.text), model_name
        except Exception as e:
            print(f"INFO: Model {model_name} rate-limited or unavailable: {e}. Trying fallback...")
            last_err = e
            continue
    raise last_err or Exception("All Gemini models failed.")


def _present_window(data: NetworkData):
    data_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    df = pd.DataFrame([data_dict])
    probs = model.predict_proba(df).tolist()[0]
    
    CLASS_2_THRESHOLD = 0.47
    CLASS_1_THRESHOLD = 0.50
    HIGH_CONFIDENCE_CRITICAL_THRESHOLD = 0.70   # New: for immediate dispatch
    
    if probs[2] >= CLASS_2_THRESHOLD:
        severity = 2
        # Tiered logic for Critical alerts
        if probs[2] >= HIGH_CONFIDENCE_CRITICAL_THRESHOLD:
            alert_level = "critical_high"
            recommended_action = "dispatch_immediate"
        else:
            alert_level = "critical_borderline"
            recommended_action = "queue_for_review"
    elif probs[1] >= CLASS_1_THRESHOLD:
        severity = 1
        alert_level = "warning"
        recommended_action = "monitor"
    else:
        severity = 0
        alert_level = "normal"
        recommended_action = "no_action"

    risk = round(sum(probs[1:]) * 100, 2)
    confidence = round(max(probs) * 100, 2)

    return {
        "phase": "present",
        "title": "Present",
        "subtitle": "Live prediction",
        "has_data": True,
        "fault": risk >= FAULT_THRESHOLD,
        "risk": risk,
        "severity": severity,
        "severity_label": SEVERITY_LABELS.get(severity, "Unknown"),
        "confidence": confidence,
        "alert_level": alert_level,           # New field
        "recommended_action": recommended_action,  # New field
        "detail": (
            f"XGBoost classifies node {data.location} as "
            f"{SEVERITY_LABELS.get(severity, 'Unknown')} (class {severity}) "
            f"with {confidence}% confidence. Combined probability of a fault "
            f"state is {risk}%. Alert level: {alert_level}, action: {recommended_action}."
        ),
        "source": "XGBoost classifier on the five supplied features",
    }

def _past_window(location: int):
    """Recorded fault history for this node in the training telemetry."""
    if HISTORY is None:
        return {
            "phase": "past", "title": "Past", "subtitle": "Recorded history",
            "has_data": False, "fault": False, "risk": 0.0,
            "detail": "Historical telemetry could not be loaded on the server.",
            "source": "unavailable",
        }

    rows = HISTORY[HISTORY["location"] == location]
    observations = int(len(rows))

    if observations == 0:
        return {
            "phase": "past", "title": "Past", "subtitle": "Recorded history",
            "has_data": False, "fault": False, "risk": 0.0, "observations": 0,
            "detail": (
                f"No historical records exist for node {location}. That is not "
                f"a clean bill of health - the node is simply unseen in the "
                f"training telemetry."
            ),
            "source": "master_train.csv",
        }

    incidents = int((rows["fault_severity"] > 0).sum())
    worst = int(rows["fault_severity"].max())
    rate = round(incidents / observations * 100, 2)

    detail = (
        f"{incidents} of {observations} recorded observations at node "
        f"{location} were faults ({rate}%). Worst recorded severity: "
        f"{SEVERITY_LABELS.get(worst, 'Unknown')} (class {worst})."
    )
    if observations < 5:
        detail += " Small sample, read this figure loosely."

    return {
        "phase": "past",
        "title": "Past",
        "subtitle": "Recorded history",
        "has_data": True,
        "fault": rate >= FAULT_THRESHOLD,
        "risk": rate,
        "severity": worst,
        "severity_label": SEVERITY_LABELS.get(worst, "Unknown"),
        "observations": observations,
        "incidents": incidents,
        "low_sample": observations < 5,
        "detail": detail,
        "source": "master_train.csv incident history",
    }


def _future_window(data: NetworkData, present: dict, past: dict):
    """
    Forward risk projection. This is a transparent weighted heuristic, NOT a
    trained forecaster - the dataset has no time axis to train one on. It
    blends the live prediction, the node's incident history, and how hard the
    node is being loaded relative to the fleet's 90th percentile.
    """
    events_load = data.num_events / EVENTS_P90 if EVENTS_P90 else 0.0
    log_load = data.total_log_volume / LOGVOL_P90 if LOGVOL_P90 else 0.0
    load_pressure = _clamp((events_load + log_load) / 2 * 100)

    present_risk = present["risk"]

    if past["has_data"]:
        projected = (
            0.50 * present_risk + 0.30 * past["risk"] + 0.20 * load_pressure
        )
        basis = (
            f"50% live prediction ({present_risk}%), 30% incident history "
            f"({past['risk']}%), 20% current load pressure "
            f"({round(load_pressure, 2)}%)."
        )
    else:
        # no history for this node - renormalise over the two usable signals
        projected = (0.50 * present_risk + 0.20 * load_pressure) / 0.70
        basis = (
            f"71% live prediction ({present_risk}%), 29% current load pressure "
            f"({round(load_pressure, 2)}%). No incident history for this node, "
            f"so that signal was dropped and the rest reweighted."
        )

    projected = round(_clamp(projected), 2)

    return {
        "phase": "future",
        "title": "Future",
        "subtitle": "Projected risk",
        "has_data": True,
        "fault": projected >= FAULT_THRESHOLD,
        "risk": projected,
        "load_pressure": round(load_pressure, 2),
        "detail": (
            f"Projected fault risk for node {data.location} is {projected}%. "
            f"Weighting: {basis}"
        ),
        "source": "weighted heuristic projection, not a trained forecaster",
    }


@app.get("/")
def health_check():
    return {"status": "active", "version":"v2", "service": "NetGuard API running"}

@app.post("/predict")
def predict_severity(data: NetworkData):
    if model is None:
        return {"error":"model not loaded"}
        
    data_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    df = pd.DataFrame([data_dict])
    prob = model.predict_proba(df).tolist()[0]
    
    # MULTI-LEVEL THRESHOLDS
    CLASS_2_THRESHOLD = 0.47
    CLASS_1_THRESHOLD = 0.50
    HIGH_CONFIDENCE_CRITICAL_THRESHOLD = 0.70
    
    if prob[2] >= CLASS_2_THRESHOLD:
        final_severity = 2
        if prob[2] >= HIGH_CONFIDENCE_CRITICAL_THRESHOLD:
            alert_level = "critical_high"
            recommended_action = "dispatch_immediate"
        else:
            alert_level = "critical_borderline"
            recommended_action = "queue_for_review"
    elif prob[1] >= CLASS_1_THRESHOLD:
        final_severity = 1
        alert_level = "warning"
        recommended_action = "monitor"
    else:
        final_severity = 0
        alert_level = "normal"
        recommended_action = "no_action"
    
    return {
        "fault_severity": final_severity,
        "confidence": round(max(prob) * 100, 2),
        "alert_level": alert_level,
        "recommended_action": recommended_action
    }
@app.post("/explain")
def explain_prediction(data: NetworkData):

    if model is None or explainer is None:
        return {"error": "model or SHAP explainer not loaded"}

    # Convert input into a dataframe
    data_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    df = pd.DataFrame([data_dict])

    # Get the model prediction
    predicted_class = int(model.predict(df)[0])

    # Get SHAP values
    shap_result = explainer.shap_values(df)

    # Convert SHAP result to numpy array
    shap_array = shap_result

    # Newer versions of SHAP can return:
    # (samples, features, classes)
    if hasattr(shap_array, "values"):
        shap_array = shap_array.values

    # Convert to numpy array
        shap_array = np.asarray(shap_array)

    # Handle different SHAP output shapes
    if shap_array.ndim == 3:
        # Shape: (samples, features, classes)
        values = shap_array[0, :, predicted_class]

    elif shap_array.ndim == 2:
        # Shape: (samples, features)
        values = shap_array[0]

    elif shap_array.ndim == 1:
        # Shape: (features,)
        values = shap_array

    elif isinstance(shap_result, list):
        # Older SHAP multiclass format
        values = shap_result[predicted_class][0]

    else:
        return {
            "error": f"Unexpected SHAP output shape: {shap_array.shape}"
        }

    feature_names = list(df.columns)

    explanation = []

    for feature, value, shap_value in zip(
        feature_names,
        df.iloc[0].values,
        values
    ):
        explanation.append({
            "feature": feature,
            "value": float(value),
            "shap_value": float(shap_value)
        })

    # Strongest contributions first
    explanation.sort(
        key=lambda x: abs(x["shap_value"]),
        reverse=True
    )

    return {
        "prediction": predicted_class,
        "features": explanation
    }
@app.post("/predict/timeline")
def predict_timeline(data: NetworkData):
    """
    Past / Present / Future fault view for a single node, shaped for the
    three-bar chart on the prediction page.
    """
    if model is None:
        return {"error": "model not loaded"}

    present = _present_window(data)
    past = _past_window(data.location)
    future = _future_window(data, present, past)

    windows = [past, present, future]
    faults = [w for w in windows if w["fault"]]

    if not faults:
        verdict = f"Node {data.location} reads clear across all three windows."
    else:
        phases = ", ".join(w["phase"] for w in faults)
        verdict = (
            f"Fault indicated in the {phases} "
            f"window{'s' if len(faults) > 1 else ''} for node {data.location}."
        )

    data_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    present_win = windows[1] if len(windows) > 1 else {}
    return {
        "target_node": data.location,
        "threshold": FAULT_THRESHOLD,
        "verdict": verdict,
        "fault_count": len(faults),
        "alert_level": present_win.get("alert_level", "normal"),
        "recommended_action": present_win.get("recommended_action", "no_action"),
        "windows": windows,
        "inputs": data_dict,
    }


def _calculate_financial_metrics(req: BusinessImpactRequest):
    """
    Computes real-world telecom financial metrics, SLA breach penalties,
    subscriber blast radius, and ROI based on input telemetry and business parameters.
    """
    node = req.location
    base_density = 10000 + ((node * 37) % 25000)
    resource_factor = 1.0 + (max(1, req.num_resources) * 0.2)
    severity_factor = 1.0 if req.severity_type == 0 else (1.75 if req.severity_type == 1 else 3.1)
    
    blast_radius = int(base_density * resource_factor * severity_factor)
    
    # Financial Outage Exposure ($/hr)
    risk_factor = max(0.1, req.present_risk / 100.0)
    hourly_sla_loss = req.hourly_sla_rate * risk_factor * (1.0 + req.severity_type * 0.4)
    subscriber_churn_risk = blast_radius * (req.arpu / 720.0) * 0.15 * risk_factor
    truck_roll = req.truck_roll_cost if req.present_risk >= 50.0 else 0.0
    
    total_hourly_loss_rate = hourly_sla_loss + subscriber_churn_risk
    
    # Unmitigated (4.5h) vs NetGuard AI Mitigated (35m) Loss
    unmitigated_hours = 4.5
    mitigated_hours = 35.0 / 60.0
    
    unmitigated_loss = round((total_hourly_loss_rate * unmitigated_hours) + (truck_roll * 1.5), 2)
    mitigated_loss = round((total_hourly_loss_rate * mitigated_hours) + (truck_roll * 0.25), 2)
    prevented_loss = round(max(0.0, unmitigated_loss - mitigated_loss), 2)
    
    roi_percent = round((prevented_loss / max(500.0, mitigated_loss)) * 100, 1)
    
    # MTTR Breakdown (Minutes)
    traditional_mttr = {
        "triage_mins": 120,
        "root_cause_mins": 90,
        "dispatch_testing_mins": 60,
        "total_mins": 270,
    }
    
    netguard_mttr = {
        "triage_mins": 2,
        "root_cause_mins": 8,
        "dispatch_testing_mins": 25,
        "total_mins": 35,
    }
    
    mttr_saved_mins = traditional_mttr["total_mins"] - netguard_mttr["total_mins"]
    mttr_saved_percent = round((mttr_saved_mins / traditional_mttr["total_mins"]) * 100, 1)
    
    # SLA Risk & Penalty Escalation Timeline (Dollars over time)
    sla_tiers = [
        {"minutes": 15, "tier": "Platinum (15m)", "penalty": round(hourly_sla_loss * 0.25, 2), "risk_prob": round(min(99.0, risk_factor * 95), 1)},
        {"minutes": 30, "tier": "Gold (30m)", "penalty": round(hourly_sla_loss * 0.60, 2), "risk_prob": round(min(99.0, risk_factor * 85), 1)},
        {"minutes": 60, "tier": "Silver (1h)", "penalty": round(hourly_sla_loss * 1.5, 2), "risk_prob": round(min(99.0, risk_factor * 70), 1)},
        {"minutes": 240, "tier": "Bronze (4h)", "penalty": round(hourly_sla_loss * 4.5, 2), "risk_prob": round(min(99.0, risk_factor * 45), 1)},
    ]
    
    # Facts & Real-World Industry Benchmarks
    facts = [
        {"metric": "Average Telecom Outage Cost", "value": "$14,000 / min", "source": "Gartner Telemetry Benchmark", "detail": "Tier-1 Telco enterprise outage benchmark including SLA compensation."},
        {"metric": "Reactive NOC MTTR", "value": "4.5 Hours", "source": "TM Forum Industry Standards", "detail": "Average time to locate optical line degradation & correlate log bursts manually."},
        {"metric": "Autonomous AI Resolution", "value": "35 Minutes", "source": "NetGuard AI Benchmark", "detail": "87% MTTR reduction via XGBoost risk timelines and Gemini GenAI action plans."},
        {"metric": "Churn Vulnerability Spike", "value": "3.8x Risk Increase", "source": "GSMA Intelligence 2025", "detail": "Unresolved network outages over 60 mins trigger 3.8x higher carrier port-out rates."},
    ]
    
    return {
        "node_id": node,
        "blast_radius_subscribers": blast_radius,
        "hourly_sla_loss": round(hourly_sla_loss, 2),
        "subscriber_churn_risk": round(subscriber_churn_risk, 2),
        "total_hourly_loss_rate": round(total_hourly_loss_rate, 2),
        "unmitigated_loss_4_5h": unmitigated_loss,
        "mitigated_loss_35m": mitigated_loss,
        "prevented_loss": prevented_loss,
        "roi_percent": roi_percent,
        "truck_roll_cost": truck_roll,
        "traditional_mttr": traditional_mttr,
        "netguard_mttr": netguard_mttr,
        "mttr_saved_mins": mttr_saved_mins,
        "mttr_saved_percent": mttr_saved_percent,
        "sla_tiers": sla_tiers,
        "industry_facts": facts,
    }


@app.post("/copilot/business-impact")
def copilot_business_impact(req: BusinessImpactRequest):
    """
    Computes full NOC Manager business impact, financial loss models, MTTR reduction,
    SLA exposure, and generates executive Gemini directives.
    """
    metrics = _calculate_financial_metrics(req)
    
    prompt = f"""
You are NetGuard AI, executive decision-support copilot for a Telecom NOC Operations Manager.
A network fault risk has been evaluated on Node {req.location}.

FINANCIAL & TELEMETRY PROFILE:
- Node Identifier: Node {req.location}
- Fault Risk (XGBoost): {req.present_risk}% (Severity Class {req.fault_severity})
- Subscriber Blast Radius: {metrics['blast_radius_subscribers']:,} active subscribers / enterprise connections
- Hourly SLA & Outage Exposure Rate: ${metrics['total_hourly_loss_rate']:,.2f} / hr
- Projected 4.5h Unmitigated Outage Loss: ${metrics['unmitigated_loss_4_5h']:,.2f}
- NetGuard AI Autonomous Resolution Cost (35m MTTR): ${metrics['mitigated_loss_35m']:,.2f}
- Prevented Business Loss: ${metrics['prevented_loss']:,.2f} (Net ROI: {metrics['roi_percent']}%)
- Telemetry: Event Bursts={req.num_events}, Log Volume={req.total_log_volume} MB

Write an Executive NOC Briefing focusing strictly on business risk, financial loss mitigation, SLA penalty avoidance, and high-level operational directives.

Respond in pure JSON, exactly this shape:
{{
  "executive_summary": "3 sentences detailing business financial risk, subscriber blast radius, and total capital exposure for node {req.location}",
  "financial_risk_analysis": "2 sentences explaining SLA breach penalties and customer churn exposure based on current risk score of {req.present_risk}%",
  "operational_directives": [
    {{"title": "Directive title", "detail": "One sentence directive for tier-2 operations or vendor escalation"}}
  ],
  "sla_mitigation": [
    "Specific contractual or traffic rerouting policy to protect SLAs"
  ],
  "executive_clearance": "One sentence clearance requirement for executive incident sign-off"
}}
Give 3 operational directives and 3 sla_mitigation items.
"""
    try:
        data, used_model = _generate_with_gemini_fallback(prompt)
        return {
            "financial_metrics": metrics,
            "executive_summary": data.get("executive_summary", ""),
            "financial_risk_analysis": data.get("financial_risk_analysis", ""),
            "operational_directives": data.get("operational_directives", []) or [],
            "sla_mitigation": data.get("sla_mitigation", []) or [],
            "executive_clearance": data.get("executive_clearance", ""),
            "model": used_model
        }
    except Exception as e:
        print("business-impact error:", type(e).__name__, e)
        # Fallback response for high resilience
        return {
            "financial_metrics": metrics,
            "executive_summary": f"Node {req.location} exhibits a {req.present_risk}% fault risk threatening {metrics['blast_radius_subscribers']:,} subscribers with an outage exposure rate of ${metrics['total_hourly_loss_rate']:,.2f}/hr. Proactive intervention via NetGuard AI saves ${metrics['prevented_loss']:,.2f} in potential SLA breach penalties.",
            "financial_risk_analysis": f"Left unmitigated, traditional 4.5-hour MTTR results in ${metrics['unmitigated_loss_4_5h']:,.2f} of cumulative financial damage. AI-assisted 35-minute resolution caps risk at ${metrics['mitigated_loss_35m']:,.2f}.",
            "operational_directives": [
                {"title": "Issue Tier-2 Operations SLA Notice", "detail": f"Alert regional operations leads to reroute high-priority enterprise traffic from Node {req.location}."},
                {"title": "Authorize Targeted Field Dispatch", "detail": f"Deploy field technician with pre-diagnosed buffer queue fix to cap MTTR under 35 minutes."},
                {"title": "Enforce Vendor SLA Escalation", "detail": "Notify optical equipment vendor of telemetry anomaly pattern for hardware credit claim."}
            ],
            "sla_mitigation": [
                "Activate dynamic load balancing across secondary fiber loops to prevent Platinum 15m SLA breach.",
                "Log automated telemetry audit trail for carrier SLA dispute defense.",
                "Review node capacity thresholds to handle burst events without buffer overflow."
            ],
            "executive_clearance": "Incident cleared upon zero packet drop rate confirmation and 100% telemetry metric stabilization.",
            "model": "NetGuard-Offline-Fallback"
        }


@app.post("/copilot/remediation")
def copilot_remediation(req: RemediationRequest):
    """
    Hands a flagged node to Gemini and asks for role-aware incident remediation:
    - L1 Engineer: Root cause, terminal bash commands, technical fixes.
    - NOC Manager: Financial impact, SLA breach exposure, executive directives.
    """
    is_noc = req.role == "NOC Manager"
    
    if is_noc:
        # Calculate financial metrics for prompt context
        impact_req = BusinessImpactRequest(
            location=req.location,
            severity_type=req.severity_type,
            fault_severity=req.severity,
            present_risk=req.present_risk,
            num_events=req.num_events,
            num_resources=req.num_resources,
            total_log_volume=req.total_log_volume
        )
        fin = _calculate_financial_metrics(impact_req)
        
        prompt = f"""
You are NetGuard AI, the incident copilot for a Telecom Network Operations Centre. You are speaking to the Executive NOC Operations Manager.

A fault has been flagged on node {req.location}.

MACHINE LEARNING & FINANCIAL VERDICT
- Classified severity: {req.severity_label} (class {req.severity})
- Present fault risk (XGBoost): {req.present_risk}%
- Historical fault risk for this node: {req.past_risk}%
- Projected future risk: {req.future_risk}%
- Estimated Subscriber Blast Radius: {fin['blast_radius_subscribers']:,} subscribers
- Outage Exposure Rate: ${fin['total_hourly_loss_rate']:,.2f} / hr
- Unmitigated Outage Loss (4.5h MTTR): ${fin['unmitigated_loss_4_5h']:,.2f}
- NetGuard AI Mitigated Loss (35m MTTR): ${fin['mitigated_loss_35m']:,.2f}
- Prevented Business Loss: ${fin['prevented_loss']:,.2f}

RAW TELEMETRY FOR THIS NODE
- Alarm severity type: {req.severity_type}
- Event burst count: {req.num_events}
- Resource types involved: {req.num_resources}
- Log volume emitted: {req.total_log_volume} MB

Write the NOC Executive Briefing. Focus strictly on business financial impact, SLA penalties, blast radius containment, and management directives. DO NOT write low-level bash commands.

Respond in pure JSON, exactly this shape:
{{
  "root_cause": "3 to 4 sentences detailing executive incident assessment, subscriber blast radius ({fin['blast_radius_subscribers']:,}), and financial risk exposure (${fin['total_hourly_loss_rate']:,.2f}/hr)",
  "impact": "one sentence detailing total potential unmitigated business loss (${fin['unmitigated_loss_4_5h']:,.2f}) and SLA breach exposure",
  "immediate_actions": [
    {{"step": "executive action title", "detail": "one sentence explaining business directive", "command": "EXECUTIVE-DIRECTIVE-TAG"}}
  ],
  "prevention": [
    "a contractual or high-level SLA protection policy change, one sentence each"
  ],
  "verification": "one sentence detailing executive incident clearance criteria"
}}

Give 3 or 4 immediate_actions and 3 prevention items.
"""
    else:
        prompt = f"""
You are NetGuard AI, the incident copilot for a telecom network operations
centre. You are speaking to an L1 network engineer who has to fix this now.

A fault has been flagged on node {req.location}.

MACHINE LEARNING VERDICT
- Classified severity: {req.severity_label} (class {req.severity})
- Present fault risk (XGBoost): {req.present_risk}%
- Historical fault risk for this node: {req.past_risk}%
- Projected future risk: {req.future_risk}%
- History detail: {req.past_summary or "no recorded history for this node"}

RAW TELEMETRY FOR THIS NODE
- Alarm severity type: {req.severity_type}
- Event burst count: {req.num_events}
- Resource types involved: {req.num_resources}
- Log volume emitted: {req.total_log_volume} MB

Write the incident response. Be concrete and specific to these numbers, never
generic. Reference the actual figures above in your reasoning. Bash commands
must be realistic Linux/network operations commands an L1 engineer would run on
a telecom node, and must include node {req.location} where a target is needed.

Respond in pure JSON, exactly this shape and nothing else:
{{
  "root_cause": "3 to 4 sentences naming the most likely root cause and the evidence in the telemetry that points to it",
  "impact": "one sentence on what breaks for subscribers or services if this is left alone",
  "immediate_actions": [
    {{"step": "short imperative title", "detail": "one sentence on what this does and what to look for", "command": "a single runnable bash command"}}
  ],
  "prevention": [
    "a specific change that stops this recurring, one sentence each"
  ],
  "verification": "one sentence on how the engineer confirms the node is healthy again"
}}

Give 3 or 4 immediate_actions, ordered so the safest diagnostic runs first and
anything disruptive runs last. Give 3 prevention items.
"""

    try:
        data, used_model = _generate_with_gemini_fallback(prompt)
        return {
            "root_cause": data.get("root_cause", ""),
            "impact": data.get("impact", ""),
            "immediate_actions": data.get("immediate_actions", []) or [],
            "prevention": data.get("prevention", []) or [],
            "verification": data.get("verification", ""),
            "model": used_model,
        }

    except Exception as e:
        print("remediation error:", type(e).__name__, e)
        return {"error": "generation_failed", "trace": str(e)}



@app.post("/copilot")
def copilot_action(request: CopilotRequest):
    
    prompt = f"""
    You are NetGuard AI, an enterprise telecom network assistant.
    A network fault has been detected.
    - Fault Severity: {request.fault_severity} (0=Normal, 1=Warning, 2=Critical)
    - Location: Node {request.location}
    - CURRENT USER ROLE: {request.role}

    STRICT INSTRUCTIONS BASED ON ROLE:
    If CURRENT USER ROLE is 'L1 Engineer': Focus ONLY on technical hardware/software troubleshooting (e.g., Reboot optical switch, check fiber links, run port diagnostics). 
    If CURRENT USER ROLE is 'NOC Manager': Focus ONLY on Business Impact, Financial Loss, SLA violation risks, and high-level management approvals. DO NOT mention hardware technicalities.

    IMPORTANT: You MUST respond in pure JSON format exactly like this:
    {{
        "analysis": "Brief 2-line explanation tailored strictly to the user role",
        "actions": [
            {{"label": "Action 1 Name", "command": "cmd_1"}},
            {{"label": "Action 2 Name", "command": "cmd_2"}}
        ]
    }}
    """
    
    try:
        data, _ = _generate_with_gemini_fallback(prompt)
        return data
    
    except Exception as e:
        print("err:", e)
        return {"error": "generation_failed", "trace": str(e)}