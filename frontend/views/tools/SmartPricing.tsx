import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, X, Info, Copy, RefreshCw, Save, Printer, Package, Settings, Plus, TrendingUp } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useSales } from '../../context/SalesContext';
import { applyProductPriceRounding } from '../../services/pricingRoundingService';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../../services/db';
import { getGlobalDefaultMargin } from '../../services/pricingService';
import { Item, MarketAdjustment, BOMTemplate } from '../../types';

interface FinishingOption {
    id: string;
    name: string;
    cost: number;
    enabled: boolean;
    description?: string;
    coversPerCopy?: number;
    materialConversionRate?: number;
}

const defaultFinishingOptions: FinishingOption[] = [
    { id: 'binding', name: 'Binding', cost: 150, enabled: false, description: 'Book binding - comb or spiral', coversPerCopy: 1, materialConversionRate: 1 },
    { id: 'coverPages', name: 'Cover Pages', cost: 20, enabled: false, description: 'Front and back cover pages per copy', coversPerCopy: 2, materialConversionRate: 1 },
    { id: 'cutting', name: 'Cutting & Trimming', cost: 30, enabled: false, description: 'Trim edges to clean finish', coversPerCopy: 1, materialConversionRate: 1 },
    { id: 'holePunch', name: 'Hole Punching', cost: 20, enabled: false, description: 'Punch holes for folder binding', coversPerCopy: 1, materialConversionRate: 1 },
    { id: 'folding', name: 'Folding', cost: 15, enabled: false, description: 'Fold pages for insertion', coversPerCopy: 1, materialConversionRate: 1 },
    { id: 'stapling', name: 'Stapling', cost: 10, enabled: false, description: 'Corner or saddle stapling', coversPerCopy: 1, materialConversionRate: 1 },
];

