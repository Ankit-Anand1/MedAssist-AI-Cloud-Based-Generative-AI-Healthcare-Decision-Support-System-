'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Filter, Search, ChevronRight, Brain, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getInitials } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function DoctorReports() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const types = ['All', 'Brain MRI', 'X-ray', 'ECG', 'Blood Test', 'Medical Report'];
  const statuses = ['All', 'Pending', 'AI Processing', 'AI Analyzed', 'Reviewed', 'Flagged'];

  useEffect(() => {
    if (!user) return;
    const fetchReportsAndPatients = async () => {
      try {
        const [reportsData, patientsData] = await Promise.all([
          api.get('/api/reports'),
          api.get('/api/patients'),
        ]);
        setReports(Array.isArray(reportsData) ? reportsData : []);
        setPatients(Array.isArray(patientsData) ? patientsData : []);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportsAndPatients();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const filtered = reports.filter(r => {
    const matchesType = typeFilter === 'All' || r.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const pId = r.patient_id || r.patientId;
    const patient = patients.find(p => p.id === pId);
    const matchesSearch = !searchQuery || 
      r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t('clinicalReports')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Multimodal diagnostics, imaging scans, and laboratory telemetry requiring verification
          </p>
        </div>

        {/* Live Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 medical-glass-card">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Modality:</span>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                typeFilter === type
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {type === 'All' ? t('all') : type}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:border-slate-800 hidden md:block" />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Status:</span>
          {statuses.slice(0, 5).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {status === 'All' ? t('all') : status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="medical-glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/60">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('patient')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('report')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('modality')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('date')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('status')}</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('urgency')}</th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((report) => {
                const pId = report.patient_id || report.patientId;
                const patient = patients.find(p => p.id === pId);
                const urgency = report.urgency || 'Normal';

                return (
                  <tr key={report.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 rounded-full flex items-center justify-center text-xs font-bold text-cyan-700 dark:text-cyan-300">
                          {patient ? getInitials(patient.name) : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{patient?.name || 'Patient'}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{pId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{report.title}</p>
                      {report.ai_confidence && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Sparkles className="w-3 h-3 text-cyan-500" /> Confidence: {report.ai_confidence}%
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{report.type}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(report.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium inline-flex items-center gap-1.5 ${getStatusColor(report.status)}`}>
                        {report.status === 'Reviewed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        urgency === 'Critical' ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' :
                        urgency === 'High' ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' :
                        urgency === 'Moderate' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                        'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/doctor/analysis`}
                          className="px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 hover:bg-cyan-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          {t('aiAnalysis')}
                        </Link>
                        <Link
                          href={`/doctor/patients/${pId}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
                          title="Patient Profile"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                    No reports match the current criteria
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
