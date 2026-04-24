# Inventory Items/Products List - Pricing Display Analysis

## Overview
This document maps out how parent product prices and variant prices are currently displayed across the inventory management system. The system uses a sophisticated pricing resolution mechanism to handle multiple pricing sources (SmartPricing, standard pricing, etc.).

## Key Files and Components

### 1. Inventory Master List
File: frontend/views/inventory/components/InventoryViews.tsx

#### Parent Product Price Display (Line 257-259)
Raw Materials show: item.cost (in red-600)
Other types (Product, Service, Stationery): item.price (in blue-600)
Currency symbol prepended
Formatted to 2 decimal places
Locale-aware number formatting

#### Variant Price Display (Line 319-321)
Variants displayed as child rows with indentation (pl-12)
Blue left border (border-l-4 border-blue-400)
Lighter background (bg-slate-50/50)
Same price display logic as parent (raw material cost vs. selling price)

### 2. ItemModal (Edit/Create Product)
File: frontend/views/inventory/components/ItemModal.tsx

#### SmartPricing Product Header (Line 1466-1468)
Display Priority:
1. formData.smartPricing?.roundedPrice (SmartPricing snapshot rounded price)
2. enginePreview?.unitPrice (Calculated by pricing engine)
3. formData.price (Default/fallback)

#### Variant Price Table Display (Line 2610-2616)
Uses resolveVariantBasePrice(variant) helper function
Shows rounding difference if applicable
Color-coded: indigo-700 for price, purple-400 for rounding note

#### SmartPricing Breakdown Display (Line 2582-2601)
For SmartPricing products, the variants table shows comprehensive breakdown
- Paper Cost
- Toner Cost
- Finishing Cost
- Market Adjustments
- Margin

### 3. Product Grid (POS View)
File: frontend/views/pos/components/ProductGrid.tsx

#### Parent Product Price Display (Line 153)
Uses resolveStoredSellingPrice() to resolve price
Responsive font size (xs for small view, sm for large)
Number formatted with formatNumber() helper

#### Variant Selection Modal (Line 1027)
Variant price in blue
Stock level displayed below
Stock status color-coded (red if 0 or below, grey otherwise)

## Pricing Resolution Utilities

File: frontend/utils/pricing.ts

### resolveStoredSellingPrice() Function
Resolution Priority:
1. smartPricingSnapshot.roundedPrice - SmartPricing system rounded price
2. selling_price - Explicitly set selling price
3. price - Standard price field
4. calculated_price - Pre-rounding calculated price
5. Default: 0

### resolveStoredCost() Function
Resolution Priority:
1. smartPricingSnapshot.baseCost - SmartPricing system cost
2. cost_price - Explicit cost price
3. cost - Standard cost field
4. Default: 0

### normalizeInventoryItemPricing() Function
Normalizes both parent and all variant pricing to consistent structure

## Product Type Specific Pricing Display

1. Raw Material: Shows item.cost (in red)
2. Material / Stationery: Shows item.price (selling price in blue)
3. Product: Shows item.price (selling price in blue)
4. Service: Shows item.cost (base rate)
5. Package: Shows item.price (combined price)

## SmartPricing Components

Cost Breakdown Components:
- Paper: blue-400
- Toner: purple-400
- Finishing: green-400
- Market Adjustments: emerald-400
- Profit Margin: orange-400

## Display Formatting Standards

Currency Display: {currencySymbol}{formattedNumber}
Number Formatting: toLocaleString(undefined, { minimumFractionDigits: 2 })
Alternative: toFixed(2) for consistency

Color Scheme:
- Selling Price: Blue (#0077c5)
- Cost Price: Red (#d52b1e)
- Rounding Adjustment: Purple
- Market Adjustment: Emerald
- Margin/Profit: Orange

Text Styling:
- Price Amount: Bold, larger font (text-lg to text-2xl)
- Label: Uppercase, small font, tracking-wide
- Secondary Info: Smaller, lighter color (text-[9px] to text-[10px])
