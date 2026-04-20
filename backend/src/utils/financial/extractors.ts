// NOTE: Identical copy exists in frontend/utils/financial/extractors.ts
// These are intentional runtime parallels — do not import across
// backend/frontend boundary. If logic changes, update both files.
export function extractProfitMargin(trans: any): number {
  const snapshot = trans?.adjustmentSnapshots?.find((adj: any) => adj?.name === 'Profit Margin');
  if (snapshot && typeof snapshot.amount === 'number') {
    return snapshot.amount;
  }

  if (typeof trans?.profitAdjustment === 'number') {
    return trans.profitAdjustment;
  }

  return 0;
}