const SmartPricing: React.FC = () => {
    const { companyConfig } = useData();

    // Global Default Margin for auto-pricing
    const [globalMargin, setGlobalMargin] = React.useState<{ margin_type: 'percentage' | 'fixed_amount'; margin_value: number } | null>(null);
    const [globalMarginWarning, setGlobalMarginWarning] = React.useState<string | null>(null);

    // Load Global Default Margin on mount
    React.useEffect(() => {
        const loadGlobalMargin = async () => {
            try {
                const margin = await getGlobalDefaultMargin();
                setGlobalMargin(margin);
                if (!margin || margin.margin_value <= 0) {
                    setGlobalMarginWarning('No Global Default Margin configured. Configure in Settings > Profit Margin.');
                } else {
                    setGlobalMarginWarning(null);
                }
            } catch (error) {
                console.error('Failed to load Global Default Margin:', error);
                setGlobalMarginWarning('Failed to load Global Default Margin.');
            }
        };
        loadGlobalMargin();
    }, []);
    const { addJobOrder, jobOrders } = useSales();
    const navigate = useNavigate();
    const currency = companyConfig?.currencySymbol || 'K';
    
    const [pages, setPages] = useState(1);
    const [copies, setCopies] = useState(1);
    const [selectedPaperId, setSelectedPaperId] = useState<string>('');
    const [selectedTonerId, setSelectedTonerId] = useState<string>('');
    const [finishingOptions, setFinishingOptions] = useState<FinishingOption[]>(defaultFinishingOptions);
    const [marketAdjustmentEnabled, setMarketAdjustmentEnabled] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showProductDialog, setShowProductDialog] = useState(false);
    const [productName, setProductName] = useState('');
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [editingCosts, setEditingCosts] = useState<{ [key: string]: number }>({});
    const [inventory, setInventory] = useState<Item[]>([]);
    const [marketAdjustments, setMarketAdjustments] = useState<MarketAdjustment[]>([]);
    const [bomTemplates, setBOMTemplates] = useState<BOMTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [paperExpanded, setPaperExpanded] = useState(true);
    const [finishingExpanded, setFinishingExpanded] = useState(true);
    const [marketExpanded, setMarketExpanded] = useState(false);
    const [bomExpanded, setBomExpanded] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [inv, adjustments, templates] = await Promise.all([
                    dbService.getAll<Item>('inventory'),
                    dbService.getAll<MarketAdjustment>('marketAdjustments'),
                    dbService.getAll<BOMTemplate>('bomTemplates'),
                ]);
                setInventory(inv);
                setMarketAdjustments(adjustments);
                setBOMTemplates(templates);

                const savedCosts = await dbService.getSetting<Record<string, number>>('finishingOptionCosts');
                if (savedCosts) {
                    setFinishingOptions(prev => prev.map(opt => ({
                        ...opt,
                        cost: savedCosts[opt.id] ?? opt.cost
                    })));
                }

                const paperItems = inv.filter(i => {
                    const cat = (i.category || '').toLowerCase();
                    return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
                });
                const tonerItems = inv.filter(i => {
                    const cat = (i.category || '').toLowerCase();
                    return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
                });

                if (paperItems.length > 0) setSelectedPaperId(paperItems[0].id);
                if (tonerItems.length > 0) {
                    const universalToner = tonerItems.find(t => 
                        (t.name || '').toLowerCase().includes('universal')
                    );
                    setSelectedTonerId(universalToner ? universalToner.id : tonerItems[0].id);
                }
            } catch (err) {
                console.error('Failed to load pricing data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const paperItems = useMemo(() => inventory.filter(i => {
        const cat = (i.category || '').toLowerCase();
        return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
    }), [inventory]);

    const tonerItems = useMemo(() => inventory.filter(i => {
        const cat = (i.category || '').toLowerCase();
        return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
    }), [inventory]);

    const selectedPaper = useMemo(() => inventory.find(i => i.id === selectedPaperId), [inventory, selectedPaperId]);
    const selectedToner = useMemo(() => inventory.find(i => i.id === selectedTonerId), [inventory, selectedTonerId]);

    const calculateCosts = () => {
        let paperCost = 0;
        if (selectedPaper) {
            const sheetsPerCopy = Math.ceil(pages / 2);
            const totalSheets = sheetsPerCopy * copies;
            const reamSize = Number(selectedPaper.conversionRate || selectedPaper.conversion_rate || 500);
            const paperUnitCost = Number(selectedPaper.cost_price || selectedPaper.cost_per_unit || selectedPaper.cost || 0);
            const costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
            paperCost = Number((totalSheets * costPerSheet).toFixed(2));
        }

        let tonerCost = 0;
        if (selectedToner) {
            const capacity = 20000;
            const totalPages = pages * copies;
            const tonerUnitCost = Number(selectedToner.cost_price || selectedToner.cost_per_unit || selectedToner.cost || 0);
            const costPerPage = tonerUnitCost / capacity;
            tonerCost = Number((totalPages * costPerPage).toFixed(2));
        }

        const finishingCost = finishingOptions
            .filter(o => o.enabled)
            .reduce((sum, o) => {
                return sum + (o.cost * copies);
            }, 0);

        const baseCost = paperCost + tonerCost + finishingCost;
        
        const marketAdjustmentTotal = marketAdjustmentEnabled 
            ? marketAdjustments.reduce((sum, adj) => {
                const type = (adj.type || '').toUpperCase();
                if (type === 'PERCENTAGE' || type === 'PERCENT') {
                    return sum + (baseCost * ((adj.value || 0) / 100));
                }
                return sum + ((adj.value || 0) * pages * copies);
            }, 0)
            : 0;
        
        const priceAfterMarketAdjustments = baseCost + marketAdjustmentTotal;
        
        return { paperCost, tonerCost, finishingCost, baseCost, marketAdjustmentTotal, priceAfterMarketAdjustments };
    };

    const { paperCost, tonerCost, finishingCost, baseCost, marketAdjustmentTotal, priceAfterMarketAdjustments } = calculateCosts();

    // Apply Global Default Margin to get final price
    const profitMarginAmount = React.useMemo(() => {
        if (!globalMargin || globalMargin.margin_value <= 0) return 0;
        if (globalMargin.margin_type === 'percentage') {
            return priceAfterMarketAdjustments * (globalMargin.margin_value / 100);
        } else {
            return globalMargin.margin_value;
        }
    }, [globalMargin, priceAfterMarketAdjustments]);

    const finalPrice = priceAfterMarketAdjustments + profitMarginAmount;

    const roundingResult = React.useMemo(() => {
        try {
            return applyProductPriceRounding({ calculatedPrice: finalPrice, companyConfig });
        } catch (err) {
            console.error('Rounding failed', err);
            // Fallback: no rounding
            return {
                originalPrice: finalPrice,
                roundedPrice: finalPrice,
                roundingDifference: 0,
                methodUsed: (companyConfig?.pricingSettings?.defaultMethod as any) || 'ALWAYS_UP_50',
                stepUsed: companyConfig?.pricingSettings?.customStep || 50,
                applyRounding: false,
                wasRounded: false,
                alreadyRounded: false
            } as any;
        }
    }, [finalPrice, companyConfig]);

    const displayTotal = roundingResult?.roundedPrice ?? finalPrice;

    const handlePagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 10000) setPages(value);
        else if (e.target.value === '') setPages(1);
    };

    const handleCopiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 10000) setCopies(value);
        else if (e.target.value === '') setCopies(1);
    };

    const toggleFinishingOption = (id: string) => {
        setFinishingOptions(prev => prev.map(opt => 
            opt.id === id ? { ...opt, enabled: !opt.enabled } : opt
        ));
    };

    const resetCalculator = () => {
        setPages(1);
        setCopies(1);
        if (paperItems.length > 0) setSelectedPaperId(paperItems[0].id);
        if (tonerItems.length > 0) setSelectedTonerId(tonerItems[0].id);
        setFinishingOptions(defaultFinishingOptions);
        setMarketAdjustmentEnabled(true);
    };

    const formatCurrency = (value: number) => `${currency} ${value.toFixed(2)}`;
    const totalPages = pages * copies;
    const totalSheets = Math.ceil(pages / 2) * copies;

    const getItemCost = (item: Item | undefined) => {
        if (!item) return 0;
        return Number(item.cost_price || item.cost_per_unit || item.cost || 0);
    };

    const getItemUnit = (item: Item | undefined) => {
        if (!item) return '';
        return item.unit || 'unit';
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Calculator className="w-12 h-12 text-indigo-500 animate-pulse" />
                    <p className="text-slate-500">Loading pricing engine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gradient-to-br from-slate-50 to-indigo-50 overflow-auto">
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <Calculator className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Smart Pricing Engine</h1>
                            <p className="text-slate-500">Calculate print job pricing with BOM cost analysis</p>
                        </div>
                        {globalMarginWarning && (
                            <div className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                                <Info size={16} /> {globalMarginWarning}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => {
                            const costs: { [key: string]: number } = {};
                            finishingOptions.forEach(opt => { costs[opt.id] = opt.cost; });
                            setEditingCosts(costs);
                            setShowSettings(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                    >
                        <Settings size={18} />
                        Settings
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setPaperExpanded(!paperExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Calculator size={18} className="text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Print Settings</h3>
                                </div>
                                {paperExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {paperExpanded && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Pages per Copy</label>
                                            <input
                                                type="number"
                                                value={pages}
                                                onChange={handlePagesChange}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                                min={1}
                                                max={10000}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Number of Copies</label>
                                            <input
                                                type="number"
                                                value={copies}
                                                onChange={handleCopiesChange}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                                min={1}
                                                max={10000}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Sheets needed: <span className="font-medium text-slate-700">{totalSheets}</span> | 
                                        Total pages: <span className="font-medium text-slate-700">{totalPages}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setBomExpanded(!bomExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Package size={18} className="text-amber-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">BOM Materials (Auto-selected)</h3>
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Active</span>
                                </div>
                                {bomExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {bomExpanded && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Paper</label>
                                        {paperItems.length > 0 ? (
                                            <select
                                                value={selectedPaperId}
                                                onChange={(e) => setSelectedPaperId(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {paperItems.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} - {currency} {getItemCost(item).toFixed(2)}/{getItemUnit(item)} (Stock: {item.stock || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">No paper items found</div>
                                        )}
                                        {selectedPaper && (
                                            <div className="mt-2 p-3 bg-blue-50 rounded-xl">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Sheets needed:</span>
                                                    <span className="font-medium text-slate-800">{totalSheets} sheets</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Paper cost:</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(paperCost)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Toner/Ink</label>
                                        {tonerItems.length > 0 ? (
                                            <select
                                                value={selectedTonerId}
                                                onChange={(e) => setSelectedTonerId(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {tonerItems.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} - {currency} {getItemCost(item).toFixed(2)}/{getItemUnit(item)} (Stock: {item.stock || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">No toner items found</div>
                                        )}
                                        {selectedToner && (
                                            <div className="mt-2 p-3 bg-purple-50 rounded-xl">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Pages to print:</span>
                                                    <span className="font-medium text-slate-800">{totalPages} pages</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Toner cost:</span>
                                                    <span className="font-medium text-purple-600">{formatCurrency(tonerCost)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setFinishingExpanded(!finishingExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Info size={18} className="text-purple-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Finishing Options</h3>
                                </div>
                                {finishingExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {finishingExpanded && (
                                <div className="px-6 pb-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {finishingOptions.map(option => (
                                            <label 
                                                key={option.id} 
                                                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                                                    option.enabled ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                                } border`}
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-800">{option.name}</div>
                                                    <div className="text-xs text-slate-500">{option.description}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-slate-600">{currency} {option.cost}</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={option.enabled}
                                                        onChange={() => toggleFinishingOption(option.id)}
                                                        className="w-5 h-5 text-purple-600 rounded"
                                                    />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setMarketExpanded(!marketExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <Calculator size={18} className="text-emerald-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Market Adjustments</h3>
                                </div>
                                {marketExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {marketExpanded && (
                                <div className="px-6 pb-6">
                                    <label className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl cursor-pointer mb-4">
                                        <div>
                                            <span className="font-medium text-slate-800">Apply Market Adjustments</span>
                                            <p className="text-xs text-slate-500">Include inflation, logistics & cost layers</p>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={marketAdjustmentEnabled}
                                            onChange={() => setMarketAdjustmentEnabled(!marketAdjustmentEnabled)}
                                            className="w-5 h-5 text-emerald-600 rounded"
                                        />
                                    </label>
                                    {marketAdjustmentEnabled && marketAdjustments.length > 0 && (
                                        <div className="space-y-2">
                                            {marketAdjustments.map(adj => (
                                                <div key={adj.id} className="flex justify-between p-3 bg-slate-50 rounded-lg">
                                                    <span className="text-sm text-slate-600">{adj.name}</span>
                                                    <span className="text-sm font-medium text-emerald-600">+{adj.percentage || adj.value || 0}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {marketAdjustmentEnabled && marketAdjustments.length === 0 && (
                                        <p className="text-sm text-slate-500 italic">No market adjustments configured.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden sticky top-6">
                            <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600">
                                <h3 className="text-white font-semibold text-lg">Price Summary</h3>
                                <p className="text-indigo-200 text-sm">{pages} pages × {copies} copies = {totalPages} total</p>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between text-slate-600">
                                    <span>{selectedPaper?.name?.replace(/\s*\d+gsm.*/i, '') || 'Paper'}</span>
                                    <span className="font-medium">{formatCurrency(paperCost)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>{selectedToner?.name?.replace(/\s*Universal\s*/i, '') || 'Toner'}</span>
                                    <span className="font-medium">{formatCurrency(tonerCost)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Finishing</span>
                                    <span className="font-medium">{formatCurrency(finishingCost)}</span>
                                </div>
                                {marketAdjustmentEnabled && marketAdjustments.map((adj, idx) => {
                                    const type = (adj.type || '').toUpperCase();
                                    const category = (adj.adjustmentCategory || adj.category || '').toLowerCase();
                                    let adjustmentValue = 0;
                                    if (type === 'PERCENTAGE' || type === 'PERCENT') {
                                        adjustmentValue = baseCost * ((adj.value || 0) / 100);
                                    } else {
                                        adjustmentValue = (adj.value || 0) * pages * copies;
                                    }
                                    if (adjustmentValue > 0) {
                                        // Color differentiation based on adjustment category
                                        let colorClass = 'text-emerald-600'; // default green
                                        if (category.includes('logistics') || category.includes('transport')) {
                                            colorClass = 'text-blue-600'; // blue for logistics
                                        } else if (category.includes('waste') || category.includes('wastage')) {
                                            colorClass = 'text-rose-600'; // red/rose for waste
                                        } else if (category.includes('overhead') || category.includes('labor') || category.includes('energy')) {
                                            colorClass = 'text-amber-600'; // amber for overhead
                                        }
                                        return (
                                            <div key={idx} className={`flex justify-between ${colorClass}`}>
                                                <span>{adj.name || 'Market Adjustment'}</span>
                                                <span className="font-medium">+{formatCurrency(adjustmentValue)}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                                {profitMarginAmount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Profit Margin ({globalMargin?.margin_type === 'percentage' ? `${globalMargin.margin_value}%` : 'Fixed'})</span>
                                        <span className="font-medium">+{formatCurrency(profitMarginAmount)}</span>
                                    </div>
                                )}
                                {roundingResult && roundingResult.wasRounded && (
                                    <div className="flex justify-between text-purple-600">
                                        <span>Rounded</span>
                                        <span className="font-medium">+{formatCurrency(roundingResult.roundingDifference)}</span>
                                    </div>
                                )}
                                <div className="border-t-2 border-indigo-100 pt-4 flex justify-between items-end">
                                    <div className="font-bold text-slate-800">Total</div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-indigo-600">{formatCurrency(displayTotal)}</div>
                                    </div>
                                </div>
                                <div className="text-center text-xs text-slate-400">
                                    Per copy: {formatCurrency(displayTotal / copies)}
                                </div>
                            </div>

                            <div className="px-6 pb-6 space-y-3">
                                <button 
                                    onClick={resetCalculator}
                                    className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    <RefreshCw size={18} />
                                    Reset
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowProductDialog(true);
                                    }}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Create Product
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <h4 className="font-medium text-slate-800 mb-3">Inventory Stats</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Paper Types</span>
                                    <span className="font-medium">{paperItems.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Toner Types</span>
                                    <span className="font-medium">{tonerItems.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Market Adjustments</span>
                                    <span className="font-medium">{marketAdjustments.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Finishing Options Settings</h2>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-500 mb-4">Set the default cost for each finishing option (per unit):</p>
                            {finishingOptions.map(option => (
                                <div key={option.id} className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-700">{option.name}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">{currency}</span>
                                        <input
                                            type="number"
                                            value={editingCosts[option.id] ?? option.cost}
                                            onChange={(e) => setEditingCosts(prev => ({ ...prev, [option.id]: parseFloat(e.target.value) || 0 }))}
                                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-right"
                                            min={0}
                                            step={0.01}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    const newCosts: Record<string, number> = {};
                                    finishingOptions.forEach(opt => {
                                        newCosts[opt.id] = editingCosts[opt.id] ?? opt.cost;
                                    });
                                    await dbService.saveSetting('finishingOptionCosts', newCosts);
                                    setFinishingOptions(prev => prev.map(opt => ({
                                        ...opt,
                                        cost: newCosts[opt.id] ?? opt.cost
                                    })));
                                    setShowSettings(false);
                                }}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showProductDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Create Product from Pricing</h2>
                            <button onClick={() => { setShowProductDialog(false); setProductName(''); }} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Product Name</label>
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    placeholder="e.g. Standard 80-page Book"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Pages:</span>
                                    <span className="font-medium">{pages} pages</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Copies:</span>
                                    <span className="font-medium">{copies}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Paper:</span>
                                    <span className="font-medium">{selectedPaper?.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Toner:</span>
                                    <span className="font-medium">{selectedToner?.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Finishing:</span>
                                    <span className="font-medium">{finishingOptions.filter(o => o.enabled).map(o => o.name).join(', ') || 'None'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Rounding:</span>
                                    <span className="font-medium">{roundingResult?.methodUsed || 'None'}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                                    <span className="font-semibold">Total Price:</span>
                                    <span className="font-bold text-indigo-600">{formatCurrency(displayTotal)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => { setShowProductDialog(false); setProductName(''); }}
                                className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                                disabled={isCreatingProduct}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!productName.trim()) {
                                        alert('Please enter a product name');
                                        return;
                                    }
                                    setIsCreatingProduct(true);
                                    try {
                                        const productId = `PROD-${Date.now()}`;
                                        const bomId = `BOM-${Date.now()}`;
                                        
                                        const newProduct: Item = {
                                            id: productId,
                                            name: productName,
                                            sku: `SKU-${Date.now()}`,
                                            type: 'Product',
                                            category: 'Printed Products',
                                            unit: 'copy',
                                            cost: baseCost,
                                            price: displayTotal,
                                            selling_price: displayTotal,
                                            calculated_price: displayTotal,
                                            stock: 0,
                                            pages: pages,
                                            smartPricing: {
                                                pages,
                                                copies,
                                                paperItemId: selectedPaperId,
                                                tonerItemId: selectedTonerId,
                                                finishingEnabled: finishingOptions.filter(o => o.enabled).map(o => o.id),
                                                roundingMethod: roundingResult?.methodUsed,
                                                roundedPrice: displayTotal,
                                                originalPrice: finalPrice
                                            } as any
                                        };
                                        
                                        const components: any[] = [];
                                        if (selectedPaper) {
                                            components.push({
                                                itemId: selectedPaperId,
                                                name: selectedPaper.name,
                                                quantityFormula: `${totalSheets}`,
                                                unit: selectedPaper.unit || 'ream'
                                            });
                                        }
                                        if (selectedToner) {
                                            components.push({
                                                itemId: selectedTonerId,
                                                name: selectedToner.name,
                                                quantityFormula: `${Math.ceil(totalPages / 20000 * 100)} / 100`,
                                                unit: selectedToner.unit || 'unit'
                                            });
                                        }
                                        finishingOptions.filter(o => o.enabled).forEach(opt => {
                                            components.push({
                                                itemId: opt.id,
                                                name: opt.name,
                                                quantityFormula: `${opt.id === 'coverPages' ? copies * 2 : copies}`,
                                                unit: 'unit'
                                            });
                                        });
                                        
                                        const newBom: BOMTemplate = {
                                            id: bomId,
                                            name: productName,
                                            type: 'Custom',
                                            components: components,
                                            lastUpdated: new Date().toISOString()
                                        };
                                        
                                        await dbService.put('inventory', newProduct);
                                        await dbService.put('bomTemplates', newBom);
                                        
                                        alert(`Product "${productName}" created and saved to inventory with corresponding BOM recipe.`);
                                        setShowProductDialog(false);
                                        setProductName('');
                                        resetCalculator();
                                    } catch (error) {
                                        console.error('Failed to create product:', error);
                                        alert('Failed to create product');
                                    } finally {
                                        setIsCreatingProduct(false);
                                    }
                                }}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                                disabled={isCreatingProduct}
                            >
                                {isCreatingProduct ? 'Creating...' : 'Create Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartPricing;
