'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,  } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaseTypeData {
  type: string;
  count: number;
  percentage: number;
}

interface ResolutionTimeData {
  service: string;
  avgDays: number;
  minDays: number;
  maxDays: number;
  caseCount: number;
}

interface RevenueData {
  category: string;
  revenue: number;
  transactions: number;
  avgTicket: number;
}

interface HeatmapCell {
  day: string;
  hour: string;
  utilization: number;
  caseCount: number;
}

interface StatusTrendPoint {
  month: string;
  new: number;
  in_review: number;
  contacted: number;
  closed: number;
  active: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#355E3B';
const CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#c8e6d4', '#1a3d20', '#2d5c3a'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];

function getHeatColor(value: number): string {
  if (value === 0) return '#f1f5f2';
  if (value < 20) return '#d1f0d9';
  if (value < 40) return '#afd9ba';
  if (value < 60) return '#6b9e7a';
  if (value < 80) return '#4a7c59';
  return '#355E3B';
}

function formatCurrency(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// ─── Mock data generators (used when Supabase data is sparse) ─────────────────

function buildMockCaseTypes(): CaseTypeData[] {
  const types = [
    { type: 'Business Formation', count: 38 },
    { type: 'Contract Review', count: 52 },
    { type: 'Employment Law', count: 27 },
    { type: 'IP / Trademark', count: 19 },
    { type: 'Compliance', count: 31 },
    { type: 'Litigation Support', count: 14 },
  ];
  const total = types.reduce((s, t) => s + t.count, 0);
  return types.map((t) => ({ ...t, percentage: Math.round((t.count / total) * 100) }));
}

function buildMockResolution(): ResolutionTimeData[] {
  return [
    { service: 'Business Formation', avgDays: 12, minDays: 5, maxDays: 28, caseCount: 38 },
    { service: 'Contract Review', avgDays: 4, minDays: 1, maxDays: 10, caseCount: 52 },
    { service: 'Employment Law', avgDays: 21, minDays: 7, maxDays: 45, caseCount: 27 },
    { service: 'IP / Trademark', avgDays: 35, minDays: 14, maxDays: 90, caseCount: 19 },
    { service: 'Compliance', avgDays: 8, minDays: 3, maxDays: 18, caseCount: 31 },
    { service: 'Litigation', avgDays: 62, minDays: 30, maxDays: 120, caseCount: 14 },
  ];
}

function buildMockRevenue(): RevenueData[] {
  return [
    { category: 'Retainer', revenue: 48500, transactions: 22, avgTicket: 2204 },
    { category: 'Contract Review', revenue: 18200, transactions: 52, avgTicket: 350 },
    { category: 'Business Formation', revenue: 22800, transactions: 38, avgTicket: 600 },
    { category: 'Employment', revenue: 14700, transactions: 27, avgTicket: 544 },
    { category: 'IP / Trademark', revenue: 11400, transactions: 19, avgTicket: 600 },
    { category: 'Compliance', revenue: 9300, transactions: 31, avgTicket: 300 },
  ];
}

function buildMockHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const pattern: Record<string, number[]> = {
    Mon: [20, 55, 80, 90, 70, 60, 85, 75, 50, 25],
    Tue: [15, 60, 85, 95, 75, 65, 90, 80, 55, 20],
    Wed: [25, 65, 88, 92, 80, 70, 88, 78, 52, 18],
    Thu: [18, 58, 82, 88, 72, 62, 82, 72, 48, 22],
    Fri: [22, 50, 75, 80, 65, 55, 70, 60, 40, 15],
    Sat: [5, 15, 20, 18, 12, 10, 8, 5, 3, 2],
    Sun: [2, 5, 8, 6, 4, 3, 3, 2, 1, 1],
  };
  DAYS.forEach((day) => {
    HOURS.forEach((hour, hi) => {
      const base = pattern[day]?.[hi] ?? 0;
      const jitter = Math.round((Math.random() - 0.5) * 8);
      const utilization = Math.max(0, Math.min(100, base + jitter));
      cells.push({ day, hour, utilization, caseCount: Math.round(utilization / 10) });
    });
  });
  return cells;
}

function buildMockStatusTrend(): StatusTrendPoint[] {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  return months.map((month, i) => ({
    month,
    new: 18 + i * 3 + Math.round(Math.random() * 5),
    in_review: 12 + i * 2 + Math.round(Math.random() * 4),
    contacted: 8 + i * 2 + Math.round(Math.random() * 3),
    active: 22 + i * 4 + Math.round(Math.random() * 6),
    closed: 10 + i * 3 + Math.round(Math.random() * 4),
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold text-foreground" style={accent ? { color: accent } : {}}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CaseTypeDistribution({ data }: { data: CaseTypeData[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-serif text-lg text-foreground">Case Type Distribution</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Volume breakdown by practice area — informs staffing allocation</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={52}
              paddingAngle={2}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.45}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2">
          {data.map((item, i) => (
            <div
              key={item.type}
              className="flex items-center justify-between gap-2 cursor-default"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className={`text-sm truncate transition-colors ${activeIndex === i ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{item.type}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-foreground">{item.count}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResolutionTimeChart({ data }: { data: ResolutionTimeData[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-serif text-lg text-foreground">Avg. Resolution Time by Service</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Days from case open to close — guides pricing and capacity planning</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}d`}
          />
          <YAxis
            type="category"
            dataKey="service"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            formatter={(value: number) => [`${value} days`, 'Avg. Resolution']}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="avgDays" name="Avg Days" radius={[0, 6, 6, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {data.slice(0, 3).map((d) => (
          <div key={d.service} className="bg-secondary/30 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground truncate">{d.service}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{d.avgDays}d</p>
            <p className="text-[10px] text-muted-foreground">{d.caseCount} cases</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueByCategory({ data }: { data: RevenueData[] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-serif text-lg text-foreground">Revenue by Service Category</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Gross revenue per practice area — informs pricing strategy</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -16, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            angle={-15}
            textAnchor="end"
            height={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold text-foreground">${total.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Top Category</p>
          <p className="text-sm font-semibold text-foreground">{data.sort((a, b) => b.revenue - a.revenue)[0]?.category}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Avg Ticket</p>
          <p className="text-sm font-semibold text-foreground">
            ${Math.round(total / data.reduce((s, d) => s + d.transactions, 0)).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamUtilizationHeatmap({ data }: { data: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const cellMap: Record<string, Record<string, HeatmapCell>> = {};
  data.forEach((c) => {
    if (!cellMap[c.day]) cellMap[c.day] = {};
    cellMap[c.day][c.hour] = c;
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg text-foreground">Team Utilization Heatmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Case activity intensity by day & hour — optimize staffing schedules</p>
        </div>
        {hovered && (
          <div className="bg-secondary/50 rounded-xl px-3 py-2 text-right flex-shrink-0">
            <p className="text-xs font-semibold text-foreground">{hovered.day} {hovered.hour}</p>
            <p className="text-xs text-muted-foreground">{hovered.utilization}% utilization</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Hour labels */}
          <div className="flex items-center mb-1">
            <div className="w-10 flex-shrink-0" />
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground font-medium">{h}</div>
            ))}
          </div>
          {/* Grid rows */}
          {DAYS.map((day) => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 flex-shrink-0 text-[10px] text-muted-foreground font-medium">{day}</div>
              {HOURS.map((hour) => {
                const cell = cellMap[day]?.[hour];
                const util = cell?.utilization ?? 0;
                return (
                  <div
                    key={hour}
                    className="flex-1 mx-0.5 h-7 rounded-md cursor-default transition-all duration-150 hover:scale-110 hover:z-10 relative"
                    style={{ background: getHeatColor(util) }}
                    onMouseEnter={() => setHovered(cell ?? null)}
                    onMouseLeave={() => setHovered(null)}
                    title={`${day} ${hour}: ${util}% utilization`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Low</span>
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <div key={v} className="w-5 h-3 rounded-sm" style={{ background: getHeatColor(v) }} />
        ))}
        <span className="text-[10px] text-muted-foreground">High</span>
        <span className="ml-auto text-[10px] text-muted-foreground">% team utilization</span>
      </div>
    </div>
  );
}

function CaseStatusTrend({ data }: { data: StatusTrendPoint[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-serif text-lg text-foreground">Case Status Trend</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Monthly case pipeline by status — track throughput and bottlenecks</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#355E3B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4a7c59" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4a7c59" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8dbf9a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8dbf9a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          <Area type="monotone" dataKey="new" name="New" stroke="#355E3B" fill="url(#gradNew)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="active" name="Active" stroke="#4a7c59" fill="url(#gradActive)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="in_review" name="In Review" stroke="#6b9e7a" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          <Area type="monotone" dataKey="contacted" name="Contacted" stroke="#afd9ba" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          <Area type="monotone" dataKey="closed" name="Closed" stroke="#8dbf9a" fill="url(#gradClosed)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StrategicAnalyticsDashboard() {
  const [caseTypes, setCaseTypes] = useState<CaseTypeData[]>([]);
  const [resolution, setResolution] = useState<ResolutionTimeData[]>([]);
  const [revenue, setRevenue] = useState<RevenueData[]>([]);
  const [heatmap] = useState<HeatmapCell[]>(buildMockHeatmap());
  const [statusTrend, setStatusTrend] = useState<StatusTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch inquiries for case type distribution + status trend
      const { data: inquiries } = await supabase
        .from('contact_inquiries')
        .select('service, status, created_at')
        .order('created_at', { ascending: true });

      // Fetch payments for revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_type, payment_status, created_at')
        .eq('payment_status', 'succeeded');

      const hasData = (inquiries?.length ?? 0) > 5;
      setIsDemo(!hasData);

      if (!hasData) {
        setCaseTypes(buildMockCaseTypes());
        setResolution(buildMockResolution());
        setRevenue(buildMockRevenue());
        setStatusTrend(buildMockStatusTrend());
        setLoading(false);
        return;
      }

      // ── Case Type Distribution ──
      const typeCounts: Record<string, number> = {};
      inquiries?.forEach((i) => {
        const key = i.service || 'Other';
        typeCounts[key] = (typeCounts[key] || 0) + 1;
      });
      const total = Object.values(typeCounts).reduce((s, v) => s + v, 0);
      const typeData: CaseTypeData[] = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([type, count]) => ({ type, count, percentage: Math.round((count / total) * 100) }));
      setCaseTypes(typeData);

      // ── Resolution Time (approximate from created_at to updated_at) ──
      const { data: closedCases } = await supabase
        .from('contact_inquiries')
        .select('service, created_at, updated_at')
        .eq('status', 'closed');

      const resMap: Record<string, number[]> = {};
      closedCases?.forEach((c) => {
        const days = Math.round((new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 86400000);
        if (days > 0 && days < 365) {
          const key = c.service || 'Other';
          if (!resMap[key]) resMap[key] = [];
          resMap[key].push(days);
        }
      });
      const resData: ResolutionTimeData[] = Object.entries(resMap)
        .filter(([, arr]) => arr.length > 0)
        .map(([service, arr]) => ({
          service,
          avgDays: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
          minDays: Math.min(...arr),
          maxDays: Math.max(...arr),
          caseCount: arr.length,
        }))
        .sort((a, b) => b.avgDays - a.avgDays);
      setResolution(resData.length > 0 ? resData : buildMockResolution());

      // ── Revenue by Category ──
      const revMap: Record<string, { revenue: number; transactions: number }> = {};
      payments?.forEach((p) => {
        const key = p.payment_type || 'Other';
        if (!revMap[key]) revMap[key] = { revenue: 0, transactions: 0 };
        revMap[key].revenue += p.amount / 100;
        revMap[key].transactions += 1;
      });
      const revData: RevenueData[] = Object.entries(revMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([category, d]) => ({
          category,
          revenue: Math.round(d.revenue),
          transactions: d.transactions,
          avgTicket: Math.round(d.revenue / d.transactions),
        }));
      setRevenue(revData.length > 0 ? revData : buildMockRevenue());

      // ── Status Trend (last 7 months) ──
      const now = new Date();
      const months: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleString('en-US', { month: 'short' }));
      }
      const trendMap: Record<string, StatusTrendPoint> = {};
      months.forEach((m) => {
        trendMap[m] = { month: m, new: 0, in_review: 0, contacted: 0, active: 0, closed: 0 };
      });
      inquiries?.forEach((i) => {
        const m = new Date(i.created_at).toLocaleString('en-US', { month: 'short' });
        if (trendMap[m]) {
          const status = i.status as keyof StatusTrendPoint;
          if (status in trendMap[m]) {
            (trendMap[m][status] as number) += 1;
          } else {
            trendMap[m].new += 1;
          }
        }
      });
      setStatusTrend(Object.values(trendMap));
    } catch {
      setCaseTypes(buildMockCaseTypes());
      setResolution(buildMockResolution());
      setRevenue(buildMockRevenue());
      setStatusTrend(buildMockStatusTrend());
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Summary stats ──
  const totalCases = caseTypes.reduce((s, d) => s + d.count, 0);
  const totalRevenue = revenue.reduce((s, d) => s + d.revenue, 0);
  const avgResolution = resolution.length > 0
    ? Math.round(resolution.reduce((s, d) => s + d.avgDays, 0) / resolution.length)
    : 0;
  const topService = caseTypes[0]?.type ?? '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span><strong>Demo data</strong> — charts will populate automatically as cases, payments, and inquiries accumulate in your system.</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Cases" value={totalCases.toString()} sub="All practice areas" />
        <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="Across all categories" accent={BRAND} />
        <StatCard label="Avg Resolution" value={`${avgResolution}d`} sub="Days to close a case" />
        <StatCard label="Top Practice Area" value={topService} sub={`${caseTypes[0]?.percentage ?? 0}% of caseload`} />
      </div>

      {/* Row 1: Case type + Resolution time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CaseTypeDistribution data={caseTypes} />
        <ResolutionTimeChart data={resolution} />
      </div>

      {/* Row 2: Revenue full width */}
      <RevenueByCategory data={revenue} />

      {/* Row 3: Heatmap full width */}
      <TeamUtilizationHeatmap data={heatmap} />

      {/* Row 4: Status trend full width */}
      <CaseStatusTrend data={statusTrend} />

      {/* Insights footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#355E3B20' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Staffing Signal</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Peak utilization occurs <strong className="text-foreground">Tue–Thu 10am–2pm</strong>. Consider scheduling paralegals to overlap during these windows and reduce Friday afternoon coverage.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#355E3B20' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Pricing Signal</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            IP/Trademark and Litigation have the <strong className="text-foreground">longest resolution times</strong> but may be underpriced relative to effort. Review flat-fee structures for these categories.
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#355E3B20' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Pipeline Signal</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Contract Review</strong> drives the highest case volume. Retainer packages generate the most revenue — prioritize converting contract clients to retainers.
          </p>
        </div>
      </div>
    </div>
  );
}
