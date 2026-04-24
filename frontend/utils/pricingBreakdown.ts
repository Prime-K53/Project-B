import { PricingBreakdownSnapshot } from '../types';

const roundMoney = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const toPositiveQuantity = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const toAdjustmentAmount = (snapshots: any[] = []): number => {
  return roundMoney(
    snapshots.reduce((sum, snapshot) => sum + Number(snapshot?.calculatedAmount || 0), 0)
  );
};

const toAdjustmentLines = (snapshots: any[] = []) => {
  return snapshots.map((snapshot: any) => ({
    name: String(snapshot?.name || 'Adjustment'),
    type: String(snapshot?.type || 'FIXED'),
    value: roundMoney(
      snapshot?.value
      ?? snapshot?.percentage
      ?? snapshot?.calculatedAmount
      ?? 0
    )
  }));
};

export const buildPricingBreakdownSnapshot = (
  item: any
): PricingBreakdownSnapshot | undefined => {
  if (!item) return undefined;

  const existing = item.pricingBreakdown as PricingBreakdownSnapshot | undefined;
  if (existing) {
    return {
      paperCost: roundMoney(existing.paperCost),
      tonerCost: roundMoney(existing.tonerCost),
      finishingCost: roundMoney(existing.finishingCost),
      baseMaterialCost: roundMoney(existing.baseMaterialCost),
      adjustmentTotal: roundMoney(existing.adjustmentTotal),
      adjustmentLines: Array.isArray(existing.adjustmentLines) ? existing.adjustmentLines : [],
      profitMarginAmount: roundMoney(existing.profitMarginAmount),
      marginType: existing.marginType,
      marginValue: existing.marginValue,
      roundingDifference: roundMoney(existing.roundingDifference),
      wasRounded: Boolean(existing.wasRounded),
      roundingMethod: existing.roundingMethod,
      sellingPrice: roundMoney(existing.sellingPrice),
      pages: existing.pages,
      copies: existing.copies
    };
  }

  const smartSnapshot = item.smartPricingSnapshot;
  const adjustmentSnapshots = Array.isArray(item.adjustmentSnapshots) ? item.adjustmentSnapshots : [];
  const sellingPrice = roundMoney(
    item.price
    ?? item.unitPrice
    ?? item.selling_price
    ?? smartSnapshot?.roundedPrice
    ?? 0
  );
  const baseMaterialCost = roundMoney(
    smartSnapshot?.baseCost
    ?? item.basePrice
    ?? item.cost_price
    ?? item.cost
    ?? item.productionCostSnapshot?.baseProductionCost
    ?? 0
  );
  const adjustmentTotal = roundMoney(
    smartSnapshot?.marketAdjustmentTotal
    ?? item.adjustmentTotal
    ?? toAdjustmentAmount(adjustmentSnapshots)
  );
  const roundingDifference = roundMoney(
    smartSnapshot?.roundingDifference
    ?? item.roundingDifference
    ?? item.rounding_difference
    ?? 0
  );

  const explicitMargin = Number(
    smartSnapshot?.profitMarginAmount
    ?? item.profitMarginAmount
  );
  const profitMarginAmount = Number.isFinite(explicitMargin)
    ? roundMoney(explicitMargin)
    : roundMoney(sellingPrice - baseMaterialCost - adjustmentTotal - roundingDifference);

  const pages = smartSnapshot?.pages ?? item.pagesOverride ?? item.pages;
  const copies = smartSnapshot?.copies ?? item.quantity ?? item.serviceDetails?.copies;

  const paperCost = roundMoney(smartSnapshot?.paperCost ?? 0);
  const tonerCost = roundMoney(smartSnapshot?.tonerCost ?? 0);
  const finishingCost = roundMoney(smartSnapshot?.finishingCost ?? 0);

  if (
    sellingPrice === 0
    && baseMaterialCost === 0
    && adjustmentTotal === 0
    && profitMarginAmount === 0
    && roundingDifference === 0
    && paperCost === 0
    && tonerCost === 0
    && finishingCost === 0
  ) {
    return undefined;
  }

  return {
    paperCost,
    tonerCost,
    finishingCost,
    baseMaterialCost,
    adjustmentTotal,
    adjustmentLines: toAdjustmentLines(adjustmentSnapshots),
    profitMarginAmount,
    marginType: smartSnapshot?.marginType ?? item.marginType,
    marginValue: smartSnapshot?.marginValue ?? item.marginValue,
    roundingDifference,
    wasRounded: Math.abs(roundingDifference) > 0.0001 || Boolean(smartSnapshot?.wasRounded),
    roundingMethod: smartSnapshot?.roundingMethod ?? item.roundingMethod ?? item.rounding_method,
    sellingPrice,
    pages,
    copies
  };
};

export const attachPricingBreakdown = <T extends Record<string, any>>(item: T): T => {
  const pricingBreakdown = buildPricingBreakdownSnapshot(item);
  if (!pricingBreakdown) return item;
  return {
    ...item,
    pricingBreakdown
  };
};

export const summarizePricingBreakdown = (items: any[] = []) => {
  return items.reduce((summary, rawItem) => {
    const item = attachPricingBreakdown(rawItem);
    const breakdown = item.pricingBreakdown as PricingBreakdownSnapshot | undefined;
    const quantity = toPositiveQuantity(item.quantity);

    const materialTotal = roundMoney((breakdown?.baseMaterialCost ?? Number(item.cost || 0)) * quantity);
    const adjustmentTotal = roundMoney((breakdown?.adjustmentTotal ?? Number(item.adjustmentTotal || 0)) * quantity);
    const roundingTotal = roundMoney((breakdown?.roundingDifference ?? Number(item.roundingDifference || item.rounding_difference || 0)) * quantity);

    const marginPerUnit = breakdown
      ? breakdown.profitMarginAmount
      : roundMoney(
          Number(item.price || item.unitPrice || 0)
          - Number(item.cost || 0)
          - Number(item.adjustmentTotal || 0)
          - Number(item.roundingDifference || item.rounding_difference || 0)
        );

    summary.materialTotal = roundMoney(summary.materialTotal + materialTotal);
    summary.adjustmentTotal = roundMoney(summary.adjustmentTotal + adjustmentTotal);
    summary.profitMarginTotal = roundMoney(summary.profitMarginTotal + (marginPerUnit * quantity));
    summary.roundingTotal = roundMoney(summary.roundingTotal + roundingTotal);
    return summary;
  }, {
    materialTotal: 0,
    adjustmentTotal: 0,
    profitMarginTotal: 0,
    roundingTotal: 0
  });
};

