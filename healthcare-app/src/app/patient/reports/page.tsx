'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Upload, Brain, Filter, ChevronRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getConfidenceBadge } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

export default function PatientReports() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    api.get('/api/reports')
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const types = ['All', 'Brain MRI', 'X-ray', 'ECG', 'Blood Test', 'Medical Report'];
  const filtered = typeFilter === 'All' ? reports : reports.filter((r: any) => r.type === typeFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('myReports')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Diagnostic imagery, laboratory telemetry, and AI automated analysis history
          </p>
        </div>
        <Link
          href="/patient/reports/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-600/20 transition-all cursor-pointer w-fit"
        >
          <Upload className="w-4 h-4" />
          {t('uploadReport')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap p-4 medical-glass-card shadow-md">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === type
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {type === 'All' ? t('all') : type}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="medical-glass-card shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('report')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('modality')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('date')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('status')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Confidence</th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((report: any) => (
                <tr key={report.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 rounded-xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.title}</span>
                        {report.is_demo && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            SAMPLE
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">{report.type}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(report.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium inline-flex items-center gap-1.5 ${getStatusColor(report.status)}`}>
                      {report.status === 'AI Processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {report.status === 'Reviewed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {report.status === 'AI Analyzed' && <Sparkles className="w-3 h-3 text-cyan-500" />}
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {report.ai_confidence ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-bold inline-block ${getConfidenceBadge(report.ai_confidence)}`}>
                        {report.ai_confidence}%
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href="/patient/analysis"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 hover:bg-cyan-100 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      {t('aiAnalysis')}
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                    No reports found matching selected category
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
