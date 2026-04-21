import React, { useState, useEffect, useMemo } from 'react';
// PRICING RULE: Do NOT implement pricing logic here. All pricing MUST go through pricingEngine.ts
import { X, Save, Plus, Trash2, AlertCircle, Package, DollarSign, Hash, MapPin, Truck, Tag, FileText, Box, Layers, ArrowRight, Wand2, Grid, Scale, RefreshCw, Eye, EyeOff, Info, Check, Edit3 } from 'lucide-react';
import { Item, Warehouse, ProductVariant, PricingConfig, FinishingOption, AdjustmentSnapshot, BOMTemplate, VolumePricingTier } from '../../../types';
import { useData } from '../../../context/DataContext';
import { generateAutoSKU, generateAutoBarcode, generateBulkVariants } from '../../../utils/skuGenerator';
import { pricingService } from '../../../services/pricingService';
import { dbService } from '../../../services/db';
import { applyProductPriceRounding, ROUNDING_METHOD_OPTIONS } from '../../../services/pricingRoundingService';
import { calculateBaseSellingPrice } from '../../../utils/pricing';
import { calculateSellingPrice } from '../../../utils/pricing/pricingEngine';

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

    // Bulk Variant Generation State
    const [showBulkGenerator, setShowBulkGenerator] = useState(false);
    const [bulkAttributes, setBulkAttributes] = useState<{ name: string, values: string[] }[]>([{ name: 'Size', values: [] }]);
    const [bulkInputValue, setBulkInputValue] = useState<{ [key: number]: string }>({});
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
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

            const adjustmentsInput = activeMarketAdjustments.map(adj => ({
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
    }, [derivedCostPerPiece, formData.cost, formData.category, formData.id, activeMarketAdjustments]);

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
        dbService.getAll<BOMTemplate>('bomTemplates')
            .then((templates) => {
                if (mounted) setBomTemplates(templates || []);
            })
            .catch((err) => {
                console.error('Failed to load BOM templates for variant pricing', err);
            });
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

    // Helper to calculate cost/price based on pages and config
    const calculateItemFinancials = (pPages: number, pConfig: PricingConfig | undefined, pItemType?: string, pManualCost?: number) => {
        if (!pConfig || pConfig.manualOverride) return null;

        let totalCost = 0;
        let paperCost = 0;
        let tonerCost = 0;
        let finishingCost = 0;

        if (pItemType === 'Stationery') {
            totalCost = pManualCost || 0;
        } else {
            // 1. Paper
            const paper = materials.find((m: Item) => m.id === pConfig.paperId);
            const reamSize = paper?.conversionRate || 500;
            const sheetsNeeded = Math.ceil(pPages / 2);
            paperCost = paper ? ((paper.cost / reamSize) * sheetsNeeded) : 0;

            // 2. Toner
            const toner = materials.find((m: Item) => m.id === pConfig.tonerId);
            tonerCost = toner ? ((toner.cost / 20000) * pPages) : 0;

            // 3. Finishing
            finishingCost = pConfig.finishingOptions.reduce((acc, option) => {
                // If option defines an explicit flat cost per unit (used by SmartPricing-style buttons)
                if ((option as any).flatCostPerUnit != null) {
                    const perUnit = Number((option as any).flatCostPerUnit) || 0;
                    const qty = Number(option.quantity || 1);
                    return acc + (perUnit * qty);
                }

                const mat = materials.find((m: Item) => m.id === option.materialId);
                if (mat) {
                    const capacity = mat.rollLength || mat.conversionRate || 1;
                    const unitCost = mat.cost / capacity;
                    return acc + (unitCost * option.quantity);
                }
                return acc;
            }, 0);

            totalCost = paperCost + tonerCost + finishingCost;
        }

        // 4. Market Adjustments
        let totalMarketAdj = 0;
        const applicableAdjustments = activeMarketAdjustments.filter(ma => {
            if (pItemType === 'Stationery') {
                return pConfig.selectedAdjustmentIds?.includes(ma.id);
            }
            return true;
        });
        const snapshots: AdjustmentSnapshot[] = [];

        applicableAdjustments.forEach(adj => {
            let amount = 0;
            if (adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage') {
                amount = totalCost * (adj.value / 100);
            } else {
                // Scale fixed adjustment by pages to keep SP per page consistent
                // For stationery, we don't scale by pages as they are hidden
                amount = pItemType === 'Stationery' ? adj.value : adj.value * pPages;
            }
            totalMarketAdj += amount;
            snapshots.push({
                name: adj.name,
                type: adj.type as any,
                value: adj.value,
                amount: amount
            });
        });

        const basePrice = totalCost + totalMarketAdj;
        return {
            cost: totalCost,
            marketAdjustment: totalMarketAdj,
            price: basePrice, // Raw price
            snapshots
        };
    };


    // Pricing Calculation Logic
    useEffect(() => {
        if (formData.type === 'Raw Material' || !formData.pricingConfig || formData.pricingConfig.manualOverride) return;

        const financials = calculateItemFinancials(formData.pages || 1, formData.pricingConfig, formData.type, formData.cost);
        if (!financials) return;

        // Apply rounding
        const roundingResult = applyProductPriceRounding({
            calculatedPrice: financials.price,
            companyConfig,
            methodOverride: formData.pricingConfig?.selectedRoundingMethod,
            customStepOverride: formData.pricingConfig?.customRoundingStep
        });

        setFormData(prev => ({
            ...prev,
            cost: Number(financials.cost.toFixed(2)),
            price: roundingResult.roundedPrice,
            calculated_price: roundingResult.roundedPrice,
            adjustmentSnapshots: financials.snapshots,
            pricingConfig: {
                ...prev.pricingConfig!,
                totalCost: Number(financials.cost.toFixed(2)),
                marketAdjustment: Number(financials.marketAdjustment.toFixed(2))
            }
        }));

    }, [
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

        const variant: ProductVariant = {
            id: newVariant.id || generateVariantId(),
            productId: formData.id || generateId(),
            uuid: generateId(),
            sku: newVariant.sku,
            name: newVariant.name,
            attributes: newVariant.attributes || {},
            price: Number(newVariant.price) || 0,
            cost: Number(newVariant.cost) || 0,
            cost_price: Number(newVariant.cost) || 0,
            calculated_price: Number(newVariant.price) || 0,
            selling_price: Number(newVariant.price) || 0,
            rounding_difference: 0,
            stock: Number(newVariant.stock) || 0,
            pages: Number(newVariant.pages) || 1,
            adjustmentSnapshots: getAdjustmentSnapshots(Number(newVariant.cost) || 0),
            // Include pricing mode fields
            pricingSource: newVariant.pricingSource || 'static',
            inheritsParentBOM: newVariant.inheritsParentBOM ?? false
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

        // Check if variant uses dynamic pricing (has BOM template configured)
        const hasHiddenBOM = formData.smartPricing?.hiddenBOMId || formData.smartPricing?.bomTemplateId;
        const useDynamicPricing = variant?.pricingSource === 'dynamic' ||
            variant?.inheritsParentBOM ||
            (hasHiddenBOM && variant?.pricingSource !== 'static');

        if (useDynamicPricing && hasHiddenBOM) {
            // Dynamic pricing: Calculate from BOM
            try {
                const result = pricingService.calculateVariantPrice(
                    formData as Item,
                    { ...variant, pages: newPages } as ProductVariant,
                    1, // Unit quantity
                    inventory,
                    bomTemplates,
                    marketAdjustments
                );

                setFormData(prev => {
                    const updatedVariants = (prev.variants || []).map(v => {
                        if (v.id === variantId) {
                            // Transform bomBreakdown to ProductionCostSnapshot components format
                            const components = result.consumption?.bomBreakdown?.map(b => ({
                                componentId: b.materialId,
                                name: b.materialName,
                                quantity: b.quantity,
                                unit: b.unit,
                                unitCost: b.cost,
                                totalCost: b.quantity * b.cost,
                                costRole: 'production' as const
                            })) || [];

                            return {
                                ...v,
                                pages: newPages,
                                cost: result.cost,
                                price: result.price,
                                adjustmentSnapshots: result.adjustmentSnapshots,
                                productionCostSnapshot: result.consumption ? {
                                    baseProductionCost: result.cost,
                                    components,
                                    totalPagesUsed: newPages,
                                    source: 'VARIANT_PRICING' as const,
                                    createdAt: new Date().toISOString()
                                } : undefined,
                                calculatedAt: new Date().toISOString()
                            };
                        }
                        return v;
                    });
                    return { ...prev, variants: updatedVariants };
                });
            } catch (error) {
                console.error('Error calculating variant price:', error);
                // Fallback: just update pages
                setFormData(prev => {
                    const updatedVariants = (prev.variants || []).map(v => {
                        if (v.id === variantId) {
                            return { ...v, pages: newPages };
                        }
                        return v;
                    });
                    return { ...prev, variants: updatedVariants };
                });
            }
        } else {
            const specs = calculateItemFinancials(newPages, formData.pricingConfig, formData.type, variant.cost);

            // Apply rounding for variants
            let finalPrice = variant.price;
            if (specs) {
                const roundingResult = applyProductPriceRounding({
                    calculatedPrice: specs.price,
                    companyConfig,
                    methodOverride: formData.pricingConfig?.selectedRoundingMethod,
                    customStepOverride: formData.pricingConfig?.customRoundingStep
                });
                finalPrice = roundingResult.roundedPrice;
            }

            setFormData(prev => {
                const updatedVariants = (prev.variants || []).map(v => {
                    if (v.id === variantId) {
                        return {
                            ...v,
                            pages: newPages,
                            cost: specs ? specs.cost : v.cost,
                            price: finalPrice,
                            adjustmentSnapshots: specs ? specs.adjustmentSnapshots : v.adjustmentSnapshots
                        };
                    }
                    return v;
                });
                return { ...prev, variants: updatedVariants };
            });
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
                            <h2 className="text-lg font-bold text-slate-800">
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
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    { id: 'variants', label: 'Variants', icon: Layers }
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
                                            <span className="text-sm font-medium text-slate-700">Item Name</span>
                                            <input
                                                type="text"
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                    }`}
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
                                            <span className="text-sm font-medium text-slate-700">SKU</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.sku || ''}
                                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                    className={`flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.sku ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                        }`}
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

                                        <div className="mt-4">
                                            <span className="text-sm font-medium text-slate-700">Barcode (ISBN/UPC/EAN)</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.barcode || ''}
                                                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="e.g. 123456789012"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const barcode = generateAutoBarcode();
                                                        setFormData({ ...formData, barcode });
                                                    }}
                                                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                    title="Auto-Generate Barcode"
                                                >
                                                    <Hash className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Category */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-700">Category</span>
                                            <input
                                                type="text"
                                                value={formData.category || ''}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.category ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                    }`}
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
                                            <span className="text-sm font-medium text-slate-700">Item Type</span>
                                            <select
                                                value={formData.type || 'Product'}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value as Item['type'] })}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.type ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                    }`}
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
                                            <span className="text-sm font-medium text-slate-700">Unit of Measure</span>
                                            <select
                                                value={formData.unit || 'pcs'}
                                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.unit ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                    }`}
                                            >
                                                <option value="pcs">Pieces (pcs)</option>
                                                <option value="units">Units</option>
                                                <option value="kg">Kilograms (kg)</option>
                                                <option value="g">Grams (g)</option>
                                                <option value="l">Liters (l)</option>
                                                <option value="ml">Milliliters (ml)</option>
                                                <option value="m">Meters (m)</option>
                                                <option value="cm">Centimeters (cm)</option>
                                                <option value="rolls">Rolls</option>
                                                <option value="sheets">Sheets</option>
                                                <option value="reams">Reams</option>
                                                <option value="boxes">Boxes</option>
                                                <option value="packs">Packs</option>
                                                <option value="hours">Hours</option>
                                                <option value="sets">Sets</option>
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
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Description
                                        </label>
                                        <textarea
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            rows={3}
                                            placeholder="e.g. High-quality paper for professional photography"
                                        />
                                    </div>

                                    {/* Large Format Toggle */}
                                    <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                        <input
                                            type="checkbox"
                                            id="isLargeFormat"
                                            checked={formData.isLargeFormat || false}
                                            onChange={(e) => setFormData({ ...formData, isLargeFormat: e.target.checked })}
                                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="isLargeFormat" className="text-sm font-medium text-slate-700">
                                            Large Format Item (Rolls/Bulk)
                                        </label>
                                    </div>

                                    {formData.isLargeFormat && (
                                        <div className="grid grid-cols-2 gap-4 pl-4 border-l-4 border-indigo-200">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Roll Width (cm)</label>
                                                <input
                                                    type="number"
                                                    value={formData.rollWidth || ''}
                                                    onChange={(e) => setFormData({ ...formData, rollWidth: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg"
                                                    placeholder="e.g. 61"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Roll Length (m)</label>
                                                <input
                                                    type="number"
                                                    value={formData.rollLength || ''}
                                                    onChange={(e) => setFormData({ ...formData, rollLength: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg"
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

                                    {/* Pricing Summary */}
                                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-4 border border-blue-100">
                                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-blue-600" /> Pricing Summary
                                        </h3>
                                        
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Total items needed (based on BOM) */}
                                            <div className="col-span-2 bg-white rounded-lg p-3 border border-slate-200">
                                                <div className="text-xs text-slate-500 mb-1">Total Items Needed (BOM)</div>
                                                <div className="text-lg font-bold text-slate-800">
                                                    {bomTemplates.length > 0 
                                                        ? bomTemplates.reduce((sum, t) => sum + (t.quantity || 0), 0).toLocaleString()
                                                        : '0'
                                                    } units
                                                </div>
                                            </div>

                                            {/* Total production cost */}
                                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <div className="text-xs text-slate-500 mb-1">Production Cost</div>
                                                <div className="text-lg font-bold text-slate-800">
                                                    {currency}{formData.cost?.toFixed(2) || '0.00'}
                                                </div>
                                            </div>

                                            {/* Profit Margin */}
                                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <div className="text-xs text-slate-500 mb-1">Profit Margin</div>
                                                <div className={`text-lg font-bold ${
                                                    formData.cost && formData.price && formData.price > formData.cost
                                                        ? 'text-green-600' 
                                                        : 'text-red-600'
                                                }`}>
                                                    {formData.cost && formData.price && formData.price > formData.cost
                                                        ? `${(((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)}%`
                                                        : '0%'
                                                    }
                                                </div>
                                            </div>

                                            {/* Total adjustments */}
                                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <div className="text-xs text-slate-500 mb-1">Total Adjustments</div>
                                                <div className="text-lg font-bold text-amber-600">
                                                    {currency}{
                                                        (formData.pricingConfig?.selectedAdjustmentIds || []).reduce((sum, adjId) => {
                                                            const adj = activeMarketAdjustments.find(a => a.id === adjId);
                                                            if (!adj) return sum;
                                                            if (adj.type === 'PERCENTAGE' || adj.type === 'PERCENT') {
                                                                return sum + (formData.cost || 0) * (adj.value / 100);
                                                            }
                                                            return sum + adj.value;
                                                        }, 0).toFixed(2)
                                                    }
                                                </div>
                                            </div>

                                            {/* Rounding up income */}
                                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <div className="text-xs text-slate-500 mb-1">Rounding Income</div>
                                                <div className="text-lg font-bold text-purple-600">
                                                    {(() => {
                                                        const roundingResult = applyRoundingToPrice(resolveRoundingBasePrice(), item || undefined);
                                                        return currency + (roundingResult.roundingDifference > 0 ? roundingResult.roundingDifference : 0).toFixed(2);
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Total Selling price */}
                                            <div className="col-span-2 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                                                <div className="text-xs text-emerald-600 mb-1">Total Selling Price</div>
                                                <div className="text-2xl font-bold text-emerald-700">
                                                    {currency}{formData.price?.toFixed(2) || '0.00'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Edit Selling Price */}
                                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Quick Edit Selling Price
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currency}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.price || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    price: Number(e.target.value),
                                                    calculated_price: Number(e.target.value)
                                                })}
                                                className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g. 25.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Cost Price <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currency}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={usePackConversion ? derivedCostPerPiece : (formData.cost || '')}
                                                    onChange={(e) => !usePackConversion && setFormData({ ...formData, cost: Number(e.target.value) })}
                                                    disabled={usePackConversion}
                                                    readOnly={usePackConversion}
                                                    className={`w-full pl-8 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.cost ? 'border-red-300 bg-red-50' : 'border-slate-200'} ${usePackConversion ? 'bg-indigo-50 text-indigo-700' : ''}`}
                                                    placeholder="e.g. 10.00"
                                                />
                                            </div>
                                            {usePackConversion && (
                                                <p className="mt-1 text-xs text-indigo-500">Auto-calculated from pack cost</p>
                                            )}
                                        </div>

                                        {/* Selling Price - Hidden for Materials */}
                                        {formData.type !== 'Material' && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Selling Price {usePackConversion ? '(Auto-calculated)' : ''} <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currency}</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={usePackConversion ? finalPrice : (formData.price || '')}
                                                        onChange={(e) => !usePackConversion && setFormData({
                                                            ...formData,
                                                            price: Number(e.target.value),
                                                            calculated_price: Number(e.target.value),
                                                            pricingConfig: {
                                                                ...formData.pricingConfig!,
                                                                manualOverride: true
                                                            }
                                                        })}
                                                        disabled={usePackConversion}
                                                        readOnly={usePackConversion}
                                                        className={`w-full pl-8 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.price ? 'border-red-300 bg-red-50' : 'border-slate-200'} ${usePackConversion ? 'bg-indigo-50 text-indigo-700' : ''}`}
                                                        placeholder="e.g. 25.00"
                                                    />
                                                    {(usePackConversion || (!formData.pricingConfig?.manualOverride && formData.type === 'Stationery')) && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" /> AUTO
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                {errors.price && (
                                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {errors.price}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    {/* Margin Display - Hidden for Materials */}
                                    {formData.type !== 'Material' && (
                                        <div className="md:col-span-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Profit Margin</span>
                                                <span className={`text-lg font-bold ${formData.cost && formData.price && formData.price > formData.cost
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                                    }`}>
                                                    {formData.cost && formData.price
                                                        ? `${(((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)}%`
                                                        : '0%'
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Volume Pricing Section */}
                                    {formData.type !== 'Material' && (
                                        <div className="md:col-span-2">
                                            <VolumePricingManager
                                                enabled={formData.allowVolumePricing || false}
                                                tiers={formData.volumePricing || []}
                                                onToggle={(enabled) => setFormData({ ...formData, allowVolumePricing: enabled })}
                                                onChange={(tiers) => setFormData({ ...formData, volumePricing: tiers })}
                                                currency={currency}
                                                basePrice={formData.price || 0}
                                                cost={formData.cost || 0}
                                            />
                                        </div>
                                    )}

                                    {/* Internal Pricing Toggle Section - Hidden for Materials */}
                                    {formData.type !== 'Material' && formData.type !== 'Stationery' && (
                                        <div className="md:col-span-2 border-t border-slate-200 pt-4">
                                            <div className="flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowInternalPricing(!showInternalPricing)}
                                                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
                                                >
                                                    {showInternalPricing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    {showInternalPricing ? 'Hide Internal Pricing' : 'Show Internal Pricing'}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsRecalculating(true);
                                                        const roundingResult = applyRoundingToPrice(resolveRoundingBasePrice(), item || undefined);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            price: roundingResult.sellingPrice
                                                        }));
                                                        setTimeout(() => setIsRecalculating(false), 500);
                                                    }}
                                                    disabled={isRecalculating}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                                                    Recalculate Price
                                                </button>
                                            </div>

                                            {/* Internal Pricing Details */}
                                            {showInternalPricing && (
                                                <div className="mt-4 p-4 bg-slate-800 rounded-lg text-white space-y-3">
                                                    {(() => {
                                                        const roundingResult = applyRoundingToPrice(resolveRoundingBasePrice(), item || undefined);
                                                        return (
                                                            <>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm text-slate-400">Calculated Price (Raw)</span>
                                                                    <span className="font-mono">{currency}{roundingResult.calculatedPrice.toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm text-slate-400">Rounding Difference</span>
                                                                    <span className={`font-mono ${roundingResult.roundingDifference > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                                        {roundingResult.roundingDifference > 0 ? '+' : ''}{currency}{roundingResult.roundingDifference.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm text-slate-400">Rounding Method</span>
                                                                    <span className="font-mono text-blue-300">{roundingResult.roundingMethod || 'None'}</span>
                                                                </div>
                                                                <div className="border-t border-slate-600 pt-3 flex justify-between items-center">
                                                                    <span className="text-sm font-medium">Selling Price (Rounded)</span>
                                                                    <span className="text-xl font-bold text-green-400">{currency}{roundingResult.sellingPrice.toFixed(2)}</span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                        {/* Pages - Hidden for Materials & Stationery */}
                                        {formData.type !== 'Material' && formData.type !== 'Stationery' && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Pages
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.pages || 1}
                                                    onChange={(e) => setFormData({ ...formData, pages: Number(e.target.value) })}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="e.g. 100"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Conversion Unit Section for Materials & Stationery */}
                                    {(formData.type === 'Raw Material' || formData.type === 'Stationery') && (
                                        <div className="border-t border-slate-200 pt-6">
                                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                                <Scale className="w-5 h-5 text-indigo-600" /> UOM Conversion
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Purchase Unit (e.g., Box/Ream)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.purchaseUnit || ''}
                                                        onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. Box"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Stock/Usage Unit (e.g., Pcs/Sheet)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.usageUnit || ''}
                                                        onChange={(e) => setFormData({ ...formData, usageUnit: e.target.value })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. Pcs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Conversion Rate (Stock per Purchase Unit)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.conversionRate || 1}
                                                        onChange={(e) => setFormData({ ...formData, conversionRate: Number(e.target.value) })}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        placeholder="e.g. 50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-amber-800">
                                                    <strong>How it works:</strong> Purchase in <em>{formData.purchaseUnit || 'Purchase Unit'}</em>, stock in <em>{formData.usageUnit || 'Stock Unit'}</em>.<br />
                                                    <strong>Example:</strong> Buying 1 box of 50 pens → Stock increases by 50 units. Cost is per {formData.purchaseUnit || 'purchase unit'}.
                                                </p>
                                            </div>
                                        </div>
                                    )}



                                    {/* Market Adjustments Toggle/Select for Stationery */}
                                    {formData.type === 'Stationery' && (
                                        <div className="border-t border-slate-200 pt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                                    <Truck className="w-5 h-5 text-indigo-600" /> Active Market Adjustments
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-slate-500">Manual Override</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={formData.pricingConfig?.manualOverride || false}
                                                            onChange={(e) => patchPricingConfig({ manualOverride: e.target.checked })}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                                {activeMarketAdjustments.map(rule => (
                                                    <div
                                                        key={rule.id}
                                                        onClick={() => handleToggleAdjustment(rule.id)}
                                                        className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                                            formData.pricingConfig?.selectedAdjustmentIds?.includes(rule.id)
                                                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500'
                                                                : 'bg-white border-slate-200 hover:border-indigo-100 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                                formData.pricingConfig?.selectedAdjustmentIds?.includes(rule.id)
                                                                    ? 'bg-indigo-600 border-indigo-600'
                                                                    : 'border-slate-300 bg-white'
                                                            }`}>
                                                                {formData.pricingConfig?.selectedAdjustmentIds?.includes(rule.id) && (
                                                                    <Check className="w-3 h-3 text-white" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-700">{rule.name}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            formData.pricingConfig?.selectedAdjustmentIds?.includes(rule.id)
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {rule.type === 'PERCENTAGE' || rule.type === 'PERCENT' || rule.type === 'percentage'
                                                                ? `+${rule.value}%`
                                                                : `+${currency}${rule.value}`}
                                                        </span>
                                                    </div>
                                                ))}
                                                {activeMarketAdjustments.length === 0 && (
                                                    <p className="col-span-2 text-center py-4 text-slate-400 text-sm italic">No active market adjustments available</p>
                                                )}
                                            </div>

                                            {/* Rounding Selection for Stationery */}
                                            <div className="mb-6">
                                                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                    <Scale className="w-4 h-4 text-emerald-600" /> Selective Rounding Rule
                                                </h3>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {ROUNDING_METHOD_OPTIONS.map(option => (
                                                        <div
                                                            key={option.value}
                                                            onClick={() => handlePricingConfigChange('selectedRoundingMethod', option.value)}
                                                            className={`px-3 py-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                                                                formData.pricingConfig?.selectedRoundingMethod === option.value
                                                                    ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500'
                                                                    : 'bg-white border-slate-200 hover:border-emerald-100 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                                                formData.pricingConfig?.selectedRoundingMethod === option.value
                                                                    ? 'bg-emerald-600 border-emerald-600'
                                                                    : 'border-slate-300 bg-white'
                                                            }`}>
                                                                {formData.pricingConfig?.selectedRoundingMethod === option.value && (
                                                                    <div className="w-1 h-1 rounded-full bg-white" />
                                                                )}
                                                            </div>
                                                            <span className={`text-[11px] font-bold transition-colors ${
                                                                formData.pricingConfig?.selectedRoundingMethod === option.value ? 'text-emerald-700' : 'text-slate-600'
                                                            }`}>
                                                                {option.label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-slate-800 rounded-xl p-4 text-white">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs text-slate-400">Base Cost (CP)</span>
                                                    <span className="font-mono">{currency}{formData.cost?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs text-slate-400">Selected Adjustments</span>
                                                    <span className="font-mono text-indigo-400">+{currency}{formData.pricingConfig?.marketAdjustment?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="border-t border-slate-700 pt-2 flex justify-between items-end">
                                                    <div>
                                                        <span className="text-xs text-slate-400 block">Calculated SP</span>
                                                        <span className="text-xl font-bold text-green-400">{currency}{formData.calculated_price?.toFixed(2) || formData.price?.toFixed(2) || '0.00'}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-slate-500 block uppercase">Profit Margin</span>
                                                        <span className="text-sm font-bold text-emerald-400">
                                                            {formData.cost && formData.price ? `${(((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)}%` : '0%'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {formData.cost && formData.price && formData.price > formData.cost && (
                                                    <div className="mt-2 pt-2 border-t border-slate-600 flex justify-between items-center">
                                                        <span className="text-xs text-emerald-400">Profit Amount</span>
                                                        <span className="text-sm font-bold text-emerald-400">+{currency}{(formData.price - formData.cost).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Advanced Pricing Configuration - Hidden for Materials & Stationery */}
                                    {formData.type !== 'Material' && formData.type !== 'Stationery' && (
                                        <div className="border-t border-slate-200 pt-6">
                                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                                <Hash className="w-5 h-5 text-blue-600" /> Advanced Pricing Configuration
                                            </h3>

                                            {/* Hidden BOM Section */}
                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                                                <h4 className="text-sm font-medium text-slate-700 mb-3">Hidden BOM (Automatic Cost Calculation)</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Paper Material</label>
                                                        <select
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                            value={formData.pricingConfig?.paperId || ''}
                                                            onChange={(e) => handlePricingConfigChange('paperId', e.target.value)}
                                                        >
                                                            <option value="">Select Paper...</option>
                                                            {paperMaterials.map((m: Item) => (
                                                                <option key={m.id} value={m.id}>{m.name} ({currency}{m.cost}/unit)</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Toner Material</label>
                                                        <select
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                            value={formData.pricingConfig?.tonerId || ''}
                                                            onChange={(e) => handlePricingConfigChange('tonerId', e.target.value)}
                                                        >
                                                            <option value="">Select Toner...</option>
                                                            {tonerMaterials.map((m: Item) => (
                                                                <option key={m.id} value={m.id}>{m.name} ({currency}{m.cost}/unit)</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

{/* Finishing Options - simplified button set matching SmartPricing */}
                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                                                <h4 className="text-sm font-medium text-slate-700 mb-3">Finishing Options</h4>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {finishingButtons.map(btn => {
                                                        const exists = (formData.pricingConfig?.finishingOptions || []).some(o => o.type === btn.name || o.id === btn.id);
                                                        return (
                                                            <button
                                                                key={btn.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    // toggle option
                                                                    setFormData(prev => {
                                                                        const current = prev.pricingConfig?.finishingOptions || [];
                                                                        const found = current.find(o => o.type === btn.name || o.id === btn.id);
                                                                        if (found) {
                                                                            return {
                                                                                ...prev,
                                                                                pricingConfig: {
                                                                                    ...prev.pricingConfig!,
                                                                                    finishingOptions: current.filter(o => !(o.type === btn.name || o.id === btn.id))
                                                                                }
                                                                            };
                                                                        }

                                                                        // add option with flat cost per copy stored in flatCostPerUnit
                                                                        const newOpt: FinishingOption = {
                                                                            id: generateId(),
                                                                            type: btn.name,
                                                                            materialId: '',
                                                                            quantity: 1
                                                                        } as any;
                                                                        (newOpt as any).flatCostPerUnit = btn.cost; // used in calculation

                                                                        return {
                                                                            ...prev,
                                                                            pricingConfig: {
                                                                                ...prev.pricingConfig!,
                                                                                finishingOptions: [...current, newOpt]
                                                                            }
                                                                        };
                                                                    });
                                                                }}
                                                                className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors flex items-center gap-2 ${exists ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                            >
                                                                <span className="text-xs font-bold">{btn.name}</span>
                                                                <span className="text-[11px] text-slate-500">{currency}{btn.cost.toFixed(0)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Detailed list for selected finishing options */}
                                                <div className="space-y-2">
                                                    {(formData.pricingConfig?.finishingOptions || []).map((option, idx) => (
                                                        <div key={option.id || idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-700">{option.type}</div>
                                                                <div className="text-[11px] text-slate-500">Per copy: {currency}{((option as any).flatCostPerUnit ?? 0).toFixed(2)}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={option.quantity || 1}
                                                                    onChange={(e) => updateFinishingOption(option.id, 'quantity', Number(e.target.value))}
                                                                    className="w-20 px-2 py-1 text-sm border border-slate-200 rounded text-center"
                                                                />
                                                                {String(option.type || '').toLowerCase() !== 'folding' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateFinishingOption(option.id, 'quantity', 0)}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                                        title="Remove"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Market Adjustments */}
                                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                                <div className="flex flex-col gap-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-indigo-900">Active Market Adjustments</h4>
                                                        <p className="text-xs text-indigo-600 mb-2">Automated system-wide pricing adjustments</p>

                                                        <div className="flex flex-wrap gap-2">
                                                            {(() => {
                                                                if (activeMarketAdjustments.length > 0) {
                                                                    return activeMarketAdjustments.map(rule => (
                                                                        <div key={rule.id} className="px-3 py-1.5 border border-indigo-200 rounded-lg text-xs bg-indigo-100 text-indigo-900 font-medium flex items-center gap-2">
                                                                            <Truck className="w-3 h-3" />
                                                                            {rule.name}
                                                                            <span className="bg-white px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                                                {rule.type === 'PERCENTAGE' || rule.type === 'PERCENT' || rule.type === 'percentage'
                                                                                    ? `+${rule.value}%`
                                                                                    : `+${currency}${rule.value}`}
                                                                            </span>
                                                                        </div>
                                                                    ));
                                                                }
                                                                return <span className="text-slate-500 italic text-sm">No active market adjustments found</span>;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between border-t border-indigo-100 pt-4">
                                                        <span className="text-sm font-medium text-indigo-900">Total Adjustment Value</span>
                                                        <div className="relative w-32">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500">{currency}</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={formData.pricingConfig?.marketAdjustment?.toFixed(2) || 0}
                                                                readOnly
                                                                className="w-full pl-8 pr-4 py-2 border border-indigo-200 rounded-lg text-indigo-900 bg-indigo-50 font-bold"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Summary - Hidden for Materials & Stationery */}
                                    {formData.type !== 'Material' && formData.type !== 'Stationery' && (
                                        <div className="mt-4 p-4 bg-slate-800 rounded-lg text-white grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-xs text-slate-400">Total BOM Cost</div>
                                                <div className="text-lg font-bold">{currency}{formData.cost?.toFixed(2)}</div>
                                            </div>
                                            <div className="flex items-center justify-center text-slate-500">+</div>
                                            <div>
                                                <div className="text-xs text-slate-400">Total Adjustments</div>
                                                <div className="text-lg font-bold">{currency}{formData.pricingConfig?.marketAdjustment?.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Inventory Tab */}
                            {hasStockFunctionality && activeTab === 'inventory' && (
                                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Stock Quantity */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Stock Quantity <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.stock || 0}
                                                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.stock ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                    }`}
                                                disabled={mode === 'edit'}
                                                placeholder="e.g. 100"
                                            />
                                            {mode === 'edit' && (
                                                <p className="mt-1 text-xs text-slate-500">Stock is managed through adjustments</p>
                                            )}
                                            {errors.stock && (
                                                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> {errors.stock}
                                                </p>
                                            )}
                                        </div>

                                        {/* Min Stock Level */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Reorder Level
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.minStockLevel || 0}
                                                onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g. 10"
                                            />
                                        </div>

                                        {/* Reorder Point */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Reorder Point
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.reorderPoint || 0}
                                                onChange={(e) => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g. 20"
                                            />
                                        </div>

                                        {/* Min Order Qty */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Minimum Order Quantity
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.minOrderQty || 1}
                                                onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g. 5"
                                            />
                                        </div>

                                        {/* Lead Time */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Lead Time (Days)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.leadTimeDays || 0}
                                                onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g. 7"
                                            />
                                        </div>

                                        {/* Bin Location */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Bin Location
                                            </label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={formData.binLocation || ''}
                                                    onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="e.g., A-1-2"
                                                />
                                            </div>
                                        </div>

                                        {/* Preferred Supplier */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Preferred Supplier
                                            </label>
                                            <div className="relative">
                                                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <select
                                                    value={formData.preferredSupplierId || ''}
                                                    onChange={(e) => setFormData({ ...formData, preferredSupplierId: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="">Select supplier...</option>
                                                    {suppliers?.map(supplier => (
                                                        <option key={supplier.id} value={supplier.id}>
                                                            {supplier.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warehouse Stock Distribution */}
                                    {warehouses.length > 0 && (
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                <Box className="w-4 h-4" /> Warehouse Stock Distribution
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {warehouses.map(wh => (
                                                    <div key={wh.id}>
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">{wh.name}</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={formData.locationStock?.find(l => l.warehouseId === wh.id)?.quantity || 0}
                                                            onChange={(e) => handleLocationStockChange(wh.id, Number(e.target.value))}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                            disabled={mode === 'edit'}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Variants Tab */}
                            {hasStockFunctionality && activeTab === 'variants' && (
                                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-700">Product Variants</h4>
                                            <p className="text-xs text-slate-500">Add size, color, or other variations</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowBulkGenerator(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                <Grid className="w-4 h-4" /> Bulk Generate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowVariantForm(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                            >
                                                <Plus className="w-4 h-4" /> Add Variant
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bulk Generator Panel */}
                                    {showBulkGenerator && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 animate-in fade-in slide-in-from-top-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                    <Wand2 className="w-4 h-4 text-indigo-500" />
                                                    Bulk Variant Generator
                                                </h4>
                                                <button onClick={() => setShowBulkGenerator(false)} className="text-slate-400 hover:text-slate-600">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {bulkAttributes.map((attr, idx) => (
                                                    <div key={idx} className="flex gap-4 items-start bg-white p-3 rounded border border-slate-200">
                                                        <div className="w-1/3">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Attribute Name</label>
                                                            <input
                                                                type="text"
                                                                value={attr.name}
                                                                onChange={(e) => {
                                                                    const newAttrs = [...bulkAttributes];
                                                                    newAttrs[idx].name = e.target.value;
                                                                    setBulkAttributes(newAttrs);
                                                                }}
                                                                className="w-full px-2 py-1 border rounded text-sm mt-1"
                                                                placeholder="e.g. Color"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Values</label>
                                                            <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                                                {attr.values.map((val, vIdx) => (
                                                                    <span key={vIdx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">
                                                                        {val}
                                                                        <button type="button" onClick={() => {
                                                                            const newAttrs = [...bulkAttributes];
                                                                            newAttrs[idx].values = newAttrs[idx].values.filter((_, i) => i !== vIdx);
                                                                            setBulkAttributes(newAttrs);
                                                                        }}><X className="w-3 h-3" /></button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={bulkInputValue[idx] || ''}
                                                                    onChange={(e) => setBulkInputValue({ ...bulkInputValue, [idx]: e.target.value })}
                                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulkValue(idx))}
                                                                    className="flex-1 px-2 py-1 border rounded text-sm"
                                                                    placeholder="e.g. Red"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addBulkValue(idx)}
                                                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium"
                                                                >
                                                                    Add
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBulkAttributes(bulkAttributes.filter((_, i) => i !== idx))}
                                                            className="mt-6 text-red-400 hover:text-red-600"
                                                            disabled={bulkAttributes.length === 1}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => setBulkAttributes([...bulkAttributes, { name: '', values: [] }])}
                                                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Another Attribute (e.g. Color)
                                                </button>

                                                <div className="pt-4 border-t border-slate-200 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkGenerate}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                                                        disabled={bulkAttributes.some(a => a.values.length === 0)}
                                                    >
                                                        <Wand2 className="w-4 h-4" />
                                                        Generate {bulkAttributes.reduce((acc, curr) => acc * (curr.values.length || 1), 1)} Variants
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variant Form */}
                                    {showVariantForm && (
                                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
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
                                                            onChange={(e) => setNewVariant({ ...newVariant, pages: Number(e.target.value) })}
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                            placeholder="e.g. 40"
                                                        />
                                                    </div>
                                                )}
                                            </div>

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

                                    {/* Variants List */}
                                    {formData.variants && formData.variants.length > 0 ? (
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Name</th>
                                                        {formData.type !== 'Stationery' && <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Pages</th>}
                                                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Cost</th>
                                                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Price</th>
                                                        <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Stock</th>
                                                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {formData.variants.map((variant, idx) => (
                                                        <React.Fragment key={variant.id || idx}>
                                                            <tr className="hover:bg-slate-50">
                                                                <td className="px-4 py-2 text-sm text-slate-800">{variant.name}</td>
                                                                {formData.type !== 'Stationery' && (
                                                                    <td className="px-4 py-2">
                                                                        <input
                                                                            type="number"
                                                                            value={variant.pages || 0}
                                                                            onChange={(e) => handleVariantPagesChange(variant.id, Number(e.target.value))}
                                                                            className="w-20 px-2 py-1 text-xs border border-slate-200 rounded text-center"
                                                                        />
                                                                    </td>
                                                                )}
                                                                <td className="px-4 py-2 text-sm text-slate-600 text-right">{currency}{variant.cost.toFixed(2)}</td>
                                                                <td className="px-4 py-2 text-sm text-slate-800 text-right font-medium">{currency}{variant.price.toFixed(2)}</td>
                                                                <td className="px-4 py-2">
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
                                                                        className="w-20 px-2 py-1 text-xs border border-slate-200 rounded text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-right flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedVariantPricing(expandedVariantPricing === variant.id ? null : variant.id)}
                                                                        className={`p-1.5 rounded transition-colors ${expandedVariantPricing === variant.id ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                                        title="Manage Volume Pricing"
                                                                    >
                                                                        <Layers className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveVariant(variant.id)}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {expandedVariantPricing === variant.id && (
                                                                <tr key={`pricing-${variant.id}`} className="bg-blue-50/20">
                                                                    <td colSpan={6} className="px-4 pb-4 pt-0">
                                                                        <div className="border-t border-blue-100 mt-2">
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
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No variants added yet</p>
                                            <p className="text-xs">Click "Add Variant" to create product variations</p>
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
