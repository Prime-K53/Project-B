# INVENTORY PRICING DISPLAY - FILE PATHS & SUMMARY

## Primary Files for Inventory/Product Pricing Display

### 1. INVENTORY MASTER LIST TABLE
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\InventoryViews.tsx
Purpose: Displays all inventory items in table format with parent/variant hierarchy
Key Lines:
  - Parent price: Line 257-259
  - Variant price: Line 319-321
  - Parent row layout: Line 218-299
  - Variant row layout: Line 301-336

Display Logic:
  - Raw Materials: Shows cost (red)
  - Others: Shows price (blue)
  - Variants indented with left blue border
  - Stock information shown for materials
  - Low stock alerts displayed

---

### 2. ITEM MODAL (Create/Edit)
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\ItemModal.tsx
Purpose: Comprehensive product/variant editor with pricing configuration
Key Lines:
  - SmartPricing header: Line 1460-1470
  - Cost breakdown: Line 1472-1519
  - Variant table headers: Line 2525-2560
  - Variant pricing rows: Line 2559-2639
  - Variant pricing mode selector: Line 2451-2497

Display Logic:
  - Shows parent SmartPricing calculation with full breakdown
  - Variants table shows paper/toner/finishing costs
  - Rounding adjustments displayed separately
  - Parent price priority: SmartPricing > Engine preview > Stored price

---

### 3. POS PRODUCT GRID
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\pos\components\ProductGrid.tsx
Purpose: Quick item selection for point of sale with product grid layout
Key Lines:
  - Parent price display: Line 153
  - Item card rendering: Line 117-173
  - Category filtering: Line 40-47
  - Variant selector trigger: Line 55-63

Display Logic:
  - Large/Small/List view modes
  - Price displayed at bottom of card
  - Responsive font sizing
  - Out of stock overlay for materials

---

### 4. POS VARIANT SELECTION MODAL
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\pos\components\PosModals.tsx
Purpose: Modal for selecting specific variant when adding to cart
Key Lines:
  - VariantSelectorModal export: Line 962-1040
  - Variant list rendering: Line 1010-1035
  - Variant price display: Line 1027
  - Stock status display: Line 1029-1031

Display Logic:
  - Lists all parent's variants
  - Shows individual variant price
  - Shows stock quantity per variant
  - Stock status color-coded
  - Quantity selector included

---

### 5. PRODUCT DETAILS VIEW
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\inventory\components\ProductDetails.tsx
Purpose: Detailed analytics and history for individual product
Key Lines:
  - Variant detection: Line 36-38
  - Variant sales data: Line 46-83
  - Variant stock aggregation: Line 40-44
  - Top variant tracking: Line 86

Display Logic:
  - Shows variant pricing from sales analytics
  - Calculates profit and margin per variant
  - Displays stock distribution chart
  - Tracks variant sales history

---

### 6. MAIN INVENTORY PAGE
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\views\Inventory.tsx
Purpose: Main inventory management hub
Key Lines:
  - ItemTable component usage: Line 389-399
  - ItemModal integration: Line 403-411
  - Statistics calculations: Line 35-54
  - Repair pricing function: Line 86-109

Display Logic:
  - Calculates total valuation (cost × stock)
  - Calculates potential revenue (price × stock)
  - Includes variant revenue in calculations
  - Includes raw material variants in calculations

---

## Supporting Utility Files

### 1. PRICING RESOLUTION UTILITIES
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\utils\pricing.ts
Purpose: Core pricing lookup and resolution functions
Key Functions:
  - resolveStoredSellingPrice() - Lines 37-46
  - resolveStoredCalculatedPrice() - Lines 48-63
  - resolveStoredCost() - Lines 65-73
  - normalizeStoredPricing() - Lines 75-102
  - normalizeInventoryItemPricing() - Lines 104-114
  - getUnitPrice() - Lines 122-161

Resolution Logic:
  - Multiple field priority checking
  - SmartPricing snapshot integration
  - Volume pricing support
  - Rounding difference handling

---

### 2. CONTEXT - INVENTORY CONTEXT
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\context\InventoryContext.tsx
Purpose: State management for inventory data
Key Methods:
  - fetchInventory() - Line 104
  - addItem() - Line 145
  - updateItem() - Line 174
  - reconcileInventory() - Line 440-455

Usage:
  - Provides inventory array to components
  - Handles CRUD operations
  - Manages BOM syncing

---

### 3. PRICING ENGINE
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\utils\pricing\pricingEngine.ts
Purpose: SmartPricing calculation engine
Key Functions:
  - calculateSellingPrice()
  - Dynamic variant pricing from BOM

---

### 4. PRICING SERVICE
File: C:\Users\Rhonald Chiwatu\Documents\GitHub\Prime-ERP\frontend\services\pricingService.ts
Purpose: Higher-level pricing operations
Key Methods:
  - calculateVariantPrice()
  - Used in PosModals for dynamic pricing

---

## Data Flow for Price Display

1. DATA RETRIEVAL:
   InventoryContext.fetchInventory()
   --> loads Item[] with price, cost, smartPricingSnapshot, variants[]

2. NORMALIZATION:
   normalizeInventoryItemPricing(item)
   --> ensures consistent price field population

3. RESOLUTION (on display):
   resolveStoredSellingPrice(item)
   --> returns appropriate price for current item state

4. FORMATTING:
   Currency symbol + formatNumber() or toLocaleString()
   --> presents to user

5. VARIATION (for variants):
   Each variant has independent pricing resolved same way
   --> displayed separately in table rows

---

## Current Parent Product Price Display

### In Inventory Table:
Currency + item.price (or item.cost if raw material)
Color: Blue for selling, Red for cost
Decimal places: 2

### In Item Modal (SmartPricing):
Currency + (smartPricingSnapshot.roundedPrice || enginePreview.unitPrice || item.price)
Color: Blue
Size: Large (text-2xl)
Additional: Full cost breakdown table

### In POS Grid:
Currency + resolveStoredSellingPrice(item)
Color: Blue (#0077c5)
Responsive size: xs or sm based on view mode

### In Variant Selection Modal:
Currency + resolveStoredSellingPrice(variant)
Color: Blue (#0077c5)
Plus: Stock quantity display

---

## Key Observations

1. Parent products use single price field (item.price)
2. Variants can have independent pricing (variant.price)
3. SmartPricing products have rich metadata (paper/toner/finishing costs)
4. All pricing routes through resolveStoredSellingPrice() for consistency
5. Raw materials use cost instead of price in display
6. Currency formatting is centralized via companyConfig
7. Decimal places standardized to 2
8. Color coding consistent across all displays
9. Parent and variant prices resolved independently
10. Rounding information preserved and displayed when applicable
