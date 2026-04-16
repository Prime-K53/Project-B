import React, { useEffect, useMemo, useState } from 'react';
import {
  getProductPriceHistory,
  getRoundingDashboardData,
  getRoundingMethodPerformance,
  getRoundingPeriodReport,
  getRoundingProductPerformance,
  getRoundingProfitProjection,
  getRoundingProfitSummary,
  getRoundingSmartInsights,
  getTopProductsByRoundingProfit
} from '../../services/roundingAnalyticsService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Cell, PieChart, Pie, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, Coins, Target, ArrowUpRight, ArrowDownRight, 
  Info, Activity, PieChart as PieChartIcon, BarChart3, 
  AlertCircle, CheckCircle2, HelpCircle, History
} from 'lucide-react';
import { format } from 'date-fns';
import {
  RoundingDashboardData,
  RoundingInsight,
  RoundingMethodPerformanceRow,
  RoundingPeriodReportRow,
  RoundingPriceHistoryEntry,
  RoundingProductPerformanceRow,
  RoundingProfitProjection,
  RoundingProfitSummary,
  RoundingTopProductRow
} from '../../types';
import { useData } from '../../context/DataContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const buildHistoryKey = (productId: string, variantId?: string) => `${productId}::${variantId || ''}`;

const parseHistoryKey = (value: string): { productId: string; variantId?: string } => {
  const [productId, variantId] = value.split('::');
  return {
    productId,
    variantId: variantId || undefined
  };
};

