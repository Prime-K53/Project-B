# CODE SNIPPETS: Parent Product & Variant Price Display

## 1. INVENTORY TABLE - InventoryViews.tsx (Lines 257-259)

Parent Product Price Display:
<td className=\	able-body-cell text-right finance-nums font-bold \\>
    {currency}{(item.type === " Raw Material\ ? item.cost : item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
</td>

---

## 2. INVENTORY TABLE - Variant Rows (Lines 319-321)

Variant Price Display:
<td className=\ able-body-cell text-right finance-nums font-bold \\>
 {currency}{(item.type === \Raw Material\ ? variant.cost : variant.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
</td>

---

## 3. ITEM MODAL - SmartPricing Header (Lines 1466-1468)

Selling Price Display:
<div className=\text-right\>
 <div className=\text-2xl font-bold text-blue-600\>{currency}{((formData.smartPricing?.roundedPrice ?? enginePreview?.unitPrice ?? formData.price) || 0).toFixed(2)}</div>
 <div className=\text-[10px] text-slate-500 uppercase tracking-wide\>Selling Price</div>
</div>

Display Priority:
1. formData.smartPricing?.roundedPrice
2. enginePreview?.unitPrice
3. formData.price

---

## 4. ITEM MODAL - Variant Pricing Table (Lines 2610-2616)

Selling Price Cell with Rounding Info:
<td className=\px-3 py-3 text-right\>
 <div className=\font-bold text-indigo-700 text-sm\>{currency}{resolveVariantBasePrice(variant).toFixed(2)}</div>
 {snap?.wasRounded && (
 <div className=\text-[10px] text-purple-400\>rounded +{currency}{(snap.roundingDifference ?? 0).toFixed(2)}</div>
 )}
</td>

---

## 5. ITEM MODAL - SmartPricing Breakdown (Lines 2583-2601)

Paper Cost:
<td className=\px-3 py-3 text-right text-xs text-slate-600\>
 {currency}{(snap?.paperCost ?? 0).toFixed(2)}
</td>

Toner Cost:
<td className=\px-3 py-3 text-right text-xs text-slate-600\>
 {currency}{(snap?.tonerCost ?? 0).toFixed(2)}
</td>

Finishing Cost:
<td className=\px-3 py-3 text-right text-xs text-slate-600\>
 {currency}{(snap?.finishingCost ?? 0).toFixed(2)}
</td>

Market Adjustments:
<td className=\px-3 py-3 text-right text-xs text-emerald-600\>
 +{currency}{(snap?.marketAdjustmentTotal ?? 0).toFixed(2)}
</td>

Margin:
<td className=\px-3 py-3 text-right text-xs text-orange-600\>
 +{currency}{(snap?.profitMarginAmount ?? 0).toFixed(2)}
</td>

---

## 6. POS PRODUCT GRID (Line 153)

Parent Product Price in Grid:
<span className=\ont-bold text-slate-800 \\>{currency}{formatNumber(resolveStoredSellingPrice(item as any) || 0)}</span>

---

## 7. POS VARIANT SELECTOR MODAL (Line 1027)

Variant Price Display:
<div className=\text-right ml-4\>
 <div className=\text-sm font-bold text-[#0077c5]\>{currency}{formatNumber(resolveStoredSellingPrice(v as any))}</div>
 {(product.type === \Stationery\ || product.type === \Material\ || product.type === \Raw Material\ || product.type === \Product\) && (
 <div className=\ ext-[10px] font-medium \\>
 {v.stock} in stock
 </div>
 )}
</div>

---

## 8. PRICING UTILITY - resolveStoredSellingPrice() (pricing.ts Lines 37-46)

export function resolveStoredSellingPrice(source?: PricingCarrier | null): number {
 if (!source) return 0;

 return pickPreferredNumber(
 toFiniteNumber(source.smartPricingSnapshot?.roundedPrice),
 toFiniteNumber(source.selling_price),
 toFiniteNumber(source.price),
 toFiniteNumber(source.calculated_price)
 );
}

Priority Order:
1. smartPricingSnapshot.roundedPrice
2. selling_price
3. price
4. calculated_price
5. 0 (default)

---

## 9. PRICING UTILITY - resolveStoredCost() (pricing.ts Lines 65-73)

export function resolveStoredCost(source?: PricingCarrier | null): number {
 if (!source) return 0;

 return pickPreferredNumber(
 toFiniteNumber(source.smartPricingSnapshot?.baseCost),
 toFiniteNumber(source.cost_price),
 toFiniteNumber(source.cost)
 );
}

Priority Order:
1. smartPricingSnapshot.baseCost
2. cost_price
3. cost
4. 0 (default)

---

## 10. PRICING UTILITY - normalizeInventoryItemPricing() (pricing.ts Lines 104-114)

export function normalizeInventoryItemPricing(item: Item): Item {
 const normalizedItem = normalizeStoredPricing(item);
 if (!item.variants || item.variants.length === 0) {
 return normalizedItem;
 }

 return {
 ...normalizedItem,
 variants: item.variants.map((variant) => normalizeStoredPricing(variant as ProductVariant))
 };
}

---

## KEY TAKEAWAYS

1. Parent Product Price Resolution:
 - SmartPricing products use: smartPricingSnapshot.roundedPrice
 - Regular products use: item.price (or item.cost for raw materials)
 
2. Variant Price Resolution:
 - Individual variants stored with separate pricing fields
 - Each variant resolved independently via resolveStoredSellingPrice()
 - SmartPricing variants have full snapshot with paper/toner/finishing breakdown

3. Display Formatting:
 - Currency symbol prepended: {currencySymbol}{number}
 - Default 2 decimal places: .toFixed(2)
 - Or locale-aware: .toLocaleString(undefined, { minimumFractionDigits: 2 })
 
4. Color Coding:
 - Selling prices: Blue (#0077c5 or text-blue-600)
 - Cost prices: Red (for raw materials)
 - Adjustments: Emerald, Orange, Purple based on type
 
5. Parent vs Child Display:
 - Parent: Full width row with bold product name
 - Variants: Indented child rows (pl-12) with left border (border-l-4 border-blue-400)
 - Both use same price logic but variants can be individually priced
