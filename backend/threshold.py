import joblib
import glob
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, recall_score, precision_score, f1_score

# Load latest model
model_files = glob.glob("xgboost_netguard_v2_*.pkl")
latest_model = max(model_files, key=os.path.getctime)
model = joblib.load(latest_model)
print(f"Model: {latest_model}")

# Load data
df = pd.read_csv('../data/master_train.csv')
X = df[['location','severity_type','num_events','num_resources','total_log_volume']]
y = df['fault_severity']

# Same stratified split as training/evaluation
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Probabilities for all classes
proba = model.predict_proba(X_test)  # shape (n,3)
proba_critical = proba[:, 2]
proba_warning = proba[:, 1]

# Actual binary indicators
actual_critical = (y_test == 2).astype(int)

print("\nGrid Search Results (t2 for Critical, t1 for Warning):")
print("="*70)
print(f"{'t2':>4} {'t1':>4} | {'Rec_C':>6} {'Prec_C':>7} {'F1_C':>6} | {'Acc':>6} | {'Prec_W':>7} {'Rec_W':>6}")
print("-"*70)

best_combo = None
best_score = -1
# Define your scoring: maximize F0.5 (weights precision more) but ensure recall >= 0.85
for t2 in [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]:
    for t1 in [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]:
        # Apply hierarchical decision
        y_pred = []
        for p in proba:
            if p[2] >= t2:
                y_pred.append(2)
            elif p[1] >= t1:
                y_pred.append(1)
            else:
                y_pred.append(0)
        y_pred = np.array(y_pred)
        
        # Compute metrics for Critical class
        rec_c = recall_score(actual_critical, (y_pred == 2).astype(int))
        prec_c = precision_score(actual_critical, (y_pred == 2).astype(int))
        f1_c = f1_score(actual_critical, (y_pred == 2).astype(int))
        
        # Overall accuracy
        acc = np.mean(y_pred == y_test)
        
        # Warning precision/recall (optional)
        actual_warning = (y_test == 1).astype(int)
        prec_w = precision_score(actual_warning, (y_pred == 1).astype(int))
        rec_w = recall_score(actual_warning, (y_pred == 1).astype(int))
        
        # Print row
        print(f"{t2:4.2f} {t1:4.2f} | {rec_c:6.2f} {prec_c:7.2f} {f1_c:6.2f} | {acc:6.2f} | {prec_w:7.2f} {rec_w:6.2f}")
        
        # Custom scoring: F1 for critical, but add penalty if recall < 0.85
        if rec_c >= 0.85:
            score = f1_c  # You can change to F0.5: (1+0.5**2)*prec_c*rec_c / (0.5**2*prec_c + rec_c)
            if score > best_score:
                best_score = score
                best_combo = (t2, t1)

print("\nBest combination with recall >= 0.85 (max F1):")
print(f"t2 = {best_combo[0]}, t1 = {best_combo[1]}")
print(f"Score (F1) = {best_score:.2f}")