const RoundingAnalytics: React.FC = () => {
  const { companyConfig } = useData();
  const currency = companyConfig?.currencySymbol || '$';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RoundingProfitSummary | null>(null);
  const [dashboard, setDashboard] = useState<RoundingDashboardData | null>(null);
  const [productRows, setProductRows] = useState<RoundingProductPerformanceRow[]>([]);
  const [dailyRows, setDailyRows] = useState<RoundingPeriodReportRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<RoundingPeriodReportRow[]>([]);
  const [methodRows, setMethodRows] = useState<RoundingMethodPerformanceRow[]>([]);
  const [topProducts, setTopProducts] = useState<RoundingTopProductRow[]>([]);
  const [projection, setProjection] = useState<RoundingProfitProjection | null>(null);
  const [insights, setInsights] = useState<RoundingInsight[]>([]);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<RoundingPriceHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [
          summaryData,
          dashboardData,
          productPerformance,
          dailyReport,
          monthlyReport,
          methodPerformance,
          topProductRows,
          projectionData,
          insightsData
        ] = await Promise.all([
          getRoundingProfitSummary(),
          getRoundingDashboardData(),
          getRoundingProductPerformance(),
          getRoundingPeriodReport('day'),
          getRoundingPeriodReport('month'),
          getRoundingMethodPerformance(),
          getTopProductsByRoundingProfit(10),
          getRoundingProfitProjection(30, 30),
          getRoundingSmartInsights()
        ]);

        if (!active) return;
        setSummary(summaryData);
        setDashboard(dashboardData);
        setProductRows(productPerformance);
        setDailyRows(dailyReport.slice(-30));
        setMonthlyRows(monthlyReport.slice(-12));
        setMethodRows(methodPerformance);
        setTopProducts(topProductRows);
        setProjection(projectionData);
        setInsights(insightsData);

        if (!selectedHistoryKey && productPerformance.length > 0) {
          const first = productPerformance[0];
          setSelectedHistoryKey(buildHistoryKey(first.product_id, first.variant_id));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedHistoryKey) {
      setPriceHistory([]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      const selected = parseHistoryKey(selectedHistoryKey);
      const history = await getProductPriceHistory(selected.productId, selected.variantId);
      if (!active) return;
      setPriceHistory(history);
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [selectedHistoryKey]);

  const historyOptions = useMemo(() => {
    return productRows.map((row) => ({
      key: buildHistoryKey(row.product_id, row.variant_id),
      label: row.variant_id
        ? `${row.product_name} (${row.variant_id})`
        : row.product_name
    }));
  }, [productRows]);

  const formatValue = (val: number) => {
    return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Analyzing Rounding DNA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
              <Coins size={20} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Realized Profit (Today)</p>
            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
              {formatValue(dashboard?.rounding_profit_today || 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
              <TrendingUp size={20} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Profit (This Month)</p>
            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
              {formatValue(dashboard?.rounding_profit_this_month || 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-4">
              <Target size={20} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Avg Gain per Unit</p>
            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
              {formatValue(dashboard?.avg_rounding_gain_per_unit || 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
              <Activity size={20} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Impact Percentage</p>
            <h3 className="text-3xl font-black text-slate-900 leading-none mt-1">
              {(summary?.rounding_profit_percentage || 0).toFixed(2)}%
            </h3>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Trend Chart */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Realized vs Potential Profit</h3>
              <p className="text-slate-400 text-sm font-medium mt-1">Daily rounding performance trend</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRows}>
                <defs>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPotential" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="period" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}}
                  tickFormatter={(val) => `${currency}${val}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                  formatter={(val: number) => [formatValue(val), '']}
                />
                <Area type="monotone" dataKey="realized_profit" name="Realized Profit" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRealized)" />
                <Area type="monotone" dataKey="potential_profit" name="Potential Profit" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPotential)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Method Distribution & Top Products */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800 tracking-tight mb-2">Method Yield</h3>
              <p className="text-slate-400 text-xs font-medium mb-6">Profit by rounding algorithm</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodRows}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="realized_profit"
                      nameKey="method"
                    >
                      {methodRows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px'}}
                      formatter={(val: number) => formatValue(val)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profit Breakdown</h4>
              {methodRows.map((method, idx) => (
                <div key={method.method} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[12px] font-bold text-slate-700">{method.method}</span>
                  </div>
                  <span className="text-[12px] font-black text-slate-900">{formatValue(method.realized_profit)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 tracking-tight mb-6">Top Rounding Drivers</h3>
            <div className="space-y-4">
              {topProducts.slice(0, 3).map((product, idx) => (
                <div key={idx} className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[13px] font-bold text-slate-700">{product.product_name}</span>
                    <span className="text-[13px] font-black text-blue-600">{formatValue(product.realized_profit)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${(product.realized_profit / (topProducts[0]?.realized_profit || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projection & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
             <TrendingUp size={160} />
          </div>
          <h3 className="text-xl font-bold mb-2">30-Day Projection</h3>
          <p className="text-slate-400 text-sm mb-8">Based on last {projection?.lookback_days} days of performance</p>
          
          <div className="space-y-6 relative z-10">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Velocity</p>
              <p className="text-2xl font-black">{formatValue(projection?.average_daily_realized_profit || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Projected {projection?.projected_days}d Gain</p>
              <p className="text-4xl font-black text-emerald-400 tracking-tight">{formatValue(projection?.projected_realized_profit || 0)}</p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
              <ArrowUpRight size={14} />
              Positive outlook based on volume
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <HelpCircle size={18} />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Smart Rounding Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <div 
                key={insight.id} 
                className={`p-5 rounded-3xl border ${
                  insight.severity === 'warning' 
                    ? 'bg-rose-50 border-rose-100 text-rose-900' 
                    : insight.severity === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                    : 'bg-blue-50 border-blue-100 text-blue-900'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 ${
                    insight.severity === 'warning' ? 'text-rose-500' : insight.severity === 'success' ? 'text-emerald-500' : 'text-blue-500'
                  }`}>
                    {insight.severity === 'warning' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <div>
                    <h4 className="font-black text-[14px] leading-tight mb-1">{insight.title}</h4>
                    <p className={`text-[12px] font-medium leading-relaxed ${
                      insight.severity === 'warning' ? 'text-rose-700/80' : insight.severity === 'success' ? 'text-emerald-700/80' : 'text-blue-700/80'
                    }`}>
                      {insight.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 text-white rounded-lg">
                <BarChart3 size={18} />
              </div>
              <h3 className="font-black text-slate-800 text-[14px] tracking-widest uppercase">Product Rounding Matrix</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">PRODUCT / VARIANT</th>
                  <th className="px-6 py-4 text-right">UNIT ROUNDING DIFF</th>
                  <th className="px-6 py-4 text-right">VOLUME SOLD</th>
                  <th className="px-6 py-4 text-right">METHOD</th>
                  <th className="px-6 py-4 text-right uppercase">Total Realized Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productRows.map((row) => (
                  <tr key={buildHistoryKey(row.product_id, row.variant_id)} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{row.product_name}</div>
                      {row.variant_id && <div className="text-[10px] text-slate-400 font-black tracking-wider uppercase mt-0.5">{row.variant_id}</div>}
                    </td>
                    <td className="px-6 py-5 text-right font-mono text-slate-500 font-medium">{formatValue(row.rounded_diff_per_unit)}</td>
                    <td className="px-6 py-5 text-right">
                      <span className="bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-600">{row.qty_sold.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{row.rounding_method}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="font-black text-[14px] text-slate-900">{formatValue(row.realized_profit)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 text-white rounded-lg">
                <History size={18} />
              </div>
              <h3 className="font-black text-slate-800 text-[14px] tracking-widest uppercase">Price Revision History</h3>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Product:</span>
              <select
                value={selectedHistoryKey}
                onChange={(event) => setSelectedHistoryKey(event.target.value)}
                className="bg-transparent border-none text-[12px] font-bold text-slate-700 outline-none cursor-pointer"
              >
                {historyOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4 uppercase">Revision Date</th>
                  <th className="px-6 py-4 uppercase">Version</th>
                  <th className="px-6 py-4 text-right uppercase">Historical Price</th>
                  <th className="px-6 py-4 text-right uppercase">Revised Price</th>
                  <th className="px-6 py-4 text-right uppercase">Rounding Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {priceHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-800">{format(new Date(entry.date), 'MMM dd, yyyy')}</div>
                      <div className="text-[10px] text-slate-400 font-black tracking-widest">{format(new Date(entry.date), 'HH:mm')}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black text-[10px]">v{entry.version}</span>
                    </td>
                    <td className="px-6 py-5 text-right font-mono text-slate-400">
                      {entry.previous_rounded_price === null ? <span className="text-[10px] font-black italic">ORIGIN</span> : formatValue(entry.previous_rounded_price)}
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-800">{formatValue(entry.rounded_price)}</td>
                    <td className="px-6 py-5 text-right font-mono">
                      <span className={`font-black ${entry.rounding_difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {entry.rounding_difference > 0 ? '+' : ''}{formatValue(entry.rounding_difference)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundingAnalytics;
