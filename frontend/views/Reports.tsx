
import React, { useState, useMemo } from 'react';
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
import { useLocation } from 'react-router-dom';
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
            <div className="space-y-8 animate-fadeIn pb-20">
                {/* Header Section with KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                                <TrendingUp size={20} />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Avg Gross Margin</p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-3xl font-black text-slate-900 leading-none">
                                    {avgMarginPercent.toFixed(1)}%
                                </h3>
                                <div className={`flex items-center text-[11px] font-bold pb-1 ${avgMarginPercent > 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {avgMarginPercent > 20 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {avgMarginPercent > 20 ? 'Healthy' : 'Low'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                                <Coins size={20} />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Market Adjustments</p>
                            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
                                {formatCurrency(totalAdjustments)}
                            </h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white mb-4">
                                <Target size={20} />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Gross Profit</p>
                            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
                                {formatCurrency(totalGrossProfit)}
                            </h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                                <BarChart3 size={20} />
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Transaction Count</p>
                            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
                                {filteredData.length}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Margin Performance Trend</h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Profitability analysis over time</p>
                            </div>
                            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                Snapshot Data
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
                                        tickFormatter={(val) => `${currency}${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                    />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                        formatter={(val: number) => [formatCurrency(val), '']}
                                    />
                                    <Area type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                                    <Area type="monotone" dataKey="netMargin" name="Net Margin" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Adjustment Distribution</h3>
                                <p className="text-slate-400 text-sm font-medium mt-1">Impact of various cost adjustments</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400" title="Chart details">
                                <Info size={16} />
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
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
                                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                        formatter={(val: number) => [formatCurrency(val), 'Amount']}
                                    />
                                    <Bar dataKey="totalAmount" radius={[0, 8, 8, 0]} barSize={24}>
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
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Activity size={18} />
                            </div>
                            <h3 className="font-black text-slate-800 text-[14px] tracking-widest uppercase">Adjustment Performance Matrix</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13px]">
                                <thead>
                                    <tr className="text-slate-400 font-black text-[10px] tracking-widest border-b border-slate-100">
                                        <th className="px-6 py-4">ADJUSTMENT NAME</th>
                                        <th className="px-6 py-4 text-right">TOTAL IMPACT</th>
                                        <th className="px-6 py-4 text-right">VOLUME</th>
                                        <th className="px-6 py-4 text-right">ITEMS AFFECTED</th>
                                        <th className="px-6 py-4 text-right">MEAN PER TRANS.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {adjustmentStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                    <span className="font-bold text-slate-800">{stat.adjustmentName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-blue-600 font-black text-[14px]">{formatCurrency(stat.totalAmount)}</td>
                                            <td className="px-6 py-5 text-right font-bold text-slate-600">
                                                <span className="bg-slate-100 px-3 py-1 rounded-full">{stat.transactionCount}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right font-medium text-slate-500">{stat.itemCount} units</td>
                                            <td className="px-6 py-5 text-right font-mono text-slate-500 font-bold">{formatCurrency(stat.avgPerTransaction)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Detail Table */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-lg">
                                <Receipt size={18} />
                            </div>
                            <h3 className="font-black text-slate-800 text-[14px] tracking-widest uppercase">Margin Audit Ledger</h3>
                        </div>
                        <p className="text-slate-400 text-[11px] font-bold">Showing {filteredData.length} entries</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead>
                                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-4">TRANSACTION</th>
                                    <th className="px-6 py-4">CUSTOMER</th>
                                    <th className="px-6 py-4 text-right">BASE COST</th>
                                    <th className="px-6 py-4 text-right">ADJUSTMENTS</th>
                                    <th className="px-6 py-4 text-right">NET MARGIN</th>
                                    <th className="px-6 py-4 text-right">PRICE</th>
                                    <th className="px-6 py-4 text-right">GROSS MARGIN</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredData.slice().reverse().map(d => (
                                    <React.Fragment key={d.saleId}>
                                        <tr className="hover:bg-slate-50/80 transition-all group">
                                            <td className="px-6 py-5">
                                                <div className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{d.saleId}</div>
                                                <div className="text-[10px] text-slate-400 font-black tracking-wider mt-0.5">{format(new Date(d.date), 'MMM dd, HH:mm')}</div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-slate-600">{d.customerName}</div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-slate-500 font-medium">{formatCurrency(d.totalCost)}</td>
                                            <td className="px-6 py-5 text-right font-mono text-slate-600 font-bold">{formatCurrency(d.totalAdjustments)}</td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="font-black text-emerald-600">{formatCurrency(d.netMarginPerSale)}</div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-slate-900 bg-slate-50/30">{formatCurrency(d.finalPrice)}</td>
                                            <td className="px-6 py-5 text-right">
                                                <div className={`font-black text-[14px] ${d.marginPercent >= 20 ? 'text-emerald-600' : d.marginPercent >= 10 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    {formatCurrency(d.grossMargin)}
                                                </div>
                                                <div className="text-[10px] font-black text-slate-400">{d.marginPercent.toFixed(1)}%</div>
                                            </td>
                                        </tr>
                                        {/* Adjustment breakdown row with better styling */}
                                        {d.adjustmentBreakdown && d.adjustmentBreakdown.length > 0 && (
                                            <tr key={`${d.saleId}-breakdown`} className="bg-slate-50/30">
                                                <td colSpan={7} className="px-8 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-1 h-8 bg-slate-200 rounded-full" />
                                                        <div className="flex flex-wrap gap-2">
                                                            {d.adjustmentBreakdown.map((adj, idx) => (
                                                                <div key={idx} className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 group/adj transition-all hover:border-blue-200">
                                                                    <div className="text-[10px] font-black text-slate-400 group-hover/adj:text-blue-500 transition-colors uppercase tracking-widest">{adj.name || adj.type}:</div>
                                                                    <div className="text-[12px] font-black text-slate-700 font-mono">{formatCurrency(adj.amount || adj.totalAmount)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
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
