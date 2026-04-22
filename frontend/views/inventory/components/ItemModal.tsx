import React, { useState, useEffect, useMemo } from 'react';
// PRICING RULE: Do NOT implement pricing logic here. All pricing MUST go through pricingEngine.ts
import { X, Save, Plus, Trash2, AlertCircle, Package, DollarSign, Hash, MapPin, Truck, Tag, FileText, Box, Layers, ArrowRight, Wand2, Grid, Scale, RefreshCw, Eye, EyeOff, Info, Check, Edit3, TrendingUp } from 'lucide-react';
import { Item, Warehouse, ProductVariant, PricingConfig, FinishingOption, AdjustmentSnapshot, BOMTemplate, VolumePricingTier } from '../../../types';
import { useData } from '../../../context/DataContext';
import { generateAutoSKU, generateAutoBarcode, generateBulkVariants } from '../../../utils/skuGenerator';
import { pricingService } from '../../../services/pricingService';
import { dbService } from '../../../services/db';
import { applyProductPriceRounding, ROUNDING_METHOD_OPTIONS } from '../../../services/pricingRoundingService';
import { calculateBaseSellingPrice } from '../../../utils/pricing';
import { calculateSellingPrice } from '../../../utils/pricing/pricingEngine';
import { getGlobalDefaultMargin } from '../../../services/pricingService';

// Generate a unique ID without external dependency
const generateId = (): string => {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

interface ItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Item) => Promise<void> | void;
    onUpdate: (item: Item) => Promise<void> | void;
    item?: Item | null; // For edit mode
    warehouses: Warehouse[];
    mode: 'add' | 'edit';
}

interface FormErrors {
    name?: string;
    sku?: string;
    category?: string;
    type?: string;
    price?: string;
    cost?: string;
    stock?: string;
    unit?: string;
}

const defaultItem: Partial<Item> = {
    name: '',
    sku: '',
    description: '',
    price: 0,
    cost: 0,
    stock: 0,
    category: '',
    type: 'Product',
    unit: 'pcs',
    minStockLevel: 0,
    preferredSupplierId: '',
    binLocation: '',
    barcode: '',
    purchaseUnit: '',
    usageUnit: '',
    conversionRate: 1,
    isLargeFormat: false,
    rollWidth: 0,
    rollLength: 0,
    pages: 1,
    leadTimeDays: 0,
    minOrderQty: 1,
    reorderPoint: 0,
    marginPercent: 0,
    variants: [],
    isVariantParent: false,
    isStationeryPack: false,
    costPerPack: 0,
    unitsPerPack: 0,

    locationStock: [],
    pricingConfig: {
        marketAdjustment: 0,
        finishingOptions: [],
        manualOverride: false
    }
};

const DEFAULT_FINISHING_BUTTONS: Array<{ id: string; name: string; cost: number; description?: string }> = [
    { id: 'binding', name: 'Binding', cost: 150, description: 'Book binding - comb or spiral' },
    { id: 'coverPages', name: 'Cover Pages', cost: 20, description: 'Front and back cover pages per copy' },
    { id: 'cutting', name: 'Cutting & Trimming', cost: 30, description: 'Trim edges to clean finish' },
    { id: 'holePunch', name: 'Hole Punching', cost: 20, description: 'Punch holes for folder binding' },
    { id: 'folding', name: 'Folding', cost: 15, description: 'Fold pages for insertion' },
    { id: 'stapling', name: 'Stapling', cost: 10, description: 'Corner or saddle stapling' }
];

interface VolumePricingManagerProps {
    enabled: boolean;
    tiers: VolumePricingTier[];
    onToggle: (enabled: boolean) => void;
    onChange: (tiers: VolumePricingTier[]) => void;
    currency: string;
    basePrice: number;
    cost: number;
}

