'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, FileText, AlertTriangle, Calendar, ChevronRight,
  Brain, Activity, Eye, Loader2, Sparkles, BookOpen,
  HeartPulse, Stethoscope, FileImage, Database, Cloud,
  Server, Shield, ArrowDown, CheckCircle2, Clock, MessageSquare,
  Bot, ChevronDown, Check, ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getInitials } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dashData, setDashData] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchDashboardData = async () => {
      try {
        const [dashResult, patientsData, aptData, reportsData, notifData] = await Promise.all([
          api.get('/api/dashboard/doctor').catch(() => null),
          api.get('/api/patients'),
          api.get('/api/appointments'),
          api.get('/api/reports'),
          api.get('/api/ai-analysis/notifications'),
        ]);

        setDashData(dashResult);
        setPatients(Array.isArray(patientsData) ? patientsData : []);
        setAppointments(Array.isArray(aptData) ? aptData : []);
        setReports(Array.isArray(reportsData) ? reportsData : []);
        setNotifications(Array.isArray(notifData) ? notifData : []);
      } catch (err) {
        console.error('Failed to load doctor dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
      </div>
    );
  }

  const patientStats = dashData?.patient_stats;
  const reportStats = dashData?.report_stats;
  const aiStats = dashData?.ai_stats;

  const totalPatients = patientStats?.total ?? patients.length;
  const scheduledApts = appointments.filter(a => (a.status || '').toLowerCase() === 'scheduled');
  // Combine dashData upcoming appointments with scheduledApts, de-duplicating by id
  const allUpcoming = [...(dashData?.upcoming_appointments || []), ...scheduledApts];
  const seenIds = new Set<string>();
  const todayAppointments = allUpcoming.filter(a => {
    const id = a.id || a._id;
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    return (a.status || '').toLowerCase() === 'scheduled';
  });
  const pendingReviews = reports.filter(r => r.status === 'AI Analyzed' || r.status === 'Flagged' || r.status === 'Pending');
  const pendingCount = reportStats?.pending_review ?? pendingReviews.length;

  const doctorName = user?.name
    ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`)
    : 'Doctor';

  // Multimodal data counts strictly bound to MongoDB API response
  const mriCount = aiStats?.mri ?? 0;
  const xrayCount = aiStats?.xray ?? 0;
  const ecgCount = aiStats?.ecg ?? 0;
  const bloodCount = aiStats?.blood ?? 0;
  const briefsGenerated = aiStats?.briefs_generated ?? 0;
  const copilotSessions = aiStats?.copilot_sessions ?? 0;

  const activeAlerts = Array.isArray(dashData?.active_alerts)
    ? dashData.active_alerts
    : (Array.isArray(notifications) ? notifications : []);

  const handleOpenCopilot = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-ai-copilot'));
    }
  };

  return (
    <div className="space-y-7 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-cyan-950/20 via-transparent to-indigo-950/20 dark:from-cyan-950/40 dark:to-indigo-950/40 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('dashboard.title', 'Clinical Decision Support')}
            </h1>
            <span className="badge-glow-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              {t('dashboard.tag', 'AI-Powered CDSS')}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t('dashboard.subtitle', 'Multimodal decision support for clinical review')} • <span className="font-semibold text-slate-800 dark:text-slate-200">{doctorName}</span> • <strong className="text-cyan-600 dark:text-cyan-400">{totalPatients}</strong> {t('dashboard.active_patients', 'Active Patients')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/doctor/brief"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-cyan-600/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span>{t('dashboard.open_brief', 'AI Patient Brief')}</span>
          </Link>
          <button
            onClick={handleOpenCopilot}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-200" />
            <span>{t('dashboard.launch_copilot', 'AI Copilot')}</span>
          </button>
        </div>
      </div>

      {/* ── Multimodal Inferences Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-indigo-600 rounded-full shadow-sm" />
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
              {t('dashboard.inferences_overview', 'Multimodal Inferences Overview')}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t('dashboard.total_inferences', 'Total Inferences')}: <strong className="text-slate-900 dark:text-white font-bold">{mriCount + xrayCount + ecgCount + bloodCount}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Brain MRI */}
          <Link
            href="/doctor/analysis"
            className="group medical-glass-card p-5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-100 dark:border-violet-900/50 shadow-inner">
                <Brain className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 uppercase tracking-wider">
                BrainCNN
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
              {t('dashboard.brain_mri', 'Brain MRI')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">U-Net Tissue Segmentation</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{mriCount}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 font-bold transition-colors flex items-center gap-1">
                {t('dashboard.view_scans', 'View Scans')} →
              </span>
            </div>
          </Link>

          {/* Card 2: Chest X-Ray */}
          <Link
            href="/doctor/analysis"
            className="group medical-glass-card p-5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/50 shadow-inner">
                <FileImage className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 uppercase tracking-wider">
                DenseNet-121
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
              {t('dashboard.chest_xray', 'Chest XRay')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Activation Heatmap</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{xrayCount}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 font-bold transition-colors flex items-center gap-1">
                {t('dashboard.view_scans', 'View Scans')} →
              </span>
            </div>
          </Link>

          {/* Card 3: ECG */}
          <Link
            href="/doctor/analysis"
            className="group medical-glass-card p-5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50 shadow-inner">
                <HeartPulse className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 uppercase tracking-wider">
                ResNet Lead
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              {t('dashboard.ecg', 'ECG Rhythm')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Arrhythmia Detection</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{ecgCount}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 font-bold transition-colors flex items-center gap-1">
                {t('dashboard.view_traces', 'View Traces')} →
              </span>
            </div>
          </Link>

          {/* Card 4: Blood Report */}
          <Link
            href="/doctor/analysis"
            className="group medical-glass-card p-5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 shadow-inner">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 uppercase tracking-wider">
                NLP / OCR
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {t('dashboard.blood_report', 'Blood Report')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Lab Panel Extraction</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{bloodCount}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-bold transition-colors flex items-center gap-1">
                {t('dashboard.view_labs', 'View Labs')} →
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── AI Decision Support Capabilities ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: AI PATIENT BRIEF */}
        <div className="medical-glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center border border-cyan-200 dark:border-cyan-800/60 shadow-sm">
                  <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('dashboard.patient_brief_card_title', 'AI PATIENT BRIEF')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('dashboard.patient_brief_desc', 'RAG-grounded longitudinal patient synthesis')}
                  </p>
                </div>
              </div>
              <span className="badge-glow-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                GenAI Synthesis
              </span>
            </div>

            <div className="space-y-2.5 py-3.5 border-y border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Patient context:</strong> Synthesizes medical history, vitals &amp; chronic conditions
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Multimodal findings:</strong> Consolidates Brain MRI, X-ray, ECG &amp; blood lab anomalies
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">RAG evidence:</strong> Cites relevant medical research papers &amp; treatment pathways
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Full transparency:</strong> Explicit indicators when data is missing or incomplete
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Generated: <strong className="text-slate-900 dark:text-white font-bold">{briefsGenerated} Active Briefs</strong>
            </span>
            <Link
              href="/doctor/brief"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              {t('dashboard.open_brief', 'Open AI Patient Brief')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card B: HEALTHCARE AI COPILOT */}
        <div className="medical-glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60 shadow-sm">
                  <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('dashboard.copilot_card_title', 'HEALTHCARE AI COPILOT')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('dashboard.copilot_desc', 'Conversational clinical decision companion')}
                  </p>
                </div>
              </div>
              <span className="badge-glow-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                Interactive Assistant
              </span>
            </div>

            <div className="space-y-2.5 py-3.5 border-y border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Ask about patient records:</strong> Inquire on specific labs, scans &amp; conditions
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Evidence-grounded answers:</strong> Direct cross-checks against verified documents
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Knowledge base citations:</strong> Displays transparent vector database citations
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Zero hallucination:</strong> If evidence is missing, copilot explicitly reports it
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Sessions: <strong className="text-slate-900 dark:text-white font-bold">{copilotSessions} Logged Consultations</strong>
            </span>
            <button
              onClick={handleOpenCopilot}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" /> {t('dashboard.launch_copilot', 'Launch AI Copilot')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Clinical Operations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports Pending Physician Review */}
        <div className="lg:col-span-2 medical-glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Brain className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                {t('dashboard.pending_reviews', 'Reports Pending Physician Review')}
              </h2>
            </div>
            <Link href="/doctor/reports" className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1">
              {t('btn.view_all', 'View all')} ({pendingCount}) <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {pendingReviews.slice(0, 5).map((report) => {
              const pId = report.patient_id || report.patientId;
              const patient = patients.find(p => p.id === pId);
              const pName = patient?.name || 'Patient';
              return (
                <Link
                  key={report.id}
                  href={`/doctor/patients/${pId}`}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all group"
                >
                  <div className="w-9 h-9 bg-cyan-100 dark:bg-cyan-950/60 rounded-full flex items-center justify-center text-xs font-bold text-cyan-700 dark:text-cyan-300 shrink-0">
                    {getInitials(pName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {pName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {report.type || report.title} • {formatDate(report.date)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                </Link>
              );
            })}
            {pendingReviews.length === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">All reports reviewed</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">New uploads and AI inferences will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Alerts */}
        <div className="medical-glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              {t('dashboard.clinical_alerts', 'Clinical Alerts')}
            </h2>
          </div>
          <div className="space-y-3">
            {activeAlerts.slice(0, 4).map((n: any, idx: number) => (
              <div
                key={n.id || idx}
                className={`p-3.5 rounded-xl border ${
                  n.type === 'alert'
                    ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                    : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                }`}
              >
                <p className={`text-xs font-bold ${
                  n.type === 'alert' ? 'text-rose-900 dark:text-rose-300' : 'text-amber-900 dark:text-amber-300'
                }`}>
                  {n.title}
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${
                  n.type === 'alert' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {n.message}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">{n.time || 'Recent'}</p>
              </div>
            ))}
            {activeAlerts.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No active critical alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Scheduled Consultations */}
      <div className="medical-glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              {t('dashboard.scheduled_consultations', 'Scheduled Patient Consultations')}
            </h2>
          </div>
          <Link href="/doctor/appointments" className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1">
            View Schedule <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {todayAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {todayAppointments.map((apt: any) => {
              const pId = apt.patient_id || apt.patientId;
              const pName = apt.patient_name || apt.patientName || 'Patient';
              const dateStr = apt.date ? formatDate(apt.date) : 'Upcoming';
              return (
                <Link
                  key={apt.id || apt._id}
                  href={`/doctor/patients/${pId}`}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-950/60 rounded-full flex items-center justify-center text-[10px] font-bold text-cyan-700 dark:text-cyan-300 shrink-0">
                    {getInitials(pName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-cyan-600 transition-colors">{pName}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {apt.type || 'Consultation'} • {dateStr} • {apt.time}
                    </p>
                    {apt.notes && (
                      <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium truncate mt-0.5">
                        {apt.notes}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500">
            <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No scheduled consultations for today</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Upcoming patient bookings will appear here</p>
          </div>
        )}
      </div>

      {/* ── Physician Governance Disclaimer ── */}
      <div className="text-center py-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {t('dashboard.disclaimer', 'Decision Support Only • Final clinical diagnosis, prescription, and judgment remain under physician authority.')}
        </p>
      </div>
    </div>
  );
}
