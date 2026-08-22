import pandas as pd

df = pd.read_csv('../data/master_train.csv')

print("Total rows:", len(df))
print("Unique locations:", df['location'].nunique())
print("Location range:", df['location'].min(), "to", df['location'].max())
print("\nClass distribution (%):")
print(df['fault_severity'].value_counts(normalize=True) * 100)
print("\nSeverity type unique values:", df['severity_type'].unique())
print("Event count range:", df['num_events'].min(), "to", df['num_events'].max())
print("Resource count range:", df['num_resources'].min(), "to", df['num_resources'].max())
print("Log volume range:", df['total_log_volume'].min(), "to", df['total_log_volume'].max())