const VolumePricingManager: React.FC<VolumePricingManagerProps> = ({
    enabled,
    tiers,
    onToggle,
    onChange,
    currency,
    basePrice,
    cost
}) => {
    const sortedTiers = [...(tiers || [])].sort((a, b) => a.minQty - b.minQty);

    const addTier = () => {
        const lastTier = sortedTiers[sortedTiers.length - 1];
        const nextMinQty = lastTier ? lastTier.minQty + 10 : 2;
        const nextPrice = lastTier ? lastTier.price * 0.9 : basePrice * 0.9;
        onChange([...(tiers || []), { minQty: nextMinQty, price: Number(nextPrice.toFixed(2)) }]);
    };

    const removeTier = (index: number) => {
        const newTiers = [...(tiers || [])];
        const tierToRemove = sortedTiers[index];
        const realIdx = (tiers || []).findIndex(t => t === tierToRemove);
        if (realIdx > -1) {
            newTiers.splice(realIdx, 1);
            onChange(newTiers);
        }
    };

    const updateTier = (index: number, field: keyof VolumePricingTier, value: number) => {
        const newTiers = [...(tiers || [])];
        const tierToUpdate = sortedTiers[index];
        const realIdx = (tiers || []).findIndex(t => t === tierToUpdate);
        if (realIdx > -1) {
            newTiers[realIdx] = { ...newTiers[realIdx], [field]: value };
            onChange(newTiers);
        }
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Volume Pricing</h3>
                        <p className="text-[10px] text-slate-500">Enable tiered pricing based on quantity</p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enabled}
                        onChange={(e) => onToggle(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {enabled && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-12 gap-2 px-1">
                        <div className="col-span-5 text-[10px] font-bold text-slate-400 uppercase">Min Quantity</div>
                        <div className="col-span-5 text-[10px] font-bold text-slate-400 uppercase">Unit Price ({currency})</div>
                        <div className="col-span-2"></div>
                    </div>

                    {sortedTiers.map((tier, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-5">
                                <input
                                    type="number"
                                    min="2"
                                    value={tier.minQty}
                                    onChange={(e) => updateTier(idx, 'minQty', Number(e.target.value))}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Qty starts from"
                                />
                            </div>
                            <div className="col-span-5">
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currency}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={tier.price}
                                        onChange={(e) => updateTier(idx, 'price', Number(e.target.value))}
                                        className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Price for this tier"
                                    />
                                </div>
                            </div>
                            <div className="col-span-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => removeTier(idx)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addTier}
                        className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add New Tier
                    </button>

                    {sortedTiers.length > 0 && sortedTiers.some(t => t.price >= basePrice) && (
                        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                            <p className="text-[10px] text-amber-700">Tiered price should typically be lower than base price ({currency}{basePrice.toFixed(2)})</p>
                        </div>
                    )}

                    {sortedTiers.length > 0 && sortedTiers.some(t => t.price < cost) && (
                        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                            <p className="text-[10px] text-red-700">Warning: One or more tiers are priced below cost ({currency}{cost.toFixed(2)})</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ItemModal: React.FC<ItemModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onUpdate,
    item,
    warehouses,
    mode
}) => {

    const { suppliers, companyConfig, inventory, marketAdjustments } = useData();
    const currency = companyConfig.currencySymbol || '$';

    const [formData, setFormData] = useState<Partial<Item>>(defaultItem);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'inventory' | 'variants'>('basic');
    
    // Style constants for flat design
    const styles = {
        label: "text-[11px] font-medium uppercase tracking-[0.05em] text-slate-500 block mb-1.5",
        sectionTitle: "text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400 mb-4 pb-2 border-b-[0.5px] border-slate-100",
        input: "w-full px-3 py-2 bg-white border-[0.5px] border-slate-200 rounded-[8px] text-[13px] font-normal text-slate-800 focus:border-slate-400 outline-none transition-all placeholder:text-slate-300",
        textarea: "w-full px-3 py-2 bg-white border-[0.5px] border-slate-200 rounded-[8px] text-[13px] font-normal text-slate-800 focus:border-slate-400 outline-none transition-all placeholder:text-slate-300 min-h-[80px]",
        select: "w-full px-3 py-2 bg-white border-[0.5px] border-slate-200 rounded-[8px] text-[13px] font-normal text-slate-800 focus:border-slate-400 outline-none transition-all appearance-none",
        card: "bg-white border-[0.5px] border-slate-100 rounded-[12px] p-5 mb-4",
        modal: "bg-white rounded-[12px] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden",
        priceValue: "text-[18px] font-medium text-slate-900",
        metricValue: "text-[15px] font-medium text-slate-800",
        row: "flex items-center justify-between py-2.5 border-b-[0.5px] border-slate-50 last:border-0",
        summaryRow: "flex items-center justify-between py-3 px-4 bg-slate-50/50 rounded-[8px] mb-2",
        highlightRow: "flex items-center justify-between py-4 px-6 -mx-6 bg-slate-100 mt-4", // surface-secondary
        title: "text-[15px] font-medium text-slate-900",
        tableHeader: "text-[11px] font-medium uppercase tracking-wider text-slate-400 px-3 py-2 border-b-[0.5px] border-slate-100",
        tableCell: "text-[13px] text-slate-800 px-3 py-2 border-b-[0.5px] border-slate-50",
    };

    const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({
        id: '',
        sku: '',
        name: '',
        attributes: {},
        price: 0,
        cost: 0,
        stock: 0,
        marginPercent: 0,
        pages: 1,
        volumePricing: []
    });
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [expandedVariantPricing, setExpandedVariantPricing] = useState<string | null>(null);
    // Live price preview for the "Add Variant" form
    const [variantPreview, setVariantPreview] = useState<ReturnType<typeof calculateSmartVariantPrice>>(null);

    // Bulk Variant Generation State
    const [showBulkGenerator, setShowBulkGenerator] = useState(false);
    const [bulkAttributes, setBulkAttributes] = useState<{ name: string, values: string[] }[]>([{ name: 'Size', values: [] }]);
    const [bulkInputValue, setBulkInputValue] = useState<{ [key: number]: string }>({});
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [bomLoading, setBomLoading] = useState<boolean>(true);
    const [finishingButtons, setFinishingButtons] = useState<Array<{ id: string; name: string; cost: number; description?: string }>>([]);

    // Rounding Engine State
    const [showInternalPricing, setShowInternalPricing] = useState(true);
    const [isRecalculating, setIsRecalculating] = useState(false);

    // Stationery Pack Conversion State
    const [usePackConversion, setUsePackConversion] = useState(false);

    // Live pricing preview from engine
    const [enginePreview, setEnginePreview] = useState<{
        unitPrice: number;
        cost: number;
        marginAmount: number;
        adjustmentTotal: number;
        adjustmentSnapshots: any[];
        breakdown: any;
    } | null>(null);

    // Global Default Margin from Settings
    const [globalMargin, setGlobalMargin] = useState<{ margin_type: 'percentage' | 'fixed_amount'; margin_value: number } | null>(null);

    // Load global margin on mount
    useEffect(() => {
        const loadGlobalMargin = async () => {
            try {
                const margin = await getGlobalDefaultMargin();
                setGlobalMargin(margin);
            } catch (err) {
                console.error('[ItemModal] Failed to load global margin:', err);
            }
        };
        loadGlobalMargin();
    }, []);


    // ─── Smart Pricing engine helper for variants ───────────────────────────────
    // Mirrors SmartPricing.tsx calculateCosts() exactly, using the parent product's
    // smartPricing snapshot (paper/toner/finishing/margin config) with a variant's pages.
    const calculateSmartVariantPrice = (pages: number, copies: number = 1) => {
        const sp = formData.smartPricing;
        if (!sp) return null;

        // Paper cost
        let paperCost = 0;
        const paper = inventory.find((i: Item) => i.id === sp.paperItemId);
        if (paper) {
            const sheetsPerCopy = Math.ceil(pages / 2);
            const totalSheets = sheetsPerCopy * copies;
            const reamSize = Number((paper as any).conversionRate || (paper as any).conversion_rate || 500);
            const paperUnitCost = Number((paper as any).cost_price || (paper as any).cost_per_unit || paper.cost || 0);
            const costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
            paperCost = Number((totalSheets * costPerSheet).toFixed(2));
        }

        // Toner cost
        let tonerCost = 0;
        const toner = inventory.find((i: Item) => i.id === sp.tonerItemId);
        if (toner) {
            const capacity = 20000;
            const totalPages = pages * copies;
            const tonerUnitCost = Number((toner as any).cost_price || (toner as any).cost_per_unit || toner.cost || 0);
            tonerCost = Number((totalPages * (tonerUnitCost / capacity)).toFixed(2));
        }

        // Finishing cost — reuse saved finishing button costs (same source as SmartPricing)
        const finishingCost = ((sp.finishingEnabled || []) as string[]).reduce((sum: number, id: string) => {
            const opt = finishingButtons.find(f => f.id === id);
            return sum + ((opt?.cost || 0) * copies);
        }, 0);

        const baseCost = paperCost + tonerCost + finishingCost;

        // Market adjustments — same logic as SmartPricing
        const adjustmentLines = marketAdjustments.map(adj => {
            const type = (adj.type || '').toUpperCase();
            const value = (type === 'PERCENTAGE' || type === 'PERCENT')
                ? baseCost * ((adj.value || 0) / 100)
                : (adj.value || 0) * pages * copies;
            return { id: adj.id, name: adj.name, type: adj.type, value: Number(value.toFixed(2)), rawValue: adj.value };
        });
        const marketAdjustmentTotal = adjustmentLines.reduce((s: number, a: any) => s + a.value, 0);
        const priceAfterAdjustments = baseCost + marketAdjustmentTotal;

        // Profit margin
        let profitMarginAmount = 0;
        if (globalMargin && globalMargin.margin_value > 0) {
            profitMarginAmount = globalMargin.margin_type === 'percentage'
                ? priceAfterAdjustments * (globalMargin.margin_value / 100)
                : globalMargin.margin_value;
        }
        const priceBeforeRounding = priceAfterAdjustments + profitMarginAmount;

        // Rounding
        let roundingResult: any;
        try {
            roundingResult = applyProductPriceRounding({ calculatedPrice: priceBeforeRounding, companyConfig });
        } catch {
            roundingResult = { originalPrice: priceBeforeRounding, roundedPrice: priceBeforeRounding, roundingDifference: 0, wasRounded: false, methodUsed: 'NONE' };
        }

        return {
            paperCost,
            tonerCost,
            finishingCost,
            baseCost,
            marketAdjustments: adjustmentLines,
            marketAdjustmentTotal,
            profitMarginAmount,
            marginType: globalMargin?.margin_type,
            marginValue: globalMargin?.margin_value,
            originalPrice: roundingResult.originalPrice,
            roundedPrice: roundingResult.roundedPrice,
            roundingDifference: roundingResult.roundingDifference ?? 0,
            wasRounded: roundingResult.wasRounded ?? false,
            roundingMethod: roundingResult.methodUsed,
            pages,
            copies,
        };
    };
    // ────────────────────────────────────────────────────────────────────────────

    // Contextual unit options per type
    const getUnitOptions = () => {
        switch (formData.type) {
            case 'Product': return ['pcs', 'units', 'sets', 'packs'];
            case 'Service': return ['hours', 'pages', 'sessions', 'fixed'];
            case 'Raw Material': return ['kg', 'g', 'l', 'ml', 'm', 'cm', 'rolls', 'sheets', 'reams', 'boxes', 'packs'];
            case 'Stationery': return ['pcs', 'packs', 'boxes', 'reams'];
            default: return ['pcs'];
        }
    };

    // ... (keep useMemo and useEffect hooks for pricing engine logic) ...


    // Computed values for pack conversion
    const derivedCostPerPiece = useMemo(() => {
        if (!formData.unitsPerPack || formData.unitsPerPack === 0) return 0;
        return (formData.costPerPack || 0) / formData.unitsPerPack;
    }, [formData.costPerPack, formData.unitsPerPack]);

    const calculatedPrice = useMemo(() => {
        const cost = derivedCostPerPiece;
        
        // PHASE 1: Base Margin Layer
        const baseMarginPrice = calculateBaseSellingPrice(cost, formData.marginPercent);
        if (formData.marginPercent) {
            console.log(`[Pricing] Profit Base Layer (Margin ${formData.marginPercent}%): ${baseMarginPrice}`);
        }

        const markup = formData.pricingConfig?.markup || 0;
        return cost * (1 + markup / 100);
    }, [derivedCostPerPiece, formData.pricingConfig?.markup, formData.marginPercent]);

    const finalPrice = useMemo(() => {
        const roundingResult = applyProductPriceRounding({
            calculatedPrice,
            methodOverride: formData.pricingConfig?.selectedRoundingMethod,
            customStepOverride: formData.pricingConfig?.customRoundingStep
        });
        return roundingResult.roundedPrice;
    }, [calculatedPrice, formData.pricingConfig?.selectedRoundingMethod, formData.pricingConfig?.customRoundingStep]);

    const isServiceType = formData.type === 'Service';
    const hasStockFunctionality = formData.type === 'Stationery' || formData.type === 'Material';
    const activeMarketAdjustments = useMemo(
        () => marketAdjustments.filter(ma => ma.active ?? ma.isActive),
        [marketAdjustments]
    );

    // Helper: derive ready-state for inventory/market adjustments
    const isInventoryReady = inventory && inventory.length > 0;
    const isMarketAdjustmentsReady = marketAdjustments && marketAdjustments.length > 0;

    useEffect(() => {
        if (isServiceType && activeTab !== 'basic') {
            setActiveTab('basic');
        }
    }, [isServiceType, activeTab]);

    useEffect(() => {
        let mounted = true;
        const updatePreview = async () => {
            const cost = derivedCostPerPiece || formData.cost || 0;
            if (cost <= 0) {
                setEnginePreview(null);
                return;
            }

            const selectedIds = formData.pricingConfig?.selectedAdjustmentIds || [];
            const adjustmentsInput = marketAdjustments
                .filter(adj => selectedIds.includes(adj.id))
                .map(adj => ({
                    name: adj.name,
                    type: adj.type,
                    value: adj.value,
                    percentage: adj.percentage ?? adj.value,
                    adjustmentId: adj.id,
                    isActive: true
                }));

            try {
                const preview = await calculateSellingPrice({
                    itemId: formData.id,
                    categoryId: formData.category,
                    baseCost: cost,
                    adjustments: adjustmentsInput,
                    context: 'POS'
                });

                if (mounted) {
                    setEnginePreview({
                        unitPrice: preview.unitPrice,
                        cost: preview.cost,
                        marginAmount: preview.marginAmount,
                        adjustmentTotal: preview.adjustmentTotal,
                        adjustmentSnapshots: preview.adjustmentSnapshots,
                        breakdown: preview.breakdown
                    });
                }
            } catch (err) {
                console.error('[ItemModal] Pricing engine error:', err);
            }
        };

        updatePreview();
        return () => { mounted = false; };
    }, [derivedCostPerPiece, formData.cost, formData.category, formData.id, formData.pricingConfig?.selectedAdjustmentIds, marketAdjustments]);

    const resolveRoundingBasePrice = () => {
        const raw = Number(formData.calculated_price);
        if (Number.isFinite(raw) && raw > 0) return raw;
        return Number(formData.price) || 0;
    };

    const resolveVariantBasePrice = (variant: ProductVariant) => {
        const raw = Number(variant.calculated_price);
        if (Number.isFinite(raw) && raw > 0) return raw;
        return Number(variant.price) || 0;
    };

    // Helper function to apply rounding to a price
    const applyRoundingToPrice = (price: number, existingItem?: Item) => {
        // Materials are cost-only, no rounding needed
        if (formData.type === 'Raw Material' || formData.type === 'Stationery') {
            return {
                calculatedPrice: price,
                sellingPrice: price,
                roundingDifference: 0,
                roundingMethod: undefined as string | undefined
            };
        }

        const roundingResult = applyProductPriceRounding({
            calculatedPrice: price,
            companyConfig: companyConfig,
            existingCalculatedPrice: existingItem?.calculated_price,
            existingRoundedPrice: existingItem?.selling_price,
            existingRoundingDifference: existingItem?.rounding_difference,
            existingRoundingMethod: existingItem?.rounding_method,
            skipIfAlreadyRounded: true
        });

        return {
            calculatedPrice: roundingResult.originalPrice,
            sellingPrice: roundingResult.roundedPrice,
            roundingDifference: roundingResult.roundingDifference,
            roundingMethod: roundingResult.methodUsed
        };
    };

    // Load BOM templates on mount
    useEffect(() => {
        let mounted = true;
        setBomLoading(true);
dbService.getAll<BOMTemplate>('bomTemplates')
    .then((templates) => {
        if (mounted) setBomTemplates(templates || []);
    })
    .catch((err) => {
        console.error('Failed to load BOM templates for variant pricing', err);
    })
    .finally(() => { if (mounted) setBomLoading(false); });
        // Load finishing option costs (saved settings) to match SmartPricing UI
        dbService.getSetting<Record<string, number>>('finishingOptionCosts')
            .then(savedCosts => {
                if (!mounted) return;
                const merged = DEFAULT_FINISHING_BUTTONS.map(d => ({ ...d, cost: savedCosts?.[d.id] ?? d.cost }));
                setFinishingButtons(merged);
            })
            .catch(() => {
                // fallback to defaults
                setFinishingButtons(DEFAULT_FINISHING_BUTTONS);
            });
        return () => { mounted = false; };
    }, []);

    // Populate form when editing
    useEffect(() => {
        if (item && mode === 'edit') {
            const shouldBeManual =
                item.pricingConfig?.manualOverride ??
                (item.type === 'Service' || item.type === 'Raw Material');

            setFormData({
                ...defaultItem,
                ...item,
                variants: item.variants || [],
                pricingConfig: {
                    ...defaultItem.pricingConfig,
                    ...item.pricingConfig,
                    manualOverride: shouldBeManual
                }
            });
        } else {
            setFormData({
                ...defaultItem,
                sku: generateAutoSKU('ITEM', 'NEW')
            });
        }
        setErrors({});
        setActiveTab('basic');
        setShowVariantForm(false);
        setShowBulkGenerator(false);
    }, [item, mode, isOpen]);

    // Material filtering for BOM
    const materials = useMemo(() => (inventory || []).filter((i: Item) => i.type === 'Raw Material'), [inventory]);
    const paperMaterials = useMemo(() => materials.filter((i: Item) => i.category?.toLowerCase().includes('paper') || i.name.toLowerCase().includes('paper')), [materials]);
    const tonerMaterials = useMemo(() => materials.filter((i: Item) => i.category?.toLowerCase().includes('toner') || i.category?.toLowerCase().includes('cartridge') || i.name.toLowerCase().includes('toner')), [materials]);

    // Calculate BOM costs from stored template
    const bomCosts = useMemo(() => {
        if (!formData.smartPricing?.bomTemplateId || !bomTemplates.length) {
            return { paper: 0, toner: 0, finishing: 0, total: 0 };
        }
        const template = bomTemplates.find(b => b.id === formData.smartPricing.bomTemplateId);
        if (!template?.components?.length) {
            return { paper: 0, toner: 0, finishing: 0, total: 0 };
        }
        let paper = 0, toner = 0, finishing = 0;
        template.components.forEach(comp => {
            const item = materials.find(m => m.id === comp.itemId);
            if (!item) return;
            const cost = item.cost || 0;
            const qty = parseFloat(comp.quantityFormula) || 1;
            if (comp.name?.toLowerCase().includes('paper')) {
                paper += cost * qty;
            } else if (comp.name?.toLowerCase().includes('toner')) {
                toner += cost * qty;
            } else {
                finishing += cost * qty;
            }
        });
        return { paper, toner, finishing, total: paper + toner + finishing };
    }, [formData.smartPricing?.bomTemplateId, bomTemplates, materials]);

    // Helper to calculate cost/price based on pages and config
    const calculateItemFinancials = (pPages: number, pConfig: PricingConfig | undefined, pItemType?: string, pManualCost?: number) => {
        const cost = pManualCost || (pItemType === 'Stationery' ? derivedCostPerPiece : formData.cost) || 0;
        let baseCost = cost * pPages;
        
        // Simple calculation for now - this can be expanded to use the pricing engine
        const finishingCost = pConfig?.finishingOptions?.reduce((sum, opt) => sum + opt.quantity * 5, 0) || 0;
        let adjustments = 0;
        
        if (pConfig?.selectedAdjustmentIds) {
            adjustments = pConfig.selectedAdjustmentIds.reduce((sum, adjId) => {
                const adj = marketAdjustments.find(a => a.id === adjId);
                if (adj) {
                    if (adj.type === 'PERCENTAGE') {
                        return sum + (cost * pPages * adj.value / 100);
                    } else {
                        return sum + adj.value * pPages;
                    }
                }
                return sum;
            }, 0);
        }
        
        const total = baseCost + finishingCost + adjustments;
        const margin = total * (formData.marginPercent || 0 / 100);
        const finalPrice = total + margin;
        
        return {
            paperCost: cost * pPages,
            tonerCost: 0, // Will be implemented in the pricing engine
            finishingCost,
            adjustments,
            margin,
            total: finalPrice
        };
    };


    // Pricing Calculation Logic
    useEffect(() => {
        // Wait for BOM to load first
        if (bomLoading) return;
        if (formData.type === 'Raw Material' || !formData.pricingConfig || formData.pricingConfig.manualOverride) return;


        const financials = calculateItemFinancials(formData.pages || 1, formData.pricingConfig, formData.type, formData.cost);
        if (!financials) return;

        // Apply rounding
        const roundingResult = applyProductPriceRounding({
            calculatedPrice: financials.total ?? 0,
            companyConfig,
            methodOverride: formData.pricingConfig?.selectedRoundingMethod,
            customStepOverride: formData.pricingConfig?.customRoundingStep
        });

        setFormData(prev => ({
            ...prev,
            price: roundingResult.roundedPrice,
            calculated_price: roundingResult.roundedPrice,
            pricingConfig: {
                ...prev.pricingConfig!,
                totalCost: Number((financials.total ?? 0).toFixed(2)),
                marketAdjustment: Number((financials.adjustments ?? 0).toFixed(2))
            }
        }));


    }, [
        bomLoading,
        formData.pricingConfig?.paperId,
        formData.pricingConfig?.tonerId,
        formData.pricingConfig?.finishingOptions,
        formData.pricingConfig?.manualOverride,
        formData.pricingConfig?.selectedAdjustmentIds,
        formData.pricingConfig?.selectedRoundingMethod,
        formData.pages,
        formData.cost,
        materials,
        activeMarketAdjustments,
        companyConfig
    ]);

    // Helper to calculate adjustments for any item/variant based on its cost
    const getAdjustmentSnapshots = (baseCost: number): AdjustmentSnapshot[] => {
        const snapshots: AdjustmentSnapshot[] = [];
        const pages = Number(formData.pages) || 1;

        activeMarketAdjustments.forEach(adj => {
            let amount = 0;
            if (adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage') {
                amount = baseCost * (adj.value / 100);
            } else {
                // Scale fixed adjustment by pages for consistency
                amount = adj.value * pages;
            }

            snapshots.push({
                name: adj.name,
                type: adj.type as any,
                value: adj.value,
                percentage: (adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage') ? adj.value : undefined,
                calculatedAmount: Number(amount.toFixed(2))
            });
        });
        return snapshots;
    };

    const patchPricingConfig = (patch: Partial<PricingConfig>) => {
        setFormData(prev => ({
            ...prev,
            pricingConfig: {
                ...prev.pricingConfig!,
                ...patch
            }
        }));
    };

    const handlePricingConfigChange = (field: string, value: any) => {
        patchPricingConfig({ [field]: value } as Partial<PricingConfig>);
    };

    const handleToggleAdjustment = (adjId: string) => {
        setFormData(prev => {
            const currentIds = prev.pricingConfig?.selectedAdjustmentIds || [];
            const isSelected = currentIds.includes(adjId);
            const nextIds = isSelected
                ? currentIds.filter(id => id !== adjId)
                : [...currentIds, adjId];

            return {
                ...prev,
                pricingConfig: {
                    ...prev.pricingConfig!,
                    selectedAdjustmentIds: nextIds
                }
            };
        });
    };

    const updateFinishingOption = (id: string, field: keyof FinishingOption, value: any) => {
        setFormData(prev => {
            const current = prev.pricingConfig?.finishingOptions || [];
            const updated = current.map(opt => opt.id === id ? { ...opt, [field]: value } : opt)
                // remove any with quantity <= 0
                .filter(o => Number(o.quantity || 0) > 0);

            return { ...prev, pricingConfig: { ...prev.pricingConfig!, finishingOptions: updated } };
        });
    };


    const generateVariantId = (): string => {
        return 'VAR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();
    };

    const recalculateStationeryVariantPrice = (
        currentVariant: Partial<ProductVariant>,
        incomingPatch: Partial<ProductVariant>
    ): Partial<ProductVariant> => {
        const nextVariant = { ...currentVariant, ...incomingPatch };
        const baseCost = Number(nextVariant.cost ?? formData.cost ?? 0);
        const adjPercent = Number(nextVariant.adjustmentPercent || 0);
        const adjustedPrice = baseCost * (1 + adjPercent / 100);
        const roundingResult = applyProductPriceRounding({
            calculatedPrice: adjustedPrice,
            methodOverride: nextVariant.selectedRoundingMethod
        });

        return {
            ...nextVariant,
            calculated_price: roundingResult.originalPrice,
            price: roundingResult.roundedPrice
        };
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name?.trim()) {
            newErrors.name = 'Item name is required';
        }

        if (!formData.sku?.trim()) {
            newErrors.sku = 'SKU is required';
        }

        if (!formData.category?.trim()) {
            newErrors.category = 'Category is required';
        }

        if (!formData.type) {
            newErrors.type = 'Item type is required';
        }

        if (formData.price === undefined || formData.price < 0) {
            newErrors.price = 'Valid selling price is required';
        }

        if (formData.cost === undefined || formData.cost < 0) {
            newErrors.cost = 'Valid cost price is required';
        }

        if ((formData.type === 'Stationery' || formData.type === 'Material') && (formData.stock === undefined || formData.stock < 0)) {
            newErrors.stock = 'Valid stock quantity is required';
        }

        if (!formData.unit?.trim()) {
            newErrors.unit = 'Unit of measure is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const normalizedPricingConfig = formData.pricingConfig
                ? {
                    ...formData.pricingConfig,
                    marketAdjustment: Number(formData.pricingConfig.marketAdjustment) || 0,
                    finishingOptions: formData.pricingConfig.finishingOptions || [],
                    manualOverride:
                        formData.pricingConfig.manualOverride ??
                        (formData.type === 'Service' || formData.type === 'Raw Material' || formData.type === 'Stationery')
                }
                : undefined;

            // Apply rounding to the price BEFORE saving (for non-Materials)
            const roundedPricing = applyRoundingToPrice(resolveRoundingBasePrice(), item || undefined);

            const itemData: Item = {
                id: formData.id || generateId(),
                uuid: formData.uuid || generateId(),
                name: formData.name!.trim(),
                sku: formData.sku!.trim(),
                description: formData.description?.trim() || '',
                price: roundedPricing.sellingPrice,
                cost: Number(formData.cost) || 0,
                cost_price: Number(formData.cost) || 0,
                calculated_price: roundedPricing.calculatedPrice,
                selling_price: roundedPricing.sellingPrice,
                rounding_difference: roundedPricing.roundingDifference,
                rounding_method: roundedPricing.roundingMethod,
                stock: Number(formData.stock) || 0,
                category: formData.category!.trim(),
                type: formData.type as Item['type'],
                unit: formData.unit!.trim(),
                minStockLevel: Number(formData.minStockLevel) || 0,
                preferredSupplierId: formData.preferredSupplierId || undefined,
                binLocation: formData.binLocation?.trim() || undefined,
                barcode: formData.barcode?.trim() || undefined,
                purchaseUnit: formData.purchaseUnit?.trim() || undefined,
                usageUnit: formData.usageUnit?.trim() || undefined,
                conversionRate: Number(formData.conversionRate) || 1,
                isLargeFormat: formData.isLargeFormat || false,
                rollWidth: Number(formData.rollWidth) || undefined,
                rollLength: Number(formData.rollLength) || undefined,
                pages: Number(formData.pages) || 1,
                leadTimeDays: Number(formData.leadTimeDays) || undefined,
                minOrderQty: Number(formData.minOrderQty) || undefined,
                reorderPoint: Number(formData.reorderPoint) || undefined,
                variants: formData.variants || [],
                isVariantParent: (formData.variants && formData.variants.length > 0) || formData.isVariantParent || false,
                locationStock: formData.locationStock || [],
                reserved: formData.reserved || 0,
                adjustmentSnapshots: formData.adjustmentSnapshots || [],
                pricingConfig: normalizedPricingConfig,
                smartPricing: formData.smartPricing
            };

            // Ensure variants also have rounded prices
            if (itemData.variants && itemData.variants.length > 0) {
                itemData.variants = itemData.variants.map(v => {
                    const variantRounding = applyRoundingToPrice(resolveVariantBasePrice(v), item);
                    return {
                        ...v,
                        price: variantRounding.sellingPrice,
                        adjustmentSnapshots: v.adjustmentSnapshots || getAdjustmentSnapshots(v.cost),
                        cost_price: Number(v.cost_price ?? v.cost) || 0,
                        calculated_price: variantRounding.calculatedPrice,
                        selling_price: variantRounding.sellingPrice,
                        rounding_difference: variantRounding.roundingDifference,
                        rounding_method: variantRounding.roundingMethod
                    };
                });
            }

            if (mode === 'edit') {
                await onUpdate(itemData);
            } else {
                await onSave(itemData);
            }

            handleClose();
        } catch (error) {
            console.error('Error saving item:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData(defaultItem);
        setErrors({});
        setShowVariantForm(false);
        setNewVariant({
            id: '',
            sku: '',
            name: '',
            attributes: {},
            price: 0,
            cost: 0,
            stock: 0,
            pages: 1
        });
        onClose();
    };

    const handleAddVariant = () => {
        if (!newVariant.name || !newVariant.sku) {
            return;
        }

        const variantPages = Number(newVariant.pages) || 1;
        // Use SmartPricing engine if parent has a smartPricing snapshot
        const smartResult = calculateSmartVariantPrice(variantPages, 1);

        const variant: ProductVariant = {
            id: newVariant.id || generateVariantId(),
            productId: formData.id || generateId(),
            uuid: generateId(),
            sku: newVariant.sku,
            name: newVariant.name,
            attributes: newVariant.attributes || {},
            price: smartResult ? smartResult.roundedPrice : (Number(newVariant.price) || 0),
            cost: smartResult ? smartResult.baseCost : (Number(newVariant.cost) || 0),
            cost_price: smartResult ? smartResult.baseCost : (Number(newVariant.cost) || 0),
            calculated_price: smartResult ? smartResult.originalPrice : (Number(newVariant.price) || 0),
            selling_price: smartResult ? smartResult.roundedPrice : (Number(newVariant.price) || 0),
            rounding_difference: smartResult ? smartResult.roundingDifference : 0,
            rounding_method: smartResult ? smartResult.roundingMethod : undefined,
            stock: Number(newVariant.stock) || 0,
            pages: variantPages,
            adjustmentSnapshots: getAdjustmentSnapshots(smartResult ? smartResult.baseCost : (Number(newVariant.cost) || 0)),
            pricingSource: newVariant.pricingSource || 'static',
            inheritsParentBOM: newVariant.inheritsParentBOM ?? false,
            ...(smartResult ? { smartPricingSnapshot: smartResult } : {})
        };

        setFormData(prev => ({
            ...prev,
            variants: [...(prev.variants || []), variant],
            isVariantParent: true
        }));

        setNewVariant({
            id: '',
            sku: '',
            name: '',
            attributes: {},
            price: 0,
            cost: 0,
            stock: 0,
            pages: 1,
            pricingSource: 'static',
            inheritsParentBOM: false
        });
        setVariantPreview(null);
        setShowVariantForm(false);
    };

    const handleRemoveVariant = (variantId: string) => {
        setFormData(prev => {
            const newVariants = (prev.variants || []).filter(v => v.id !== variantId);
            return {
                ...prev,
                variants: newVariants,
                isVariantParent: newVariants.length > 0
            };
        });
    };

    const handleLocationStockChange = (warehouseId: string, quantity: number) => {
        setFormData(prev => {
            const currentLocations = prev.locationStock || [];
            const existingIndex = currentLocations.findIndex(l => l.warehouseId === warehouseId);

            if (existingIndex >= 0) {
                const updated = [...currentLocations];
                updated[existingIndex] = { warehouseId, quantity };
                return { ...prev, locationStock: updated };
            } else {
                return { ...prev, locationStock: [...currentLocations, { warehouseId, quantity }] };
            }
        });
    };

    const handleVariantPagesChange = async (variantId: string, newPages: number) => {
        // Find the variant to check pricing mode
        const variant = formData.variants?.find(v => v.id === variantId);

        // Guard against undefined variant - exit early if variant not found
        if (!variant) {
            console.warn(`Variant with id ${variantId} not found`);
            return;
        }

        // ── Smart Pricing path (preferred): parent was created via SmartPricing engine ──
        const smartResult = calculateSmartVariantPrice(newPages, 1);
        if (smartResult) {
            setFormData(prev => ({
                ...prev,
                variants: (prev.variants || []).map(v => v.id !== variantId ? v : {
                    ...v,
                    pages: newPages,
                    cost: smartResult.baseCost,
                    cost_price: smartResult.baseCost,
                    price: smartResult.roundedPrice,
                    selling_price: smartResult.roundedPrice,
                    calculated_price: smartResult.originalPrice,
                    rounding_difference: smartResult.roundingDifference,
                    rounding_method: smartResult.roundingMethod,
                    smartPricingSnapshot: smartResult,
                    calculatedAt: new Date().toISOString()
                })
            }));
            return;
        }

        // ── Legacy BOM dynamic path ──────────────────────────────────────────────
        const hasHiddenBOM = formData.smartPricing?.hiddenBOMId || formData.smartPricing?.bomTemplateId;
        const useDynamicPricing = variant?.pricingSource === 'dynamic' ||
            variant?.inheritsParentBOM ||
            (hasHiddenBOM && variant?.pricingSource !== 'static');

        if (useDynamicPricing && hasHiddenBOM) {
            try {
                const result = pricingService.calculateVariantPrice(
                    formData as Item,
                    { ...variant, pages: newPages } as ProductVariant,
                    1,
                    inventory,
                    bomTemplates,
                    marketAdjustments
                );
                setFormData(prev => ({
                    ...prev,
                    variants: (prev.variants || []).map(v => v.id !== variantId ? v : {
                        ...v,
                        pages: newPages,
                        cost: result.cost,
                        price: result.price,
                        adjustmentSnapshots: result.adjustmentSnapshots,
                        calculatedAt: new Date().toISOString()
                    })
                }));
            } catch (error) {
                console.error('Error calculating variant price:', error);
                setFormData(prev => ({
                    ...prev,
                    variants: (prev.variants || []).map(v => v.id !== variantId ? v : { ...v, pages: newPages })
                }));
            }
        } else {
            // ── Simple fallback ──────────────────────────────────────────────────
            const specs = calculateItemFinancials(newPages, formData.pricingConfig, formData.type, variant.cost);
            let finalPrice = variant.price;
            if (specs) {
                const roundingResult = applyProductPriceRounding({
                    calculatedPrice: specs.total ?? 0,
                    companyConfig,
                    methodOverride: formData.pricingConfig?.selectedRoundingMethod,
                    customStepOverride: formData.pricingConfig?.customRoundingStep
                });
                finalPrice = roundingResult.roundedPrice;
            }
            setFormData(prev => ({
                ...prev,
                variants: (prev.variants || []).map(v => v.id !== variantId ? v : {
                    ...v,
                    pages: newPages,
                    cost: specs ? specs.baseCost : v.cost,
                    price: finalPrice,
                    adjustmentSnapshots: v.adjustmentSnapshots
                })
            }));
        }
    };

    const handleBulkGenerate = () => {
        // Implement bulk generation logic
        const variants = generateBulkVariants(
            Number(formData.price) || 0,
            Number(formData.cost) || 0,
            bulkAttributes.filter(a => a.values.length > 0)
        );

        const taggedVariants = variants.map(v => ({
            ...v,
            id: generateId(),
            sku: generateAutoSKU(formData.type || 'ITEM', formData.name || 'UNK', v.attributes),
            name: `${formData.name} - ${v.name}`,
            adjustmentSnapshots: getAdjustmentSnapshots(v.cost),
            attributes: v.attributes || {}
        })) as ProductVariant[];

        setFormData(prev => ({
            ...prev,
            variants: [...(prev.variants || []), ...taggedVariants],
            isVariantParent: true
        }));

        setShowBulkGenerator(false);
    };

    const addBulkValue = (index: number) => {
        const val = bulkInputValue[index]?.trim();
        if (!val) return;

        setBulkAttributes(prev => {
            const updated = [...prev];
            if (!updated[index].values.includes(val)) {
                updated[index].values.push(val);
            }
            return updated;
        });

        setBulkInputValue(prev => ({ ...prev, [index]: '' }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className={styles.title}>
                                {mode === 'edit' ? 'Edit Item' : 'Add New Item'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {mode === 'edit' ? `Editing: ${item?.name}` : 'Create a new inventory item'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-[8px] hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {mode === 'edit' ? 'Update Item' : 'Save Item'}
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Sidebar Sections */}
                <div className="flex border-t border-slate-200">
                    <div className="w-48 bg-slate-50 border-r border-slate-200 py-4">
                        {([
                            { id: 'basic', label: 'Basic Info', icon: Tag },
                            ...(isServiceType
                                ? []
                                : [
                                    { id: 'pricing', label: 'Pricing', icon: DollarSign },
                                    ...(formData.type === 'Raw Material' || formData.type === 'Stationery'
                                        ? [{ id: 'inventory' as const, label: 'Inventory' as const, icon: Box as const }]
                                        : []),
                                    ...(formData.type === 'Product' || formData.type === 'Stationery'
                                        ? [{ id: 'variants', label: 'Variants', icon: Layers }]
                                        : [])
                                ])
                        ] as { id: 'basic' | 'pricing' | 'inventory' | 'variants'; label: string; icon: any }[]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                                    : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="p-6">
                             {/* Basic Info Tab */}
                             {activeTab === 'basic' && (
                                 <div className="space-y-6">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                         {/* Name */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemName" className={styles.label}>Item name</label>
                                             <input
                                                 type="text"
                                                 id="itemName"
                                                 value={formData.name || ''}
                                                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                 className={`${styles.input} ${errors.name ? 'border-red-300 bg-red-50' : ''}`}
                                                 placeholder="e.g. Glossy Photo Paper"
                                             />
                                         </div>
                                         {errors.name && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.name}
                                             </p>
                                         )}

                                         {/* SKU */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemSKU" className={styles.label}>SKU/code</label>
                                             <div className="flex gap-2 flex-1">
                                                 <input
                                                     type="text"
                                                     id="itemSKU"
                                                     value={formData.sku || ''}
                                                     onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                     className={`${styles.input} ${errors.sku ? 'border-red-300 bg-red-50' : ''}`}
                                                     placeholder="e.g. SKU-GPP-001"
                                                 />
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         const sku = generateAutoSKU(formData.type || 'ITEM', formData.name || 'UNK');
                                                         setFormData({ ...formData, sku });
                                                     }}
                                                     className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                     title="Auto-Generate SKU"
                                                 >
                                                     <Wand2 className="w-5 h-5" />
                                                 </button>
                                             </div>
                                         </div>
                                         {errors.sku && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.sku}
                                             </p>
                                         )}

                                         {/* Category */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemCategory" className={styles.label}>Category</label>
                                             <input
                                                 type="text"
                                                 id="itemCategory"
                                                 value={formData.category || ''}
                                                 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                 className={`${styles.input} ${errors.category ? 'border-red-300 bg-red-50' : ''}`}
                                                 placeholder="e.g. Office Supplies"
                                                 list="categories"
                                             />
                                         </div>
                                         {errors.category && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.category}
                                             </p>
                                         )}

                                         {/* Type */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemType" className={styles.label}>Item type</label>
                                             <select
                                                 id="itemType"
                                                 value={formData.type || 'Product'}
                                                 onChange={(e) => setFormData({ ...formData, type: e.target.value as Item['type'] })}
                                                 className={`${styles.select} ${errors.type ? 'border-red-300 bg-red-50' : ''}`}
                                             >
                                                 <option value="Product">Product</option>
                                                 <option value="Raw Material">Material</option>
                                                 <option value="Service">Service</option>
                                                 <option value="Stationery">Stationery</option>
                                             </select>
                                         </div>
                                         {errors.type && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.type}
                                             </p>
                                         )}

                                         {/* Unit */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemUnit" className={styles.label}>Unit of sale</label>
                                             <select
                                                 id="itemUnit"
                                                 value={formData.unit || 'pcs'}
                                                 onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                 className={styles.select}
                                             >
                                                 {getUnitOptions().map(option => (
                                                     <option key={option} value={option}>{option}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         {errors.unit && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.unit}
                                             </p>
                                         )}
                                     </div>

                                     {/* Description */}
                                     <div>
                                         <label htmlFor="itemDescription" className={styles.label}>Description</label>
                                         <textarea
                                             id="itemDescription"
                                             value={formData.description || ''}
                                             onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                             className={styles.textarea}
                                             rows={3}
                                             placeholder="e.g. High-quality paper for professional photography"
                                         />
                                     </div>

                                     {/* Product-specific sections */}
                                     {formData.type === 'Product' && (
                                         <div className="border-b border-slate-100 pb-6">
                                             <h3 className={styles.sectionTitle}>Print specifications</h3>
                                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                 <div>
                                                     <label htmlFor="paperType" className={styles.label}>Paper type</label>
                                                     <select id="paperType" className={styles.select}>
                                                         <option>Standard Paper</option>
                                                         <option>Glossy Paper</option>
                                                         <option>Matte Paper</option>
                                                         <option>Recycled Paper</option>
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label htmlFor="colorMode" className={styles.label}>Colour mode</label>
                                                     <select id="colorMode" className={styles.select}>
                                                         <option>Black & White</option>
                                                         <option>Colour</option>
                                                         <option>Greyscale</option>
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label htmlFor="finishing" className={styles.label}>Finishing</label>
                                                     <select id="finishing" className={styles.select}>
                                                         <option>None</option>
                                                         <option>Stapling</option>
                                                         <option>Binding</option>
                                                         <option>Lamination</option>
                                                     </select>
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     {/* Service-specific sections */}
                                     {formData.type === 'Service' && (
                                         <div className="border-b border-slate-100 pb-6">
                                             <h3 className={styles.sectionTitle}>Service details</h3>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                 <div>
                                                     <label htmlFor="durationEstimate" className={styles.label}>Duration estimate</label>
                                                     <input
                                                         type="text"
                                                         id="durationEstimate"
                                                         className={styles.input}
                                                         placeholder="e.g. 2-3 business days"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label htmlFor="deliveryMethod" className={styles.label}>Delivery method</label>
                                                     <select id="deliveryMethod" className={styles.select}>
                                                         <option>Email</option>
                                                         <option>Physical delivery</option>
                                                         <option>Pickup</option>
                                                         <option>Download</option>
                                                     </select>
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     {/* Large Format Toggle */}
                                     <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                         <input
                                             type="checkbox"
                                             id="isLargeFormat"
                                             checked={formData.isLargeFormat || false}
                                             onChange={(e) => setFormData({ ...formData, isLargeFormat: e.target.checked })}
                                             className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                         />
                                         <label htmlFor="isLargeFormat" className="text-sm font-medium text-slate-700">
                                             Large Format Item (Rolls/Bulk)
                                         </label>
                                     </div>

                                     {formData.isLargeFormat && (
                                         <div className="grid grid-cols-2 gap-4 pl-4 border-l-4 border-indigo-200">
                                             <div>
                                                 <label htmlFor="rollWidth" className={styles.label}>Roll Width (cm)</label>
                                                 <input
                                                     type="number"
                                                     id="rollWidth"
                                                     value={formData.rollWidth || ''}
                                                     onChange={(e) => setFormData({ ...formData, rollWidth: Number(e.target.value) })}
                                                     className={styles.input}
                                                     placeholder="e.g. 61"
                                                 />
                                             </div>
                                             <div>
                                                 <label htmlFor="rollLength" className={styles.label}>Roll Length (m)</label>
                                                 <input
                                                     type="number"
                                                     id="rollLength"
                                                     value={formData.rollLength || ''}
                                                     onChange={(e) => setFormData({ ...formData, rollLength: Number(e.target.value) })}
                                                     className={styles.input}
                                                     placeholder="e.g. 30"
                                                 />
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

{/* Pricing Tab */}
                              {!isServiceType && activeTab === 'pricing' && (
                                  <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                                      {formData.type === 'Product' && (
                                          <>
                                              {/* Smart Pricing Engine Summary */}
                                              <div className={styles.card}>
                                                  <h3 className={styles.sectionTitle}>Smart Pricing Engine Summary</h3>
                                                  <div className="space-y-3">
                                                      {/* Paper Section */}
                                                      <div className={styles.row}>
                                                          <div className="flex items-center gap-3">
                                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                              <div>
                                                                  <div className="text-xs font-medium text-slate-600">Paper</div>
                                                                  <div className="text-[10px] text-slate-400">
                                                                      {formData.smartPricing?.paperItemId
                                                                          ? materials.find(m => m.id === formData.smartPricing?.paperItemId)?.name || 'No paper selected'
                                                                          : formData.pricingConfig?.paperId
                                                                          ? materials.find(m => m.id === formData.pricingConfig?.paperId)?.name || 'Unknown paper'
                                                                          : 'No paper selected'}
                                                                      {formData.smartPricing?.pages || formData.pages ? ` • ${formData.smartPricing?.pages || formData.pages} pages` : ''}
                                                                      {formData.smartPricing?.copies ? ` • ${formData.smartPricing.copies} copies` : ''}
                                                                  </div>
                                                              </div>
                                                          </div>
                                                          <div className="text-sm font-medium text-slate-800">
                                                              K{(formData.smartPricing?.paperCost ?? bomCosts.paper).toFixed(2)}
                                                          </div>
                                                      </div>

                                                      {/* Toner Section */}
                                                      <div className={styles.row}>
                                                          <div className="flex items-center gap-3">
                                                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                              <div>
                                                                  <div className="text-xs font-medium text-slate-600">Toner</div>
                                                                  <div className="text-[10px] text-slate-400">
                                                                      {formData.smartPricing?.tonerItemId
                                                                          ? materials.find(m => m.id === formData.smartPricing?.tonerItemId)?.name || 'No toner selected'
                                                                          : formData.pricingConfig?.tonerId
                                                                          ? materials.find(m => m.id === formData.pricingConfig?.tonerId)?.name || 'Unknown toner'
                                                                          : 'No toner selected'}
                                                                      {(formData.smartPricing?.pages || formData.pages) ? ` • ${formData.smartPricing?.pages || formData.pages} total pages` : ''}
                                                                  </div>
                                                              </div>
                                                          </div>
                                                          <div className="text-sm font-medium text-slate-800">
                                                              K{(formData.smartPricing?.tonerCost ?? bomCosts.toner).toFixed(2)}
                                                          </div>
                                                      </div>

                                                      {/* Finishing Section */}
                                                      <div className={styles.row}>
                                                          <div className="flex items-center gap-3">
                                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                              <div>
                                                                  <div className="text-xs font-medium text-slate-600">Finishing</div>
                                                                  <div className="text-[10px] text-slate-400">
                                                                      {formData.smartPricing?.finishingEnabled?.length
                                                                          ? formData.smartPricing.finishingEnabled.join(', ') || 'No finishing options'
                                                                          : formData.pricingConfig?.finishingOptions?.length
                                                                          ? formData.pricingConfig.finishingOptions.map(opt => opt.name).join(', ')
                                                                          : 'No finishing options'}
                                                                  </div>
                                                              </div>
                                                          </div>
                                                          <div className="text-sm font-medium text-slate-800">
                                                              K{(formData.smartPricing?.finishingCost ?? bomCosts.finishing).toFixed(2)}
                                                          </div>
                                                      </div>

                                                     {/* Divider */}
                                                     <div className="border-t border-slate-100 my-4"></div>

                                                     {/* Market Adjustments */}
                                                     <div>
                                                         <div className={styles.sectionTitle}>Market adjustments</div>
                                                         <div className="space-y-2">
                                                             {formData.smartPricing?.marketAdjustments?.length > 0 ? (
                                                                 // Show the exact adjustments that were applied in SmartPricing
                                                                 formData.smartPricing.marketAdjustments.map((adj: any) => (
                                                                     <div key={adj.id} className={styles.row}>
                                                                         <div className="flex items-center gap-3">
                                                                             <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                                             <div className="flex-1">
                                                                                 <div className="text-sm font-medium text-slate-700">{adj.name}</div>
                                                                                 <div className="text-[10px] text-slate-500">
                                                                                     {adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' ? `${adj.rawValue}%` : `K${adj.rawValue} × pages × copies`}
                                                                                 </div>
                                                                             </div>
                                                                         </div>
                                                                         <div className="text-sm font-medium text-emerald-600">
                                                                             +K{(adj.value || 0).toFixed(2)}
                                                                         </div>
                                                                     </div>
                                                                 ))
                                                             ) : (
                                                                 // Fallback: show toggleable adjustments if no smartPricing snapshot
                                                                 activeMarketAdjustments.map(adj => {
                                                                     const isSelected = formData.pricingConfig?.selectedAdjustmentIds?.includes(adj.id) || false;
                                                                     const contribution = isSelected
                                                                         ? adj.type === 'PERCENTAGE'
                                                                             ? `K${(enginePreview?.cost * adj.value / 100)?.toFixed(2) || '0.00'}`
                                                                             : `K${adj.value.toFixed(2)}`
                                                                         : 'K0.00';
                                                                     return (
                                                                         <div key={adj.id} className={styles.row}>
                                                                             <div className="flex items-center gap-3">
                                                                                 <label className="relative inline-flex items-center cursor-pointer">
                                                                                     <input
                                                                                         type="checkbox"
                                                                                         checked={isSelected}
                                                                                         onChange={() => handleToggleAdjustment(adj.id)}
                                                                                         className="sr-only peer"
                                                                                         disabled={isSubmitting}
                                                                                     />
                                                                                     <div className={`w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}></div>
                                                                                     <div className={`absolute left-[2px] top-[1px] w-3 h-3 rounded-full transition-all ${isSelected ? 'bg-white translate-x-4' : 'bg-slate-400 translate-x-0'}`}></div>
                                                                                 </label>
                                                                                 <div className="flex-1">
                                                                                     <div className="text-sm font-medium text-slate-700">{adj.name}</div>
                                                                                     <div className="text-[10px] text-slate-500">
                                                                                         {adj.type === 'PERCENTAGE' ? `${adj.value}%` : `K${adj.value}`}
                                                                                     </div>
                                                                                 </div>
                                                                             </div>
                                                                             <div className={`text-sm font-medium ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>
                                                                                 {contribution}
                                                                             </div>
                                                                         </div>
                                                                     );
                                                                 })
                                                             )}
                                                         </div>
                                                     </div>

                                                      {/* Divider */}
                                                      <div className="border-t border-slate-100 my-4"></div>

                                                      {/* Price Summary — mirrors SmartPricing Price Summary panel exactly */}
                                                      <div>
                                                          <div className={styles.sectionTitle}>Price summary</div>
                                                          <div className="space-y-2">
                                                              {formData.smartPricing ? (
                                                                  <>
                                                                      {/* Paper */}
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">
                                                                              {materials.find(m => m.id === formData.smartPricing.paperItemId)?.name?.replace(/\s*\d+gsm.*/i, '') || 'Paper'}
                                                                          </div>
                                                                          <div className="text-sm font-medium text-slate-800">
                                                                              K{(formData.smartPricing.paperCost ?? 0).toFixed(2)}
                                                                          </div>
                                                                      </div>
                                                                      {/* Toner */}
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">
                                                                              {materials.find(m => m.id === formData.smartPricing.tonerItemId)?.name?.replace(/\s*Universal\s*/i, '') || 'Toner'}
                                                                          </div>
                                                                          <div className="text-sm font-medium text-slate-800">
                                                                              K{(formData.smartPricing.tonerCost ?? 0).toFixed(2)}
                                                                          </div>
                                                                      </div>
                                                                      {/* Finishing */}
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">Finishing</div>
                                                                          <div className="text-sm font-medium text-slate-800">
                                                                              K{(formData.smartPricing.finishingCost ?? 0).toFixed(2)}
                                                                          </div>
                                                                      </div>
                                                                      {/* Per-adjustment lines */}
                                                                      {(formData.smartPricing.marketAdjustments || []).map((adj: any, idx: number) =>
                                                                          adj.value > 0 ? (
                                                                              <div key={idx} className={styles.row}>
                                                                                  <div className="text-sm font-medium text-emerald-600">{adj.name}</div>
                                                                                  <div className="text-sm font-medium text-emerald-600">
                                                                                      +K{(adj.value).toFixed(2)}
                                                                                  </div>
                                                                              </div>
                                                                          ) : null
                                                                      )}
                                                                      {/* Profit Margin */}
                                                                      {(formData.smartPricing.profitMarginAmount ?? 0) > 0 && (
                                                                          <div className={styles.row}>
                                                                              <div className="text-sm font-medium text-green-600">
                                                                                  Profit Margin ({formData.smartPricing.marginType === 'percentage' ? `${formData.smartPricing.marginValue}%` : 'Fixed'})
                                                                              </div>
                                                                              <div className="text-sm font-medium text-green-600">
                                                                                  +K{(formData.smartPricing.profitMarginAmount).toFixed(2)}
                                                                              </div>
                                                                          </div>
                                                                      )}
                                                                      {/* Rounding */}
                                                                      {formData.smartPricing.wasRounded && (formData.smartPricing.roundingDifference ?? 0) !== 0 && (
                                                                          <div className={styles.row}>
                                                                              <div className="text-sm font-medium text-purple-600">Rounded</div>
                                                                              <div className="text-sm font-medium text-purple-600">
                                                                                  +K{(formData.smartPricing.roundingDifference).toFixed(2)}
                                                                              </div>
                                                                          </div>
                                                                      )}
                                                                      {/* Total */}
                                                                      <div className={styles.highlightRow}>
                                                                          <div>
                                                                              <div className="text-sm font-medium text-slate-800">Total</div>
                                                                              <div className="text-[10px] text-slate-400">
                                                                                  Per copy: K{((formData.smartPricing.roundedPrice ?? formData.price ?? 0) / (formData.smartPricing.copies || 1)).toFixed(2)}
                                                                              </div>
                                                                          </div>
                                                                          <div className={styles.priceValue}>
                                                                              K{(formData.smartPricing.roundedPrice ?? formData.price ?? 0).toFixed(2)}
                                                                          </div>
                                                                      </div>
                                                                  </>
                                                              ) : (
                                                                  <>
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">Cost base</div>
                                                                          <div className="text-sm font-medium text-slate-800">
                                                                              K{enginePreview?.cost?.toFixed(2) || '0.00'}
                                                                          </div>
                                                                      </div>
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">Market adjustments (+)</div>
                                                                          <div className="text-sm font-medium text-green-600">
                                                                              +K{(enginePreview?.adjustmentTotal - enginePreview?.marginAmount)?.toFixed(2) || '0.00'}
                                                                          </div>
                                                                      </div>
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">Profit margin (+)</div>
                                                                          <div className="text-sm font-medium text-green-600">
                                                                              +K{enginePreview?.marginAmount?.toFixed(2) || '0.00'}
                                                                          </div>
                                                                      </div>
                                                                      <div className={styles.row}>
                                                                          <div className="text-sm font-medium text-slate-600">Rounding (±)</div>
                                                                          <div className={`text-sm font-medium ${enginePreview?.marginAmount ? 'text-purple-600' : 'text-slate-400'}`}>
                                                                              ±K{(enginePreview?.unitPrice - enginePreview?.cost - (enginePreview?.adjustmentTotal - enginePreview?.marginAmount) - enginePreview?.marginAmount)?.toFixed(2) || '0.00'}
                                                                          </div>
                                                                      </div>
                                                                      <div className={styles.highlightRow}>
                                                                          <div className="text-sm font-medium text-slate-800">Selling price</div>
                                                                          <div className={styles.priceValue}>
                                                                              K{enginePreview?.unitPrice?.toFixed(2) || '0.00'}
                                                                          </div>
                                                                      </div>
                                                                  </>
                                                              )}
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                         </>
                                     )}

                                     {formData.type === 'Service' && (
                                         <div className={styles.card}>
                                             <h3 className={styles.sectionTitle}>Service pricing</h3>
                                             <div className="space-y-4">
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                     <div>
                                                         <label className={styles.label}>Pricing model</label>
                                                         <select className={styles.select}>
                                                             <option>Fixed</option>
                                                             <option>Hourly</option>
                                                             <option>Per page</option>
                                                         </select>
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Base rate</label>
                                                         <input
                                                             type="number"
                                                             value={formData.cost || 0}
                                                             onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                                                             className={styles.input}
                                                             step="0.01"
                                                             min="0"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Minimum charge</label>
                                                         <input
                                                             type="number"
                                                             value={minOrderQty || 0}
                                                             onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                                                             className={styles.input}
                                                             step="0.01"
                                                             min="0"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Tax class</label>
                                                         <select className={styles.select}>
                                                             <option>Standard (15%)</option>
                                                             <option>Exempt</option>
                                                             <option>Zero-rated</option>
                                                         </select>
                                                     </div>
</div>
                                              </div>
                                          </div>
                                      )}

                                     {formData.type === 'Raw Material' && (
                                         <div className={styles.card}>
                                             <h3 className={styles.sectionTitle}>Material pricing</h3>
                                             <div className="space-y-4">
                                                 <div>
                                                     <label className={styles.label}>Cost price</label>
                                                     <input
                                                         type="number"
                                                         value={formData.cost || 0}
                                                         onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                                                         className={styles.input}
                                                         step="0.01"
                                                         min="0"
                                                     />
                                                 </div>
                                                 <div className="grid grid-cols-3 gap-4">
                                                     <div>
                                                         <label className={styles.label}>Purchase unit</label>
                                                         <select className={styles.select}>
                                                             <option>Ream</option>
                                                             <option>Pack</option>
                                                             <option>Roll</option>
                                                             <option>Box</option>
                                                         </select>
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Units per pack</label>
                                                         <input
                                                             type="number"
                                                             value={formData.conversionRate || 1}
                                                             onChange={(e) => setFormData({ ...formData, conversionRate: Number(e.target.value) })}
                                                             className={styles.input}
                                                             min="1"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Supplier</label>
                                                         <select className={styles.select}>
                                                             <option>Select supplier</option>
                                                             {suppliers.map(s => (
                                                                 <option key={s.id} value={s.id}>{s.name}</option>
                                                             ))}
                                                         </select>
                                                     </div>
                                                 </div>
                                                 <div className={styles.summaryRow}>
                                                     <div className="text-sm font-medium text-slate-600">Cost per unit</div>
                                                     <div className="text-sm font-medium text-slate-800">
                                                         K{((formData.cost || 0) * (formData.conversionRate || 1)).toFixed(2)}
                                                     </div>
                                                 </div>
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div>
                                                         <label className={styles.label}>Lead time</label>
                                                         <input
                                                             type="number"
                                                             value={formData.leadTimeDays || 0}
                                                             onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                                                             className={styles.input}
                                                             min="0"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Currency</label>
                                                         <select className={styles.select}>
                                                             <option>USD</option>
                                                             <option>EUR</option>
                                                             <option>GBP</option>
                                                             <option>ZMW</option>
                                                         </select>
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     {formData.type === 'Stationery' && (
                                         <div className={styles.card}>
                                             <h3 className={styles.sectionTitle}>Stationery pricing</h3>
                                             <div className="space-y-4">
                                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                     <div>
                                                         <label className={styles.label}>Cost price (CP)</label>
                                                         <input
                                                             type="number"
                                                             value={formData.cost || 0}
                                                             onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                                                             className={styles.input}
                                                             step="0.01"
                                                             min="0"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Buying unit</label>
                                                         <input
                                                             type="text"
                                                             value={formData.purchaseUnit || ''}
                                                             onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value })}
                                                             className={styles.input}
                                                             placeholder="e.g. Box"
                                                         />
                                                     </div>
                                                     <div>
                                                         <label className={styles.label}>Items per unit</label>
                                                         <input
                                                             type="number"
                                                             value={formData.conversionRate || 1}
                                                             onChange={(e) => setFormData({ ...formData, conversionRate: Number(e.target.value) })}
                                                             className={styles.input}
                                                             min="1"
                                                         />
                                                     </div>
                                                 </div>
                                                 <div className={styles.summaryRow}>
                                                     <div className="text-sm font-medium text-slate-600">Cost per item</div>
                                                     <div className="text-sm font-medium text-slate-800">
                                                         K{(derivedCostPerPiece || 0).toFixed(2)}
                                                     </div>
                                                 </div>
                                                 <div>
                                                     <div className={styles.sectionTitle}>Active adjustments</div>
                                                     <div className="space-y-2">
                                                         {activeMarketAdjustments.slice(0, 3).map(adj => {
                                                             const isSelected = formData.pricingConfig?.selectedAdjustmentIds?.includes(adj.id) || false;
                                                            
                                                             return (
                                                                 <div key={adj.id} className={styles.row}>
                                                                     <label className="relative inline-flex items-center cursor-pointer">
                                                                         <input
                                                                             type="checkbox"
                                                                             checked={isSelected}
                                                                             onChange={() => handleToggleAdjustment(adj.id)}
                                                                             className="sr-only peer"
                                                                         />
                                                                         <div className={`w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}></div>
                                                                         <div className={`absolute left-[2px] top-[1px] w-3 h-3 rounded-full transition-all ${isSelected ? 'bg-white translate-x-4' : 'bg-slate-400 translate-x-0'}`}></div>
                                                                     </label>
                                                                     <div className="flex-1 ml-3">
                                                                         <div className="text-sm font-medium text-slate-700">{adj.name}</div>
                                                                         <div className="text-[10px] text-slate-500">
                                                                             {adj.type === 'PERCENTAGE' ? `${adj.value}%` : `K${adj.value}`}
                                                                         </div>
                                                                     </div>
                                                                 </div>
                                                             );
                                                         })}
</div>
                                                  </div>
                                                  <div className={styles.summaryRow}>
                                                     <div className="text-sm font-medium text-slate-600">Cost per item</div>
                                                     <div className="text-sm font-medium text-slate-800">
                                                         K{(derivedCostPerPiece || 0).toFixed(2)}
                                                     </div>
                                                 </div>
                                                 <div className={styles.row}>
                                                     <div className="text-sm font-medium text-slate-600">Adjustments (+)</div>
                                                     <div className="text-sm font-medium text-green-600">
                                                         +K{(derivedCostPerPiece * (formData.marginPercent || 0) / 100).toFixed(2)}
                                                     </div>
                                                 </div>
                                                 <div className={styles.row}>
                                                     <div className="text-sm font-medium text-slate-600">Profit margin (+)</div>
                                                     <div className="text-sm font-medium text-green-600">
                                                         +K{(derivedCostPerPiece * (formData.marginPercent || 0) / 100).toFixed(2)}
                                                     </div>
                                                 </div>
                                                 <div className={styles.highlightRow}>
                                                     <div className="text-sm font-medium text-slate-800">Selling price per item</div>
                                                     <div className={styles.priceValue}>
                                                         K{((derivedCostPerPiece || 0) * (1 + (formData.marginPercent || 0) / 100)).toFixed(2)}
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     )}
                             </div>
                             )}

                            {/* Inventory Tab */}
                            {hasStockFunctionality && activeTab === 'inventory' && (
                                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                                    {/* Metric Tiles */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className={styles.card}>
                                            <div className="text-xs text-slate-500 mb-1">On hand</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {formData.stock || 0} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                        <div className={styles.card}>
                                            <div className="text-xs text-slate-500 mb-1">Reserved</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {formData.reserved || 0} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                        <div className={styles.card}>
                                            <div className="text-xs text-slate-500 mb-1">Available</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {(formData.stock || 0) - (formData.reserved || 0)} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stock Status Badge for Stationery */}
                                    {formData.type === 'Stationery' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Status:</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                ((formData.stock || 0) - (formData.reserved || 0)) <= 0 
                                                    ? 'bg-red-100 text-red-700'
                                                    : ((formData.stock || 0) - (formData.reserved || 0)) <= (formData.reorderPoint || 10)
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-green-100 text-green-700'
                                            }`}>
                                                {((formData.stock || 0) - (formData.reserved || 0)) <= 0 ? 'Out' : ((formData.stock || 0) - (formData.reserved || 0)) <= (formData.reorderPoint || 10) ? 'Low' : 'OK'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Reorder Settings */}
                                    <div className={styles.card}>
                                        <h3 className={styles.sectionTitle}>Reorder settings</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={styles.label}>Reorder point</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.reorderPoint || 0}
                                                    onChange={(e) => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                                                    className={styles.input}
                                                    placeholder="e.g. 10"
                                                />
                                            </div>
                                            <div>
                                                <label className={styles.label}>Reorder quantity</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.minOrderQty || 1}
                                                    onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                                                    className={styles.input}
                                                    placeholder="e.g. 50"
                                                />
                                            </div>
                                            <div>
                                                <label className={styles.label}>Storage location</label>
                                                <input
                                                    type="text"
                                                    value={formData.binLocation || ''}
                                                    onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                                                    className={styles.input}
                                                    placeholder="e.g. A-1-2"
                                                />
                                            </div>
                                            <div>
                                                <label className={styles.label}>Stock status</label>
                                                <select className={styles.select}>
                                                    <option>In Stock</option>
                                                    <option>Low Stock</option>
                                                    <option>Out of Stock</option>
                                                    <option>Discontinued</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Track per Variant Toggle for Stationery */}
                                    {formData.type === 'Stationery' && (
                                        <div className={styles.card}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-700">Track per variant</div>
                                                    <div className="text-xs text-slate-500">Enable variant-level stock tracking</div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stock Movement */}
                                    <div className={styles.card}>
                                        <h3 className={styles.sectionTitle}>Stock movement</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={styles.label}>Adjustment type</label>
                                                <select className={styles.select}>
                                                    <option>Receipt</option>
                                                    <option>Issue</option>
                                                    <option>Adjustment</option>
                                                    <option>Transfer</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={styles.label}>Quantity</label>
                                                <input
                                                    type="number"
                                                    className={styles.input}
                                                    placeholder="e.g. 100"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className={styles.label}>Reference</label>
                                                <input
                                                    type="text"
                                                    className={styles.input}
                                                    placeholder="e.g. PO-2024-001"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-[8px] hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                <Plus className="w-4 h-4" /> Record movement
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Variants Tab */}
                            {(formData.type === 'Product' || formData.type === 'Stationery') && activeTab === 'variants' && (
                                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                                    {/* Header Section */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                                        <Layers className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-800">Product Variants</h4>
                                                        <p className="text-sm text-slate-600">Create and manage product variations</p>
                                                    </div>
                                                </div>
                                                {formData.variants && formData.variants.length > 0 && (
                                                    <div className="mt-4 flex items-center gap-4 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Total Variants:</span>
                                                            <span className="font-bold text-blue-600">{formData.variants.length}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Total Stock:</span>
                                                            <span className="font-bold text-emerald-600">
                                                                {formData.variants.reduce((sum, v) => sum + (v.stock || 0), 0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Value:</span>
                                                            <span className="font-bold text-purple-600">
                                                                {currency}{formData.variants.reduce((sum, v) => sum + ((v.price || 0) * (v.stock || 0)), 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBulkGenerator(true)}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-200 text-sm font-medium shadow-sm"
                                                >
                                                    <Grid className="w-4 h-4" /> Bulk Generate
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowVariantForm(true); if (formData.smartPricing) { setVariantPreview(calculateSmartVariantPrice(1, 1)); } }}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all text-sm font-medium shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Variant
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bulk Generator Panel */}
                                    {showBulkGenerator && (
                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                                                        <Wand2 className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-lg">Bulk Variant Generator</h4>
                                                        <p className="text-sm text-slate-600">Create multiple variants at once</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setShowBulkGenerator(false)} 
                                                    className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {bulkAttributes.map((attr, idx) => (
                                                    <div key={idx} className="bg-white rounded-xl p-5 border border-indigo-100 shadow-sm">
                                                        <div className="flex gap-4 items-start">
                                                            <div className="w-1/3">
                                                                <label className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2 block">Attribute Name</label>
                                                                <input
                                                                    type="text"
                                                                    value={attr.name}
                                                                    onChange={(e) => {
                                                                        const newAttrs = [...bulkAttributes];
                                                                        newAttrs[idx].name = e.target.value;
                                                                        setBulkAttributes(newAttrs);
                                                                    }}
                                                                    className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                                    placeholder="e.g. Color"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2 block">Values</label>
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {attr.values.map((val, vIdx) => (
                                                                        <span key={vIdx} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm">
                                                                            {val}
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    const newAttrs = [...bulkAttributes];
                                                                                    newAttrs[idx].values = newAttrs[idx].values.filter((_, i) => i !== vIdx);
                                                                                    setBulkAttributes(newAttrs);
                                                                                }}
                                                                                className="hover:bg-white/20 rounded p-0.5 transition-colors"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={bulkInputValue[idx] || ''}
                                                                        onChange={(e) => setBulkInputValue({ ...bulkInputValue, [idx]: e.target.value })}
                                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulkValue(idx))}
                                                                        className="flex-1 px-3 py-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                                        placeholder="e.g. Red"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBulkValue(idx)}
                                                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                    >
                                                                        Add
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBulkAttributes(bulkAttributes.filter((_, i) => i !== idx))}
                                                                className="mt-8 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                disabled={bulkAttributes.length === 1}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => setBulkAttributes([...bulkAttributes, { name: '', values: [] }])}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-indigo-300 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl transition-all text-sm font-medium"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Another Attribute
                                                </button>

                                                <div className="pt-6 border-t border-indigo-200 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkGenerate}
                                                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl flex items-center gap-3 font-medium shadow-lg transition-all transform hover:scale-105"
                                                        disabled={bulkAttributes.some(a => a.values.length === 0)}
                                                    >
                                                        <Wand2 className="w-5 h-5" />
                                                        Generate {bulkAttributes.reduce((acc, curr) => acc * (curr.values.length || 1), 1)} Variants
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variant Form */}
                                    {showVariantForm && (
                                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Variant Name</label>
                                                    <input
                                                        type="text"
                                                        value={newVariant.name || ''}
                                                        onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 100gsm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">SKU</label>
                                                    <input
                                                        type="text"
                                                        value={newVariant.sku || ''}
                                                        onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. SKU-GPP-001-A4"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Cost ({currency})</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={newVariant.cost || 0}
                                                        onChange={(e) => {
                                                            const newCost = Number(e.target.value);
                                                            const patch = { cost: newCost };
                                                            setNewVariant(
                                                                formData.type === 'Stationery'
                                                                    ? recalculateStationeryVariantPrice(newVariant, patch)
                                                                    : { ...newVariant, ...patch }
                                                            );
                                                        }}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 5.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Adj (%)</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={newVariant.adjustmentPercent || 0}
                                                        onChange={(e) => {
                                                            const adjPercent = Number(e.target.value);
                                                            const patch = { adjustmentPercent: adjPercent };
                                                            setNewVariant(
                                                                formData.type === 'Stationery'
                                                                    ? recalculateStationeryVariantPrice(newVariant, patch)
                                                                    : { ...newVariant, ...patch }
                                                            );
                                                        }}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 15.0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Rounding</label>
                                                    <select
                                                        value={newVariant.selectedRoundingMethod || 'none'}
                                                        onChange={(e) => {
                                                            const patch = { selectedRoundingMethod: e.target.value };
                                                            setNewVariant(
                                                                formData.type === 'Stationery'
                                                                    ? recalculateStationeryVariantPrice(newVariant, patch)
                                                                    : { ...newVariant, ...patch }
                                                            );
                                                        }}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                    >
                                                        <option value="none">None</option>
                                                        <option value="ROUND_UP">Round Up</option>
                                                        <option value="ROUND_DOWN">Round Down</option>
                                                        <option value="NEAREST_1">Nearest 1</option>
                                                        <option value="NEAREST_5">Nearest 5</option>
                                                        <option value="NEAREST_10">Nearest 10</option>
                                                        <option value="NEAREST_50">Nearest 50</option>
                                                        <option value="NEAREST_100">Nearest 100</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">SP ({currency})</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={newVariant.price || 0}
                                                        onChange={(e) => setNewVariant({ ...newVariant, price: Number(e.target.value), calculated_price: Number(e.target.value) })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 12.50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Stock</label>
                                                    <input
                                                        type="number"
                                                        value={newVariant.stock || 0}
                                                        onChange={(e) => setNewVariant({ ...newVariant, stock: Number(e.target.value) })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 50"
                                                    />
                                                </div>
                                                {formData.type !== 'Stationery' && (
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Pages</label>
                                                        <input
                                                            type="number"
                                                            value={newVariant.pages || 1}
                                                            onChange={(e) => {
                                                                const p = Math.max(1, Number(e.target.value) || 1);
                                                                setNewVariant({ ...newVariant, pages: p });
                                                                // Live preview using SmartPricing engine
                                                                if (formData.smartPricing) {
                                                                    setVariantPreview(calculateSmartVariantPrice(p, 1));
                                                                }
                                                            }}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                            placeholder="e.g. 40"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Smart Pricing live preview */}
                                            {formData.smartPricing && variantPreview && (
                                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-1.5">
                                                    <div className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
                                                        <TrendingUp className="w-3.5 h-3.5" /> Smart Pricing Preview ({variantPreview.pages} pages)
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>{inventory.find(i => i.id === formData.smartPricing?.paperItemId)?.name?.replace(/\s*\d+gsm.*/i,'') || 'Paper'}</span>
                                                        <span>{currency}{variantPreview.paperCost.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>{inventory.find(i => i.id === formData.smartPricing?.tonerItemId)?.name?.replace(/\s*Universal\s*/i,'') || 'Toner'}</span>
                                                        <span>{currency}{variantPreview.tonerCost.toFixed(2)}</span>
                                                    </div>
                                                    {variantPreview.finishingCost > 0 && (
                                                        <div className="flex justify-between text-xs text-slate-600">
                                                            <span>Finishing</span>
                                                            <span>{currency}{variantPreview.finishingCost.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {variantPreview.marketAdjustments.filter((a: any) => a.value > 0).map((a: any, i: number) => (
                                                        <div key={i} className="flex justify-between text-xs text-emerald-600">
                                                            <span>{a.name}</span>
                                                            <span>+{currency}{a.value.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                    {variantPreview.profitMarginAmount > 0 && (
                                                        <div className="flex justify-between text-xs text-green-600">
                                                            <span>Margin ({variantPreview.marginType === 'percentage' ? `${variantPreview.marginValue}%` : 'Fixed'})</span>
                                                            <span>+{currency}{variantPreview.profitMarginAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {variantPreview.wasRounded && (
                                                        <div className="flex justify-between text-xs text-purple-600">
                                                            <span>Rounded</span>
                                                            <span>+{currency}{variantPreview.roundingDifference.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-sm font-bold text-indigo-700 border-t border-indigo-200 pt-2 mt-1">
                                                        <span>Selling Price</span>
                                                        <span>{currency}{variantPreview.roundedPrice.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Pricing Mode Selector */}
                                            {((formData.type !== 'Stationery' && (formData.smartPricing?.hiddenBOMId || formData.smartPricing?.bomTemplateId)) || (formData.type === 'Stationery')) && (
                                                <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                                                    <label className="block text-xs font-medium text-slate-600 mb-2">Pricing Mode</label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="variantPricingMode"
                                                                value="dynamic"
                                                                checked={newVariant.pricingSource === 'dynamic' || newVariant.inheritsParentBOM === true}
                                                                onChange={() => setNewVariant({
                                                                    ...newVariant,
                                                                    pricingSource: 'dynamic',
                                                                    inheritsParentBOM: true,
                                                                    cost: formData.type === 'Stationery' ? (newVariant.cost || formData.cost) : newVariant.cost
                                                                })}
                                                                className="text-blue-600"
                                                            />
                                                            <span className="text-sm text-slate-700">Dynamic (Auto)</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="variantPricingMode"
                                                                value="static"
                                                                checked={newVariant.pricingSource === 'static' || (!newVariant.pricingSource && !newVariant.inheritsParentBOM)}
                                                                onChange={() => setNewVariant({
                                                                    ...newVariant,
                                                                    pricingSource: 'static',
                                                                    inheritsParentBOM: false
                                                                })}
                                                                className="text-blue-600"
                                                            />
                                                            <span className="text-sm text-slate-700">Static (Manual)</span>
                                                        </label>
                                                    </div>
                                                    {newVariant.pricingSource === 'dynamic' && (
                                                        <p className="text-xs text-slate-500 mt-2">
                                                            {formData.type === 'Stationery'
                                                                ? "Price will be calculated from Cost + Parent's selected Adjustments"
                                                                : `Price will be calculated from parent BOM using ${newVariant.pages || 1} pages`
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <VolumePricingManager
                                                enabled={Boolean(newVariant.allowVolumePricing)}
                                                tiers={newVariant.volumePricing || []}
                                                onToggle={(enabled) => setNewVariant({ ...newVariant, allowVolumePricing: enabled })}
                                                onChange={(tiers) => setNewVariant({ ...newVariant, volumePricing: tiers })}
                                                currency={currency}
                                                basePrice={newVariant.price || 0}
                                                cost={newVariant.cost || 0}
                                            />

                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowVariantForm(false)}
                                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleAddVariant}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                                >
                                                    Add Variant
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variants List — table layout */}
                                    {formData.variants && formData.variants.length > 0 ? (
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                                                <h5 className="font-semibold text-slate-800 text-sm">Active Variants ({formData.variants.length})</h5>
                                                {formData.smartPricing && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Smart Pricing
                                                    </span>
                                                )}
                                            </div>

                                            {/* Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-100">
                                                            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Variant</th>
                                                            {formData.type !== 'Stationery' && (
                                                                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-20">Pages</th>
                                                            )}
                                                            {formData.smartPricing && (
                                                                <>
                                                                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Paper</th>
                                                                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Toner</th>
                                                                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-green-400 uppercase tracking-wider">Finishing</th>
                                                                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Adjustments</th>
                                                                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Margin</th>
                                                                </>
                                                            )}
                                                            {!formData.smartPricing && (
                                                                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Cost</th>
                                                            )}
                                                            <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Selling Price</th>
                                                            <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-20">Stock</th>
                                                            <th className="w-20 px-3 py-2.5"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {formData.variants.map((variant, idx) => {
                                                            const snap = (variant as any).smartPricingSnapshot;
                                                            return (
                                                                <React.Fragment key={variant.id || idx}>
                                                                    <tr className="hover:bg-slate-50 transition-colors">
                                                                        {/* Name + SKU */}
                                                                        <td className="px-4 py-3">
                                                                            <div className="font-medium text-slate-800">{variant.name}</div>
                                                                            <div className="text-[10px] text-slate-400">SKU: {variant.sku || 'N/A'}</div>
                                                                        </td>

                                                                        {/* Pages — editable, triggers reprice */}
                                                                        {formData.type !== 'Stationery' && (
                                                                            <td className="px-3 py-3 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    value={variant.pages || 1}
                                                                                    onChange={(e) => handleVariantPagesChange(variant.id, Math.max(1, Number(e.target.value) || 1))}
                                                                                    className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-center focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                                                                                />
                                                                            </td>
                                                                        )}

                                                                        {/* Smart pricing breakdown columns */}
                                                                        {formData.smartPricing && (
                                                                            <>
                                                                                <td className="px-3 py-3 text-right text-xs text-slate-600">
                                                                                    {currency}{(snap?.paperCost ?? 0).toFixed(2)}
                                                                                </td>
                                                                                <td className="px-3 py-3 text-right text-xs text-slate-600">
                                                                                    {currency}{(snap?.tonerCost ?? 0).toFixed(2)}
                                                                                </td>
                                                                                <td className="px-3 py-3 text-right text-xs text-slate-600">
                                                                                    {currency}{(snap?.finishingCost ?? 0).toFixed(2)}
                                                                                </td>
                                                                                <td className="px-3 py-3 text-right text-xs text-emerald-600">
                                                                                    +{currency}{(snap?.marketAdjustmentTotal ?? 0).toFixed(2)}
                                                                                </td>
                                                                                <td className="px-3 py-3 text-right text-xs text-orange-600">
                                                                                    +{currency}{(snap?.profitMarginAmount ?? 0).toFixed(2)}
                                                                                </td>
                                                                            </>
                                                                        )}

                                                                        {/* Cost (non-smart products only) */}
                                                                        {!formData.smartPricing && (
                                                                            <td className="px-3 py-3 text-right text-xs font-medium text-emerald-700">
                                                                                {currency}{(variant.cost ?? 0).toFixed(2)}
                                                                            </td>
                                                                        )}

                                                                        {/* Selling price */}
                                                                        <td className="px-3 py-3 text-right">
                                                                            <div className="font-bold text-indigo-700 text-sm">{currency}{(variant.price ?? 0).toFixed(2)}</div>
                                                                            {snap?.wasRounded && (
                                                                                <div className="text-[10px] text-purple-400">rounded +{currency}{(snap.roundingDifference ?? 0).toFixed(2)}</div>
                                                                            )}
                                                                        </td>

                                                                        {/* Stock */}
                                                                        <td className="px-3 py-3 text-center">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                value={variant.stock}
                                                                                onChange={(e) => {
                                                                                    const newStock = Number(e.target.value);
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        variants: (prev.variants || []).map(v =>
                                                                                            v.id === variant.id ? { ...v, stock: newStock } : v
                                                                                        )
                                                                                    }));
                                                                                }}
                                                                                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-center focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
                                                                            />
                                                                        </td>

                                                                        {/* Actions */}
                                                                        <td className="px-3 py-3 text-center">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedVariantPricing(expandedVariantPricing === variant.id ? null : variant.id)}
                                                                                    className={`p-1.5 rounded-lg transition-all ${expandedVariantPricing === variant.id ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                                                    title="Volume Pricing"
                                                                                >
                                                                                    <Layers className="w-4 h-4" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveVariant(variant.id)}
                                                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>

                                                                    {/* Volume pricing expander — full-width row */}
                                                                    {expandedVariantPricing === variant.id && (
                                                                        <tr>
                                                                            <td colSpan={99} className="px-6 pb-4 pt-1 bg-blue-50/40">
                                                                                <div className="flex items-center gap-2 mb-3 pt-2">
                                                                                    <Layers className="w-4 h-4 text-blue-600" />
                                                                                    <h6 className="text-sm font-semibold text-blue-800">Volume Pricing</h6>
                                                                                </div>
                                                                                <VolumePricingManager
                                                                                    enabled={Boolean(variant.allowVolumePricing)}
                                                                                    tiers={variant.volumePricing || []}
                                                                                    onToggle={(enabled) => {
                                                                                        setFormData(prev => ({
                                                                                            ...prev,
                                                                                            variants: (prev.variants || []).map(v =>
                                                                                                v.id === variant.id ? { ...v, allowVolumePricing: enabled } : v
                                                                                            )
                                                                                        }));
                                                                                    }}
                                                                                    onChange={(tiers) => {
                                                                                        setFormData(prev => ({
                                                                                            ...prev,
                                                                                            variants: (prev.variants || []).map(v =>
                                                                                                v.id === variant.id ? { ...v, volumePricing: tiers } : v
                                                                                            )
                                                                                        }));
                                                                                    }}
                                                                                    currency={currency}
                                                                                    basePrice={variant.price || 0}
                                                                                    cost={variant.cost || 0}
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-dashed border-slate-300">
                                            <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <Layers className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h5 className="text-lg font-semibold text-slate-700 mb-2">No Variants Yet</h5>
                                            <p className="text-sm text-slate-500 mb-6">Start by adding your first product variant</p>
                                            <button
                                                type="button"
                                                onClick={() => { setShowVariantForm(true); if (formData.smartPricing) { setVariantPreview(calculateSmartVariantPrice(1, 1)); } }}
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Create First Variant
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                </div>

            </div >
        </div >
    );
};

export default ItemModal;
