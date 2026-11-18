'use client';

import { useState, useEffect } from 'react';
import {
  Activity, Heart, Droplets, Thermometer, TrendingDown, TrendingUp, Clock, Loader2, Sparkles, Shield
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function HealthHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [vitals, setVitals] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const patientData = await api.get('/api/patients/me');
        if (patientData?.id) {
          const [vitalsData, timelineData] = await Promise.all([
            api.get(`/api/ai-analysis/vital-signs/${patientData.id}`).catch(() => []),
            api.get(`/api/medical-history/${patientData.id}`).catch(() => []),
          ]);
          setVitals(Array.isArray(vitalsData) ? vitalsData : []);
          setTimeline(Array.isArray(timelineData) ? timelineData : []);
        }
      } catch (err) {
        console.error('Failed to load health history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('healthHistory')}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Longitudinal telemetry, vital sign trends, and clinical milestone timeline
        </p>
      </div>

      {/* Vitals Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          { label: t('bloodPressure'), key: 'bloodPressure', unit: 'mmHg', icon: Heart, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40' },
          { label: t('heartRate'), key: 'heartRate', unit: 'bpm', icon: Activity, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40' },
          { label: t('bloodGlucose'), key: 'glucose', unit: 'mg/dL', icon: Droplets, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' },
        ].map((metric) => (
          <div key={metric.label} className="medical-glass-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${metric.bg} border rounded-lg flex items-center justify-center`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{metric.label}</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{metric.unit}</span>
            </div>

            <div className="space-y-2">
              {vitals.slice(0, 5).map((v: any, i: number) => {
                const value = metric.key === 'bloodPressure' ? (v.bloodPressure || v.blood_pressure) :
                  metric.key === 'heartRate' ? (v.heartRate || v.heart_rate) :
                  v.glucose;
                const prev = vitals[i + 1];
                const prevValue = prev ? (
                  metric.key === 'bloodPressure' ? null :
                    metric.key === 'heartRate' ? (prev.heartRate || prev.heart_rate) :
                    prev.glucose
                ) : null;

                return (
                  <div key={`${metric.key}-${v.id || v._id || v.date || 'vital'}-${i}`} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(v.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{String(value || '—')}</span>
                      {prevValue !== null && typeof value === 'number' && (
                        value > prevValue ? (
                          <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                        ) : value < prevValue ? (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })}
              {vitals.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">No trend telemetry available</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Historical Milestones */}
      <div className="medical-glass-card p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-4 h-4 text-cyan-500" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Longitudinal Clinical History</h2>
        </div>

        <div className="space-y-0">
          {timeline.map((event: any, i: number) => (
            <div key={`${event.id || event._id || event.date || 'event'}-${i}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                  event.type === 'diagnosis' ? 'bg-amber-500' :
                  event.type === 'report' ? 'bg-cyan-500' :
                  event.type === 'prescription' ? 'bg-emerald-500' : 'bg-violet-500'
                }`} />
                {i < timeline.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-slate-800 my-1" />}
              </div>
              <div className="pb-6">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{formatDate(event.date)}</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{event.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{event.description}</p>
              </div>
            </div>
          ))}
          {timeline.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">No past clinical events recorded in your health chart</p>
          )}
        </div>
      </div>
    </div>
  );
}
