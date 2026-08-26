import pandas as pd
df = pd.read_csv('../data/master_train.csv')
print("Total rows:", len(df))
print("Unique locations:", df['location'].nunique())
print("Class distribution:\n", df['fault_severity'].value_counts(normalize=True))
print("Location range:", df['location'].min(), "to", df['location'].max())
print("Feature ranges:")
for col in ['severity_type', 'num_events', 'num_resources', 'total_log_volume']:
    print(f"{col}: {df[col].min()} to {df[col].max()}")