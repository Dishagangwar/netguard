import pandas as pd
from xgboost import XGBClassifier
import joblib
import time
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_sample_weight

print("starting model training on master dataset...")

# load data
df = pd.read_csv('../data/master_train.csv')

X = df[['location', 'severity_type', 'num_events', 'num_resources', 'total_log_volume']]
y = df['fault_severity']

print("features ->", list(X.columns))

# --- THE LEAKAGE FIX: SPLIT DATA FIRST ---
print("splitting data into train and test sets to prevent data leakage...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42,stratify = y)
# ----------------------------------------

# --- THE MAGIC FOR RECALL IMPROVEMENT ---
print("calculating balanced sample weights on TRAINING data only...")
sample_weights = compute_sample_weight(
    class_weight='balanced',
    y=y_train 
)
# ----------------------------------------

# model setup
model = XGBClassifier(
    n_estimators=100, 
    max_depth=6, 
    learning_rate=0.1, 
    random_state=42,
    objective='multi:softprob'
)

print("training xgb with class weights... wait")

# Pass the calculated weights into the fit function alongside the training split
model.fit(X_train, y_train, sample_weight=sample_weights) 

timestamp = int(time.time())
model_filename = f"xgboost_netguard_v2_{timestamp}.pkl"
joblib.dump(model, model_filename)

print("done. saved as:", model_filename)