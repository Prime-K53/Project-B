import type { Item, VolumePricingTier, ProductVariant } from '../types';

/**
 * Resolve unit price given item, quantity and optional variant.
 * Respects item.allowVolumePricing and per-variant tiers.
 * Enforces a minimumCostThreshold by clamping tier price if below threshold.
 * Does not mutate item or variant objects.
 */
export function getUnitPrice(
  item: Item,
  quantity: number,
  variantId?: string,
  options?: { minimumCostThreshold?: number }
): number {
  const minThreshold = options?.minimumCostThreshold ?? 0;

  // defensive defaults
  if (!item) return 0;
  let basePrice = Number(item.price ?? 0);
  let tiers: VolumePricingTier[] | undefined = item.volumePricing;

  if (variantId && item.variants && item.variants.length > 0) {
    const variant = (item.variants as ProductVariant[]).find(v => v.id === variantId);
    if (variant) {
      basePrice = Number(variant.price ?? basePrice);
      tiers = variant.volumePricing ?? item.volumePricing;
    }
  }

  // No volume pricing enabled or no tiers available -> return base price
  if (!item.allowVolumePricing || !tiers || tiers.length === 0) {
    return basePrice;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) return basePrice;

  // Find highest minQty <= quantity
  const applicable = tiers
    .filter(t => Number.isFinite(t.minQty) && quantity >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];

  const resolved = applicable ? Number(applicable.price) : basePrice;

  // Enforce minimum cost threshold
  if (Number.isFinite(minThreshold) && resolved < minThreshold) {
    return minThreshold;
  }

  return resolved;
}

export function formatVolumePricingHint(item: Item, variantId?: string): string | null {
  let tiers = item.volumePricing;
  if (variantId && item.variants && item.variants.length > 0) {
    const variant = item.variants.find(v => v.id === variantId);
    if (variant && variant.volumePricing && variant.volumePricing.length) tiers = variant.volumePricing;
  }
  if (!tiers || tiers.length === 0) return null;

  // Sort by minQty asc
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const parts = sorted.map((t, idx) => {
    const next = sorted[idx + 1];
    if (next) return `${t.minQty}–${next.minQty - 1}: ${t.price}`;
    return `${t.minQty}+: ${t.price}`;
  });
  return parts.join(' | ');
}

/**
 * Calculate item financials (cost, price, adjustments) based on pages, pricing config, inventory, and market adjustments.
 */
export function calculateItemFinancials(
  pages: number,
  pricingConfig: any,
  inventory: any[],
  adjustments: any[]
): {
  cost: number;
  price: number;
  adjustmentSnapshots: any[];
  transactionAdjustmentSnapshots: any[];
  breakdown: { category: string; amount: number }[];
} {
  if (!pricingConfig || !inventory) {
    return {
      cost: 0,
      price: 0,
      adjustmentSnapshots: [],
      transactionAdjustmentSnapshots: [],
      breakdown: []
    };
  }

  const { paperId, tonerId, finishingOptions, marketAdjustment, manualOverride } = pricingConfig;
  const totalPages = pages || 1;

  // Find paper and toner from inventory
  const paper = paperId ? inventory.find((item: any) => item.id === paperId) : null;
  const toner = tonerId ? inventory.find((item: any) => item.id === tonerId) : null;

  // Calculate material costs
  const paperCostPerPage = paper ? Number(paper.cost_price || paper.cost || 0) : 0;
  const tonerCostPerPage = toner ? Number(toner.cost_price || toner.cost || 0) : 0;
  const paperTotal = paperCostPerPage * totalPages;
  const tonerTotal = tonerCostPerPage * totalPages;

  // Calculate finishing costs
  let finishingTotal = 0;
  const finishingSnapshots: any[] = [];
  if (finishingOptions && finishingOptions.length > 0) {
    for (const opt of finishingOptions) {
      if (opt.id && inventory) {
        const finishItem = inventory.find((item: any) => item.id === opt.id);
        if (finishItem) {
          const cost = Number(finishItem.cost_price || finishItem.cost || 0) * (opt.quantity || 1);
          finishingTotal += cost;
          finishingSnapshots.push({
            name: opt.name || finishItem.name,
            type: 'material',
            value: cost,
            calculatedAmount: cost
          });
        }
      }
    }
  }

  // Calculate total cost
  const totalCost = paperTotal + tonerTotal + finishingTotal;

  // PHASE 1: Base Margin Layer
  const baseMarginPrice = calculateBaseSellingPrice(totalCost, pricingConfig?.marginPercent);
  if (pricingConfig?.marginPercent) {
    console.log(`[Pricing Engine] Base Margin Layer (${pricingConfig.marginPercent}%): ${baseMarginPrice}`);
  }

  // Apply market adjustment
  let price = totalCost;
  let adjustmentTotal = 0;
  const adjustmentSnapshots: any[] = [];

  if (marketAdjustment && marketAdjustment !== 0) {
    adjustmentTotal = totalCost * (marketAdjustment / 100);
    price += adjustmentTotal;
    adjustmentSnapshots.push({
      name: 'Market Adjustment',
      type: 'percentage',
      value: marketAdjustment,
      percentage: marketAdjustment,
      calculatedAmount: adjustmentTotal
    });
  }

  // Apply adjustments from market adjustments array
  const transactionAdjustmentSnapshots: any[] = [];
  const breakdown: { category: string; amount: number }[] = [
    { category: 'Paper', amount: paperTotal },
    { category: 'Toner', amount: tonerTotal },
    { category: 'Finishing', amount: finishingTotal }
  ];

  if (adjustments && adjustments.length > 0) {
    for (const adj of adjustments) {
      const adjAmount = adj.percentage
        ? totalCost * ((adj.percentage || adj.value || 0) / 100)
        : (adj.value || 0);
      adjustmentTotal += adjAmount;
      price += adjAmount;

      const snapshot = {
        name: adj.name,
        type: adj.percentage ? 'percentage' : 'fixed',
        value: adj.value || 0,
        percentage: adj.percentage,
        calculatedAmount: adjAmount
      };
      adjustmentSnapshots.push(snapshot);
      transactionAdjustmentSnapshots.push(snapshot);
    }
  }

  return {
    cost: totalCost,
    price,
    adjustmentSnapshots,
    transactionAdjustmentSnapshots,
    breakdown
  };
}

export default getUnitPrice;

/**
 * PHASE 1: Calculate the base selling price using a margin percentage.
 * This is a stable internal profit layer.
 */
export function calculateBaseSellingPrice(
  costPrice: number,
  marginPercent?: number
) {
  const margin = marginPercent ?? 0;
  return costPrice * (1 + margin / 100);
}
