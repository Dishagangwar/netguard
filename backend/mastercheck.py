import pandas as pd
df = pd.read_csv('../data/master_train.csv')
print("Total rows:", len(df))

print("Total rows:", len(df))
print("\nClass distribution (%):")
print(df['fault_severity'].value_counts(normalize=True) * 100)
print("\nClass counts:")
print(df['fault_severity'].value_counts())