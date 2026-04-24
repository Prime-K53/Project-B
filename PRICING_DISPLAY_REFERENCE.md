# INVENTORY PRICING DISPLAY - COMPLETE REFERENCE

## Documentation Files Created

This analysis includes three comprehensive documentation files:

### 1. INVENTORY_PRICING_DISPLAY_ANALYSIS.md
Complete technical analysis of how parent products and variants display pricing
Covers:
- Display implementation in each component
- Data structures and types
- Pricing resolution hierarchy
- SmartPricing breakdown components
- Format and styling standards
- Component integration flow

### 2. PRICING_DISPLAY_CODE_SNIPPETS.md
Direct code examples showing exact pricing display implementations
Includes:
- Line-by-line snippets from each component
- Display priority explanations
- Color coding specifications
- Format patterns used
- Helper function examples

### 3. INVENTORY_PRICING_FILES_SUMMARY.md
File-by-file guide with locations and line numbers
Lists:
- Primary display files (6 main components)
- Supporting utility files (4 files)
- Data flow for price display
- Current display logic per component
- Key observations and patterns

---

## Quick Reference: Parent Product Price Display

### In Inventory Master List Table
Location: InventoryViews.tsx Line 257-259
Display: {currency}{item.price} or {currency}{item.cost} for raw materials
Color: Blue for price, Red for cost
Format: 2 decimal places, locale-aware

### In Item Modal (SmartPricing Products)
Location: ItemModal.tsx Line 1466-1468
Display: {currency}{smartPricingSnapshot.roundedPrice || enginePreview.unitPrice || item.price}
Plus: Full cost breakdown (paper/toner/finishing/adjustments/margin)
Color: Blue, Large font (text-2xl)

### In POS Product Grid
Location: ProductGrid.tsx Line 153
Display: {currency}{resolveStoredSellingPrice(item)}
Color: Blue (#0077c5), Responsive font size
Format: Uses formatNumber() helper

### In Variant Selection Modal
Location: PosModals.tsx Line 1027
Display: {currency}{resolveStoredSellingPrice(variant)}
Plus: Stock quantity display
Color: Blue (#0077c5)

---

## Quick Reference: Pricing Resolution

### resolveStoredSellingPrice() Priority Order
1. smartPricingSnapshot.roundedPrice
2. selling_price field
3. price field
4. calculated_price field
5. 0 (default)

### resolveStoredCost() Priority Order
1. smartPricingSnapshot.baseCost
2. cost_price field
3. cost field
4. 0 (default)

---

## Key Files Involved

### Core Display Components
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\InventoryViews.tsx
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\ItemModal.tsx
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\pos\components\ProductGrid.tsx
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\pos\components\PosModals.tsx
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\ProductDetails.tsx
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\Inventory.tsx

### Pricing Utilities
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\utils\pricing.ts
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\utils\pricing\pricingEngine.ts
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\services\pricingService.ts

### State Management
- C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\context\InventoryContext.tsx

---

## Price Display Pattern Summary

1. **Parent products** use single item.price field
   - Variants indented under parent in table view
   - Each variant has independent pricing

2. **SmartPricing products** have rich metadata
   - smartPricingSnapshot with paper/toner/finishing costs
   - Complete breakdown displayed in ItemModal

3. **Raw Materials** display cost instead of price
   - Color coded in red
   - Cost-based valuation calculations

4. **Currency formatting** is centralized
   - companyConfig.currencySymbol prepended
   - 2 decimal places default
   - Locale-aware number formatting

5. **All pricing** routes through resolveStoredSellingPrice()
   - Consistent resolution hierarchy
   - Fallback to multiple sources
   - Default to 0 if no price found

---

## How to Use This Documentation

1. **For understanding current pricing display:**
   Start with INVENTORY_PRICING_DISPLAY_ANALYSIS.md
   This gives complete overview of system architecture

2. **For finding exact code snippets:**
   Refer to PRICING_DISPLAY_CODE_SNIPPETS.md
   Search for component name or line number

3. **For locating files and functions:**
   Use INVENTORY_PRICING_FILES_SUMMARY.md
   Includes file paths and line numbers for all key locations

4. **For implementing changes:**
   Focus on resolveStoredSellingPrice() and related utility functions
   All components use these central functions
   Changes here propagate to all display locations

---

## Color Reference

Display Colors Used:
- Selling Price: Blue (#0077c5, text-blue-600)
- Cost Price: Red (#d52b1e, text-red-600)
- Rounding: Purple (#purple-400)
- Adjustments: Emerald (#emerald-600)
- Margin: Orange (#orange-600)
- Paper: Blue accent
- Toner: Purple accent
- Finishing: Green accent

---

## Component Hierarchy

Inventory.tsx (Main page)
├── InventoryViews.tsx (ItemTable - displays parent/variant list)
│   └── Prices via direct item.price / variant.price
├── ItemModal.tsx (Edit product/variants)
│   └── Prices via resolveStoredSellingPrice() + SmartPricing preview
└── ProductDetails.tsx (Detail view)
    └── Variant analytics with pricing

POS.tsx (Point of Sale)
├── ProductGrid.tsx (Quick add from grid)
│   └── Prices via resolveStoredSellingPrice()
└── PosModals.tsx (Variant selection)
    └── VariantSelectorModal shows variant prices
    └── PrintingVariantModal shows dynamic pricing

---

Created: 2024
Purpose: Complete reference for parent product and variant pricing display
Scope: Frontend inventory management system
