'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Activity,
  Heart,
  Droplets,
  Wind,
  Calendar,
} from 'lucide-react';

interface VitalSignRecord {
  date?: string;
  recorded_at?: string;
  created_at?: string;
  blood_pressure?: string;
  bp?: string;
  heart_rate?: number | string;
  hr?: number | string;
  oxygen_saturation?: number | string;
  spo2?: number | string;
  glucose?: number | string;
  blood_glucose?: number | string;
  temperature?: number | string;
  notes?: string;
}

interface VitalsTrendChartProps {
  vitalSigns?: VitalSignRecord[];
  patient?: {
    id?: string;
    name?: string;
    latest_vitals?: Record<string, string | number>;
  };
  title?: string;
  subtitle?: string;
}

interface TooltipPayloadEntry {
  color: string;
  name: string;
  value: number | string;
  payload?: {
    isBaseline?: boolean;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// Custom Glassmorphic Tooltip declared outside component to avoid re-renders
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[180px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            {label}
          </span>
          {payload[0]?.payload?.isBaseline && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">Baseline</span>
          )}
        </div>
        <div className="space-y-1">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold text-white font-mono">
                {entry.value} {entry.name.includes('BP') || entry.name.includes('Pressure') ? 'mmHg' : entry.name.includes('Heart') ? 'bpm' : entry.name.includes('SpO') ? '%' : 'mg/dL'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function VitalsTrendChart({
  vitalSigns = [],
  title = 'Longitudinal Vitals & Biomarker Trends',
  subtitle = 'Continuous historical telemetry and clinical vital signs across visits',
}: VitalsTrendChartProps) {
  const mounted = useMounted();
  const [activeMetric, setActiveMetric] = useState<'all' | 'bp' | 'cardiac' | 'glucose'>('all');

  // Format data: If zero recorded items exist, do NOT synthesize fake baselines
  const chartData = useMemo(() => {
    const rawList = Array.isArray(vitalSigns) ? vitalSigns.filter(Boolean) : [];

    if (rawList.length === 0) {
      return [];
    }

    // Sort chronologically ascending
    const sorted = [...rawList].sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || a.recorded_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || b.recorded_at || 0).getTime();
      return dateA - dateB;
    });

    const parsedList = sorted.map((item, idx) => {
      const bpStr = item.blood_pressure || item.bp || '120/80';
      const parts = String(bpStr).split('/');
      const systolic = parseInt(parts[0], 10) || 120;
      const diastolic = parseInt(parts[1], 10) || 80;

      const hr = parseInt(String(item.heart_rate || item.hr || 72), 10) || 72;
      const spo2 = parseFloat(String(item.oxygen_saturation || item.spo2 || 98)) || 98;
      const glucose = parseFloat(String(item.glucose || item.blood_glucose || 100)) || 100;

      let label = item.date || item.recorded_at || `Visit ${idx + 1}`;
      if (label.includes('T')) {
        label = label.split('T')[0];
      }
      if (label.length > 10) {
        label = label.substring(0, 10);
      }

      return {
        label,
        systolic,
        diastolic,
        heart_rate: hr,
        spo2,
        glucose,
        notes: item.notes || 'Routine Clinical Observation',
        isBaseline: false,
      };
    });

    return parsedList;
  }, [vitalSigns]);

  const latest = chartData[chartData.length - 1];

  if (!mounted) {
    return (
      <div className="h-72 w-full rounded-2xl bg-slate-100 dark:bg-slate-900/50 animate-pulse flex items-center justify-center">
        <Activity className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  // Clean empty state when no historical telemetry exists
  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-10 px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3.5 shadow-sm">
            <Activity className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            No Historical Telemetry
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            No historical telemetry recorded yet. Vitals will appear here once recorded by your attending physician.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm space-y-6">
      {/* Header & Metric Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'all' as const, label: 'All Telemetry' },
            { id: 'bp' as const, label: 'Blood Pressure' },
            { id: 'cardiac' as const, label: 'HR & SpO₂' },
            { id: 'glucose' as const, label: 'Blood Glucose' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMetric(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeMetric === tab.id
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Quick Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <Heart className="w-3 h-3" /> Blood Pressure
          </p>
          <p className="text-lg font-black text-rose-950 dark:text-rose-200 mt-1 font-mono">
            {latest?.systolic}/{latest?.diastolic} <span className="text-[10px] font-normal text-rose-500">mmHg</span>
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Target: &lt;120/80</span>
        </div>

        <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Heart Rate
          </p>
          <p className="text-lg font-black text-red-950 dark:text-red-200 mt-1 font-mono">
            {latest?.heart_rate} <span className="text-[10px] font-normal text-red-500">bpm</span>
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Resting: 60-100</span>
        </div>

        <div className="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <Wind className="w-3 h-3" /> SpO₂ Pulse Ox
          </p>
          <p className="text-lg font-black text-sky-950 dark:text-sky-200 mt-1 font-mono">
            {latest?.spo2}%
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Normal: 95-100%</span>
        </div>

        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Droplets className="w-3 h-3" /> Fasting Glucose
          </p>
          <p className="text-lg font-black text-amber-950 dark:text-amber-200 mt-1 font-mono">
            {latest?.glucose} <span className="text-[10px] font-normal text-amber-500">mg/dL</span>
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Normal: 70-99</span>
        </div>
      </div>

      {/* Main Recharts Area Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Systolic Gradient */}
              <linearGradient id="colorSystolic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
              {/* Diastolic Gradient */}
              <linearGradient id="colorDiastolic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
              {/* Heart Rate Gradient */}
              <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
              {/* SpO2 Gradient */}
              <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
              </linearGradient>
              {/* Glucose Gradient */}
              <linearGradient id="colorGlucose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
            <XAxis
              dataKey="label"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ opacity: 0.2 }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ opacity: 0.2 }}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              iconType="circle"
            />

            {/* Blood Pressure Areas */}
            {(activeMetric === 'all' || activeMetric === 'bp') && (
              <>
                <Area
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic BP"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSystolic)"
                  dot={{ r: 4, fill: '#f43f5e', strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="diastolic"
                  name="Diastolic BP"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDiastolic)"
                  dot={{ r: 3.5, fill: '#8b5cf6', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </>
            )}

            {/* Heart Rate & SpO2 Areas */}
            {(activeMetric === 'all' || activeMetric === 'cardiac') && (
              <>
                <Area
                  type="monotone"
                  dataKey="heart_rate"
                  name="Heart Rate (bpm)"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorHR)"
                  dot={{ r: 4, fill: '#ef4444', strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="spo2"
                  name="SpO₂ (%)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSpO2)"
                  dot={{ r: 3.5, fill: '#0284c7', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </>
            )}

            {/* Glucose Area */}
            {(activeMetric === 'all' || activeMetric === 'glucose') && (
              <Area
                type="monotone"
                dataKey="glucose"
                name="Fasting Glucose (mg/dL)"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorGlucose)"
                dot={{ r: 4, fill: '#f59e0b', strokeWidth: 1 }}
                activeDot={{ r: 6 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
