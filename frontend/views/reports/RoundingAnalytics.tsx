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
  Activity, Coins, Target, BarChart3, 
  AlertCircle, CheckCircle2, HelpCircle, History, TrendingUp
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
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Analyzing Rounding DNA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 tablet-auto-fit-250 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Realized Profit (Today)</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">
                {formatValue(dashboard?.rounding_profit_today || 0)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Coins size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Profit (This Month)</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
                {formatValue(dashboard?.rounding_profit_this_month || 0)}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Avg Gain per Unit</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1 tabular-nums">
                {formatValue(dashboard?.avg_rounding_gain_per_unit || 0)}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <Target size={24} className="text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Impact Percentage</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1 tabular-nums">
                {(summary?.rounding_profit_percentage || 0).toFixed(2)}%
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Activity size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 tablet-auto-fit-280 tablet-auto-fit-reset gap-6">
        {/* Profit Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-500" />
            Realized vs Potential Profit
          </h3>
          <div style={{ width: '100%', height: 256, minHeight: 150 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
              <AreaChart data={dailyRows}>
                <defs>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPotential" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currency}${v}`} />
                <Tooltip 
                  formatter={(val: number) => [formatValue(val), '']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="realized_profit" name="Realized Profit" stroke="#10b981" strokeWidth={2} fill="url(#colorRealized)" />
                <Area type="monotone" dataKey="potential_profit" name="Potential Profit" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorPotential)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Method Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
            <Target size={18} className="text-blue-500" />
            Method Yield
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
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
                  formatter={(val: number) => formatValue(val)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {methodRows.map((method, idx) => (
              <div key={method.method} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-semibold text-slate-700 text-sm">{method.method}</span>
                </div>
                <span className="font-bold text-slate-900 tabular-nums text-sm">{formatValue(method.realized_profit)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projection & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-200 tracking-widest uppercase">30-Day Projection</p>
              <h3 className="text-2xl font-black mt-1 tabular-nums">{formatValue(projection?.projected_realized_profit || 0)}</h3>
              <p className="text-[11px] text-blue-200 mt-1 font-medium">
                Based on {projection?.lookback_days} days of performance
              </p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
            <HelpCircle size={18} className="text-blue-500" />
            Smart Rounding Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <div 
                key={insight.id} 
                className={`p-4 rounded-xl border ${
                  insight.severity === 'warning' 
                    ? 'bg-rose-50 border-rose-100' 
                    : insight.severity === 'success'
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-blue-50 border-blue-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${
                    insight.severity === 'warning' ? 'text-rose-500' : insight.severity === 'success' ? 'text-emerald-500' : 'text-blue-500'
                  }`}>
                    {insight.severity === 'warning' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{insight.title}</h4>
                    <p className={`text-xs leading-relaxed ${
                      insight.severity === 'warning' ? 'text-rose-700' : insight.severity === 'success' ? 'text-emerald-700' : 'text-blue-700'
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-500" />
            Product Rounding Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Product / Variant</th>
                  <th className="px-4 py-3 text-right">Unit Rounding Diff</th>
                  <th className="px-4 py-3 text-right">Volume Sold</th>
                  <th className="px-4 py-3 text-right">Method</th>
                  <th className="px-4 py-3 text-right">Total Realized Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {productRows.map((row) => (
                  <tr key={buildHistoryKey(row.product_id, row.variant_id)} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700">{row.product_name}</div>
                      {row.variant_id && <div className="text-[10px] text-slate-400 uppercase">{row.variant_id}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatValue(row.rounded_diff_per_unit)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-slate-100 px-2 py-1 rounded font-semibold text-slate-600 text-xs">{row.qty_sold.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">{row.rounding_method}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{formatValue(row.realized_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2">
              <History size={18} className="text-blue-500" />
              Price Revision History
            </h3>
            <select
              value={selectedHistoryKey}
              onChange={(event) => setSelectedHistoryKey(event.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-500"
            >
              {historyOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Revision Date</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3 text-right">Historical Price</th>
                  <th className="px-4 py-3 text-right">Revised Price</th>
                  <th className="px-4 py-3 text-right">Rounding Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {priceHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700">{format(new Date(entry.date), 'MMM dd, yyyy')}</div>
                      <div className="text-[10px] text-slate-400">{format(new Date(entry.date), 'HH:mm')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold text-xs">v{entry.version}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {entry.previous_rounded_price === null ? <span className="text-[10px] italic">ORIGIN</span> : formatValue(entry.previous_rounded_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatValue(entry.rounded_price)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={`font-bold ${entry.rounding_difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
