
import React, { useState, useMemo, useEffect } from 'react';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    AreaChart, Area, Cell, PieChart, Pie, ResponsiveContainer, Legend
} from 'recharts';
import {
    Activity, Filter, Printer, X,
    Users, BarChart3, Receipt, ShieldCheck, PieChart as PieChartIcon, Sparkles,
    TrendingUp, Coins, Target, ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLocation, useNavigate } from 'react-router-dom';

import { format, differenceInDays } from 'date-fns';
import { calculateMarginAnalysis, calculateAdjustmentStatistics } from '../services/reportService';
import SalesAudit from './reports/SalesAudit';
import RevenueDashboard from './reports/RevenueDashboard';
import ClientLedger from './reports/ClientLedger';
import InternalAuditor from './reports/InternalAuditor';
import RoundingAnalytics from './reports/RoundingAnalytics';
import BusinessHealthReport from './reports/BusinessHealthReport';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type ReportCategory =
    | 'Overview'
    | 'Sales Audit'
    | 'Auditor'
    | 'Financials'
    | 'Client Ledger'
    | 'Margin Performance'
    | 'Rounding Analytics'
    | 'Business Intel'
    | 'Health Diagnostic';

const Reports: React.FC = () => {
    const { sales = [], companyConfig, invoices = [], customers = [] } = useData();
    const location = useLocation();
    const navigate = useNavigate();
    const currency = companyConfig?.currencySymbol || '$';


    const [activeCategory, setActiveCategory] = useState<ReportCategory>(() => {
        if (location.pathname.includes('sales-audit')) return 'Sales Audit';
        if (location.pathname.includes('margin-performance')) return 'Margin Performance';
        if (location.pathname.includes('rounding-analytics')) return 'Rounding Analytics';
        if (location.pathname.includes('financials')) return 'Financials';
        if (location.pathname.includes('contacts')) return 'Client Ledger';
        if (location.pathname.includes('auditor')) return 'Auditor';
        if (location.pathname.includes('intel')) return 'Business Intel';
        if (location.pathname.includes('health')) return 'Health Diagnostic';
        return 'Overview';
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedSubAccountNames, setSelectedSubAccountNames] = useState<string[]>([]);
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'week' | 'month' | 'quarter' | 'year'>('all');

    // Sync active category with URL
    useEffect(() => {
        if (location.pathname.includes('sales-audit')) setActiveCategory('Sales Audit');
        else if (location.pathname.includes('margin-performance')) setActiveCategory('Margin Performance');
        else if (location.pathname.includes('rounding-analytics')) setActiveCategory('Rounding Analytics');
        else if (location.pathname.includes('financials')) setActiveCategory('Financials');
        else if (location.pathname.includes('contacts')) setActiveCategory('Client Ledger');
        else if (location.pathname.includes('auditor')) setActiveCategory('Auditor');
        else if (location.pathname.includes('intel')) setActiveCategory('Business Intel');
        else if (location.pathname.includes('health')) setActiveCategory('Health Diagnostic');
        else if (location.pathname.endsWith('/revenue') || location.pathname.endsWith('/reports')) setActiveCategory('Overview');
    }, [location.pathname]);

    const handleTabClick = (id: string) => {
        setActiveCategory(id as ReportCategory);
        // Map ID to route
        const routeMap: Record<string, string> = {
            'Overview': '/revenue',
            'Sales Audit': '/revenue/sales-audit',
            'Margin Performance': '/revenue/margin-performance',
            'Rounding Analytics': '/revenue/rounding-analytics',
            'Client Ledger': '/revenue/contacts',
            'Auditor': '/revenue/auditor',
            'Business Intel': '/revenue/intel',
            'Health Diagnostic': '/revenue/health',
            'Financials': '/fiscal-reports/financials'
        };
        if (routeMap[id]) {
            navigate(routeMap[id]);
        }
    };


    const formatCurrency = (val: number) => {
        if (val === undefined || val === null || isNaN(val)) return `${currency}0.00`;
        return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    const renderAuditor = () => <InternalAuditor />;


    const renderClientLedger = () => <ClientLedger />;

    const renderMarginPerformance = () => {
        // ✅ Include both sales and invoices in margin analysis
        const invoicesAsSales = (invoices || []).map((inv: any) => ({
            ...inv,
            id: inv.id,
            date: inv.date,
            customerName: inv.customerName,
            totalAmount: inv.totalAmount,
            items: inv.items,
            adjustmentSnapshots: inv.adjustmentSnapshots || [],
            adjustmentTotal: inv.adjustmentTotal || 0,
            transactionAdjustments: inv.transactionAdjustments || [],
            adjustmentSummary: inv.adjustmentSummary || []
        }));
        
        const allTransactions = [...(sales || []), ...invoicesAsSales];
        const marginData = calculateMarginAnalysis(allTransactions);

        // Filter by date range
        const now = new Date();
        const filterByDate = (dateStr: string) => {
            if (selectedDateRange === 'all') return true;
            const date = new Date(dateStr);
            const diffDays = differenceInDays(now, date);
            switch (selectedDateRange) {
                case 'week': return diffDays <= 7;
                case 'month': return diffDays <= 30;
                case 'quarter': return diffDays <= 90;
                case 'year': return diffDays <= 365;
                default: return true;
            }
        };

        const filteredData = marginData.filter(d => {
            if (selectedCustomerId && d.customerName !== customers.find(c => c.id === selectedCustomerId)?.name) return false;
            if (!filterByDate(d.date)) return false;
            return true;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const adjustmentStats = calculateAdjustmentStatistics(allTransactions);

        // Prepare data for trends
        const trendData = filteredData.map(d => ({
            date: format(new Date(d.date), 'MMM dd'),
            grossMargin: d.grossMargin,
            netMargin: d.netMarginPerSale,
            marginPercent: d.marginPercent
        }));

        const totalGrossProfit = filteredData.reduce((sum, d) => sum + d.grossMargin, 0);
        const totalAdjustments = filteredData.reduce((sum, d) => sum + d.totalAdjustments, 0);
        const avgMarginPercent = filteredData.length > 0 
            ? filteredData.reduce((sum, d) => sum + d.marginPercent, 0) / filteredData.length 
            : 0;

return (
            <div className="space-y-6 animate-fadeIn">
                {/* Header Section with KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 tablet-auto-fit-250 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Avg Gross Margin</p>
                                <h3 className={`text-2xl font-black mt-1 tabular-nums ${avgMarginPercent > 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {avgMarginPercent.toFixed(1)}%
                                </h3>
                                <p className={`text-[11px] mt-1 font-medium ${avgMarginPercent > 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {avgMarginPercent > 20 ? 'Healthy' : 'Low'}
                                </p>
                            </div>
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <TrendingUp size={24} className="text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Market Adjustments</p>
                                <h3 className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
                                    {formatCurrency(totalAdjustments)}
                                </h3>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <Coins size={24} className="text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Total Gross Profit</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                                    {formatCurrency(totalGrossProfit)}
                                </h3>
                            </div>
                            <div className="p-3 bg-slate-100 rounded-xl">
                                <Target size={24} className="text-slate-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Transaction Count</p>
                                <h3 className="text-2xl font-black text-indigo-600 mt-1 tabular-nums">
                                    {filteredData.length}
                                </h3>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-xl">
                                <BarChart3 size={24} className="text-indigo-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 tablet-auto-fit-280 tablet-auto-fit-reset gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-emerald-500" />
                            Margin Performance Trend
                        </h3>
                        <div style={{ width: '100%', height: 256, minHeight: 150 }}>
                            <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currency}${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                                    <Tooltip 
                                        formatter={(val: number) => [formatCurrency(val), '']}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#3b82f6" strokeWidth={2} fill="url(#colorGross)" />
                                    <Area type="monotone" dataKey="netMargin" name="Net Margin" stroke="#10b981" strokeWidth={2} fill="url(#colorNet)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                            <Activity size={18} className="text-blue-500" />
                            Adjustment Distribution
                        </h3>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
                                <BarChart data={adjustmentStats} layout="vertical" margin={{ left: 40, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="adjustmentName" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}}
                                        width={100}
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                        formatter={(val: number) => [formatCurrency(val), 'Amount']}
                                    />
                                    <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]} barSize={20}>
                                        {adjustmentStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Adjustment Statistics Section */}
                {adjustmentStats.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                            <Activity size={18} className="text-blue-500" />
                            Adjustment Performance Matrix
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                                        <th className="px-4 py-3">Adjustment Name</th>
                                        <th className="px-4 py-3 text-right">Total Impact</th>
                                        <th className="px-4 py-3 text-right">Volume</th>
                                        <th className="px-4 py-3 text-right">Items Affected</th>
                                        <th className="px-4 py-3 text-right">Mean Per Trans.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {adjustmentStats.map((adj, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                    <span className="font-semibold text-slate-700">{adj.adjustmentName}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{formatCurrency(adj.totalAmount)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{adj.count}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{adj.itemsAffected}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{formatCurrency(adj.meanAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderOverview = () => <RevenueDashboard />;
    const renderRoundingAnalytics = () => <RoundingAnalytics />;
    const renderBusinessIntel = () => <InternalAuditor />;

    const NAV_ITEMS = [
        { id: 'Overview', label: 'Dashboard', icon: Activity },
        { id: 'Sales Audit', label: 'Sales Audit', icon: Receipt },
        { id: 'Margin Performance', label: 'Margin Performance', icon: BarChart3 },
        { id: 'Rounding Analytics', label: 'Rounding Analytics', icon: Activity },
        { id: 'Client Ledger', label: 'Client Ledger', icon: Users },
        { id: 'Business Intel', label: 'Business Intel', icon: PieChartIcon },
        { id: 'Health Diagnostic', label: 'Health Diagnostic', icon: Sparkles },
        { id: 'Auditor', label: 'Internal Auditor', icon: ShieldCheck },
    ];

    return (
        <div className="flex flex-col h-screen w-full bg-[#f8fafc] font-sans text-[13px] leading-[1.5] text-slate-700 overflow-hidden">
            <div className="bg-white border-b border-slate-200 shrink-0 px-6 py-4 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-2xl text-slate-900 tracking-tight">Business Intelligence</h2>
                        <p className="text-slate-500 text-sm font-medium">Financial insights and performance metrics</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Date Range Filter - Only show for Margin Performance */}
                        {activeCategory === 'Margin Performance' && (
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                {(['all', 'week', 'month', 'quarter', 'year'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setSelectedDateRange(range)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedDateRange === range
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {range === 'all' ? 'All' : range.charAt(0).toUpperCase() + range.slice(1)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative mr-4">
                            <button
                                onClick={() => setIsCustomerFilterOpen(!isCustomerFilterOpen)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-semibold tracking-wide ${selectedCustomerId ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                            >
                                <Filter size={16} />
                                {selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : 'Filter by Customer'}
                                {selectedCustomerId && (
                                    <X
                                        size={16}
                                        className="ml-1 hover:text-rose-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCustomerId('');
                                            setSelectedSubAccountNames([]);
                                        }}
                                    />
                                )}
                            </button>

                            {isCustomerFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[12px] font-semibold text-slate-400 tracking-widest block">Select customer</label>
                                            <button onClick={() => setIsCustomerFilterOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                        </div>
                                        <select
                                            value={selectedCustomerId}
                                            onChange={(e) => {
                                                setSelectedCustomerId(e.target.value);
                                                setSelectedSubAccountNames([]);
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="">All customers</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>

                                        {selectedCustomerId && (
                                            <div className="pt-2 border-t border-slate-100">
                                                <label className="text-[12px] font-semibold text-slate-400 tracking-widest mb-2 block">Filter sub-accounts</label>
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {['Main', ...(customers.find(c => c.id === selectedCustomerId)?.subAccounts?.map(s => s.name) || [])].map(sub => (
                                                        <label key={sub} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors group">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSubAccountNames.includes(sub)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedSubAccountNames([...selectedSubAccountNames, sub]);
                                                                    } else {
                                                                        setSelectedSubAccountNames(selectedSubAccountNames.filter(s => s !== sub));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <span className="text-[13px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{sub}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 font-medium">Leave unchecked to see all sub-accounts</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                            <button
                                onClick={() => window.print()}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Print report"
                            >
                                <Printer size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="report-content" className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">

                <div className="max-w-[1600px] mx-auto">
                    {activeCategory === 'Overview' && renderOverview()}
                    {activeCategory === 'Sales Audit' && <SalesAudit />}
                    {activeCategory === 'Margin Performance' && renderMarginPerformance()}
                    {activeCategory === 'Rounding Analytics' && renderRoundingAnalytics()}
                    {activeCategory === 'Client Ledger' && renderClientLedger()}
                    {activeCategory === 'Business Intel' && renderBusinessIntel()}
                    {activeCategory === 'Health Diagnostic' && <BusinessHealthReport />}
                    {activeCategory === 'Auditor' && renderAuditor()}
                </div>
        </div>
    </div>
);
};

export default Reports;
