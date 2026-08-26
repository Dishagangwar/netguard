import joblib
import pandas as pd
import os
import glob
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split

def evaluate_latest_model():
    print("--- NETGUARD AI: MODEL EVALUATION (MULTI-LEVEL THRESHOLD) ---")
    
    model_files = glob.glob("xgboost_netguard_v2_*.pkl")
    if not model_files:
        print("[ERROR] No model found.")
        return
    
    latest_model = max(model_files, key=os.path.getctime)
    print(f"[INFO] Evaluating latest model: {latest_model}")
    model = joblib.load(latest_model)
    
    df = pd.read_csv('../data/master_train.csv')
    feature_cols = ['location', 'severity_type', 'num_events', 'num_resources', 'total_log_volume']
    
    X = df[feature_cols]
    y = df['fault_severity']

    # 100% Leakage-Free Stratified Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # --- MULTI-LEVEL THRESHOLDS ---
    print("[INFO] Applying Logic: 47% for Critical, 50% strict for Warning...")
    y_proba = model.predict_proba(X_test)
    
    CLASS_2_THRESHOLD = 0.47
    CLASS_1_THRESHOLD = 0.50
    
    y_pred = []
    for probs in y_proba:
        if probs[2] >= CLASS_2_THRESHOLD:
            y_pred.append(2)
        elif probs[1] >= CLASS_1_THRESHOLD:
            y_pred.append(1)
        else:
            y_pred.append(0)
    # ---------------------------------------------
    
    accuracy = accuracy_score(y_test, y_pred)
    conf_matrix = confusion_matrix(y_test, y_pred)
    class_report = classification_report(y_test, y_pred, zero_division=0)

    print(f"\nModel Accuracy on Test Split: {accuracy * 100:.2f}%\n")
    print("Detailed Classification Report:")
    print(class_report)
    
    plt.figure(figsize=(6, 5))
    sns.heatmap(conf_matrix, annot=True, fmt='d', cmap='Blues', cbar=False)
    plt.title(f'XGBoost - Acc: {accuracy*100:.2f}%')
    plt.xlabel('Predicted Severity')
    plt.ylabel('Actual Severity')
    plt.tight_layout()
    plt.savefig('confusion_matrix_plot.png')
    print("\n[INFO] Saved visualization as 'confusion_matrix_plot.png'")

if __name__ == '__main__':
    evaluate_latest_model()