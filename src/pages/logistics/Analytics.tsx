import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { Order, Area } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { startOfWeek, startOfMonth, format, subWeeks, subMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area as RechartsArea
} from 'recharts';
import { TrendingUp, Package, PoundSterling, Hash, Calendar, Filter, BarChart3, ShoppingBag, ArrowUpRight, Layers } from 'lucide-react';

type TimeGranularity = 'weekly' | 'monthly';
type TimeRange = '4weeks' | '12weeks' | '6months' | 'all';

export default function Analytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [areasMap, setAreasMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters State
  const [granularity, setGranularity] = useState<TimeGranularity>('weekly');
  const [timeRange, setTimeRange] = useState<TimeRange>('12weeks');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'items' | 'areas' | 'volume'>('items');
  const [itemSortBy, setItemSortBy] = useState<'value' | 'quantity'>('value');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [areas, fetchedOrders] = await Promise.all([
          api.getAreas(),
          api.getOrders()
        ]);

        const aMap: Record<string, string> = {};
        areas.forEach(area => {
          aMap[area.id] = area.name;
        });
        setAreasMap(aMap);
        setOrders(fetchedOrders);
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter orders by time range and area
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date | null = null;

    if (timeRange === '4weeks') cutoffDate = subWeeks(now, 4);
    else if (timeRange === '12weeks') cutoffDate = subWeeks(now, 12);
    else if (timeRange === '6months') cutoffDate = subMonths(now, 6);

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const matchesTime = !cutoffDate || orderDate >= cutoffDate;
      const matchesArea = selectedAreaId === 'all' || order.areaId === selectedAreaId;
      return matchesTime && matchesArea;
    });
  }, [orders, timeRange, selectedAreaId]);

  // Aggregate Key Executive Metrics
  const metrics = useMemo(() => {
    let totalSpend = 0;
    let totalItemsCount = 0;
    const areaSpendMap: Record<string, number> = {};

    filteredOrders.forEach(o => {
      totalSpend += o.totalCost || 0;
      (o.items || []).forEach(item => {
        totalItemsCount += item.quantity || 0;
      });
      const areaName = areasMap[o.areaId] || 'Unknown Area';
      areaSpendMap[areaName] = (areaSpendMap[areaName] || 0) + (o.totalCost || 0);
    });

    let topAreaName = '-';
    let topAreaSpend = 0;
    Object.entries(areaSpendMap).forEach(([name, spend]) => {
      if (spend > topAreaSpend) {
        topAreaSpend = spend;
        topAreaName = name;
      }
    });

    const avgOrderValue = filteredOrders.length > 0 ? totalSpend / filteredOrders.length : 0;

    return {
      totalSpend,
      totalOrders: filteredOrders.length,
      totalItemsCount,
      avgOrderValue,
      topAreaName,
      topAreaSpend
    };
  }, [filteredOrders, areasMap]);

  // Aggregate Chart Time Series Data (Weekly or Monthly)
  const timeSeriesChartData = useMemo(() => {
    const periodSpendMap: Record<string, Record<string, number>> = {};
    const periodOrdersMap: Record<string, number> = {};

    filteredOrders.forEach(order => {
      const date = new Date(order.createdAt);
      const periodKey = granularity === 'weekly'
        ? `W/C ${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd MMM')}`
        : format(startOfMonth(date), 'MMM yyyy');

      const areaName = areasMap[order.areaId] || 'Unknown Area';

      if (!periodSpendMap[periodKey]) periodSpendMap[periodKey] = {};
      periodSpendMap[periodKey][areaName] = (periodSpendMap[periodKey][areaName] || 0) + (order.totalCost || 0);

      periodOrdersMap[periodKey] = (periodOrdersMap[periodKey] || 0) + 1;
    });

    const spendChartData = Object.keys(periodSpendMap).map(period => {
      const row: any = { period, totalOrders: periodOrdersMap[period] || 0 };
      let periodTotal = 0;
      Object.keys(periodSpendMap[period]).forEach(area => {
        const val = Math.round(periodSpendMap[period][area] * 100) / 100;
        row[area] = val;
        periodTotal += val;
      });
      row.totalSpend = Math.round(periodTotal * 100) / 100;
      return row;
    });

    return spendChartData;
  }, [filteredOrders, granularity, areasMap]);

  // Unique areas for chart series colors
  const activeAreaNames = useMemo(() => {
    const set = new Set<string>();
    filteredOrders.forEach(o => {
      set.add(areasMap[o.areaId] || 'Unknown Area');
    });
    return Array.from(set);
  }, [filteredOrders, areasMap]);

  const colorPalette = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  // Aggregate Item Level Performance
  const itemAnalytics = useMemo(() => {
    const stats: Record<string, { name: string; quantity: number; value: number; ordersCount: number }> = {};

    filteredOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!stats[item.productId]) {
          stats[item.productId] = { name: item.name, quantity: 0, value: 0, ordersCount: 0 };
        }
        stats[item.productId].quantity += item.quantity || 0;
        stats[item.productId].value += (item.quantity || 0) * (item.unitCost || 0);
        stats[item.productId].ordersCount += 1;
      });
    });

    const list = Object.values(stats);
    list.sort((a, b) => (itemSortBy === 'value' ? b.value - a.value : b.quantity - a.quantity));
    return list.slice(0, 15);
  }, [filteredOrders, itemSortBy]);

  // Area-by-Area Breakdown
  const areaBreakdown = useMemo(() => {
    const stats: Record<string, { name: string; spend: number; ordersCount: number; topItemName: string; topItemQty: number }> = {};

    filteredOrders.forEach(order => {
      const areaName = areasMap[order.areaId] || 'Unknown Area';
      if (!stats[order.areaId]) {
        stats[order.areaId] = { name: areaName, spend: 0, ordersCount: 0, topItemName: '-', topItemQty: 0 };
      }
      stats[order.areaId].spend += order.totalCost || 0;
      stats[order.areaId].ordersCount += 1;
    });

    // Find top item per area
    Object.keys(stats).forEach(areaId => {
      const itemQtyMap: Record<string, number> = {};
      filteredOrders.filter(o => o.areaId === areaId).forEach(o => {
        (o.items || []).forEach(item => {
          itemQtyMap[item.name] = (itemQtyMap[item.name] || 0) + item.quantity;
        });
      });

      let topName = '-';
      let topQty = 0;
      Object.entries(itemQtyMap).forEach(([name, qty]) => {
        if (qty > topQty) {
          topQty = qty;
          topName = name;
        }
      });
      stats[areaId].topItemName = topName;
      stats[areaId].topItemQty = topQty;
    });

    return Object.values(stats).sort((a, b) => b.spend - a.spend);
  }, [filteredOrders, areasMap]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="text-slate-500 text-sm font-medium">Loading Analytics Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Analytics & Insights</h1>
          <p className="text-slate-500 text-sm mt-1">Track consumable spending trends, order velocity, and cost allocation.</p>
        </div>

        {/* Global Controls & Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          {/* View Granularity Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setGranularity('weekly')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                granularity === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                granularity === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Time Horizon Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400 ml-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="h-8 text-xs font-semibold bg-white border border-slate-200 rounded-md px-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="4weeks">Last 4 Weeks</option>
              <option value="12weeks">Last 12 Weeks</option>
              <option value="6months">Last 6 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Area Filter */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="h-8 text-xs font-semibold bg-white border border-slate-200 rounded-md px-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Production Areas</option>
              {Object.entries(areasMap).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Spend</span>
              <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <PoundSterling className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900">
                £{metrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Avg £{metrics.avgOrderValue.toFixed(2)} per order
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Orders Fulfilled</span>
              <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900">{metrics.totalOrders}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {metrics.totalItemsCount.toLocaleString()} total units ordered
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Spend Area</span>
              <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-extrabold text-slate-900 truncate" title={metrics.topAreaName}>
                {metrics.topAreaName}
              </h3>
              <p className="text-xs text-indigo-600 font-bold mt-1">
                £{metrics.topAreaSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Time Horizon</span>
              <div className="h-9 w-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-bold text-slate-900 capitalize">
                {granularity} View
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {timeSeriesChartData.length} data periods analyzed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Spend Trend Dashboard Chart */}
      <Card className="border-slate-200 shadow-md bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Consumable Spend Trend ({granularity === 'weekly' ? 'Weekly' : 'Monthly'})
            </CardTitle>
            <p className="text-xs text-slate-500">Monetary spend stacked by production area over time.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Stacked Area Breakdown</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {timeSeriesChartData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400">
              <Package className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium">No order data found for selected timeframe.</p>
            </div>
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeriesChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `£${val}`}
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: any) => [`£${Number(value).toFixed(2)}`, 'Spend']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                  {activeAreaNames.map((areaName, index) => (
                    <Bar
                      key={areaName}
                      dataKey={areaName}
                      stackId="spend"
                      fill={colorPalette[index % colorPalette.length]}
                      radius={index === activeAreaNames.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={48}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Detailed Analysis Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('items')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${
                activeTab === 'items'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Top Ordered Items
            </button>
            <button
              onClick={() => setActiveTab('areas')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${
                activeTab === 'areas'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Area Cost Breakdown
            </button>
          </div>

          {activeTab === 'items' && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-lg">
              <span className="text-slate-500 font-semibold px-2">Sort by:</span>
              <button
                onClick={() => setItemSortBy('value')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  itemSortBy === 'value' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Spend (£)
              </button>
              <button
                onClick={() => setItemSortBy('quantity')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  itemSortBy === 'quantity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Quantity
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Top Consumable Items Table */}
        {activeTab === 'items' && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 w-16 text-center">Rank</th>
                      <th className="px-5 py-3">Consumable Product</th>
                      <th className="px-5 py-3 text-right">Orders Included</th>
                      <th className="px-5 py-3 text-right">Units Ordered</th>
                      <th className="px-5 py-3 text-right">Total Spend (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {itemAnalytics.map((item, idx) => {
                      const maxVal = itemAnalytics[0]?.value || 1;
                      const maxQty = Math.max(...itemAnalytics.map(i => i.quantity), 1);
                      const relativePct = itemSortBy === 'value'
                        ? (item.value / maxVal) * 100
                        : (item.quantity / maxQty) * 100;

                      return (
                        <tr key={item.name} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 text-center font-bold text-slate-400 text-xs">
                            <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${
                              idx === 0 ? 'bg-amber-100 text-amber-800 font-extrabold' :
                              idx === 1 ? 'bg-slate-200 text-slate-700 font-bold' :
                              idx === 2 ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-900 block">{item.name}</span>
                              <div className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(5, relativePct))}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-600 text-xs">
                            {item.ordersCount} orders
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                            {item.quantity.toLocaleString()} units
                          </td>
                          <td className="px-5 py-3.5 text-right font-extrabold text-slate-900">
                            £{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                    {itemAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-medium">
                          No product order statistics recorded for this timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Area Cost Breakdown Grid */}
        {activeTab === 'areas' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {areaBreakdown.map((area) => {
              const areaPct = metrics.totalSpend > 0 ? (area.spend / metrics.totalSpend) * 100 : 0;
              return (
                <Card key={area.name} className="border-slate-200 shadow-sm hover:border-slate-300 transition-all">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">{area.name}</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">{area.ordersCount} total orders placed</p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                        {areaPct.toFixed(1)}% of total
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Area Spend</span>
                      <span className="text-2xl font-black text-slate-900">
                        £{area.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-1">
                      <span className="text-xs font-semibold text-slate-500">Most Consumed Product:</span>
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[160px]" title={area.topItemName}>
                          {area.topItemName}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {area.topItemQty} units
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {areaBreakdown.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl">
                No area breakdown data available.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
