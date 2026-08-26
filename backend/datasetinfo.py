import pandas as pd
import os

# Path to data folder (adjust if needed)
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data')

print("=" * 60)
print("NETGUARD AI - DATASET INFORMATION")
print("=" * 60)

# 1. Raw files info
raw_files = {
    'train.csv': ['id', 'location', 'fault_severity'],
    'severity_type.csv': ['id', 'severity_type'],
    'event_type.csv': ['id', 'event_type'],
    'resource_type.csv': ['id', 'resource_type'],
    'log_feature.csv': ['id', 'log_feature', 'volume']
}

print("\n--- RAW FILES ---")
for fname, cols in raw_files.items():
    fpath = os.path.join(DATA_PATH, fname)
    if os.path.exists(fpath):
        df = pd.read_csv(fpath)
        print(f"\nFile: {fname}")
        print(f"  Rows: {len(df)}")
        print(f"  Columns: {list(df.columns)}")
        print(f"  Unique IDs: {df['id'].nunique() if 'id' in df.columns else 'N/A'}")
        # For event_type, resource_type, log_feature, show rows per id stats
        if 'id' in df.columns and fname != 'train.csv' and fname != 'severity_type.csv':
            rows_per_id = df.groupby('id').size()
            print(f"  Rows per ID - min: {rows_per_id.min()}, max: {rows_per_id.max()}, mean: {rows_per_id.mean():.2f}")
    else:
        print(f"File not found: {fpath}")

# 2. Master training file info
master_path = os.path.join(DATA_PATH, 'master_train.csv')
if os.path.exists(master_path):
    master = pd.read_csv(master_path)
    print("\n--- MASTER TRAIN FILE ---")
    print(f"Rows: {len(master)}")
    print(f"Columns: {list(master.columns)}")
    print(f"Unique Locations: {master['location'].nunique()}")
    print(f"Location Range: {master['location'].min()} to {master['location'].max()}")
    
    print("\nClass Distribution:")
    class_counts = master['fault_severity'].value_counts().sort_index()
    class_pct = master['fault_severity'].value_counts(normalize=True).sort_index() * 100
    for cls in [0, 1, 2]:
        if cls in class_counts:
            print(f"  Class {cls} ({['Normal','Warning','Critical'][cls]}): Count = {class_counts[cls]}, Percentage = {class_pct[cls]:.2f}%")
    
    print("\nFeature Ranges:")
    for col in ['severity_type', 'num_events', 'num_resources', 'total_log_volume']:
        print(f"  {col}: min={master[col].min()}, max={master[col].max()}, mean={master[col].mean():.2f}")
else:
    print(f"Master file not found: {master_path}")