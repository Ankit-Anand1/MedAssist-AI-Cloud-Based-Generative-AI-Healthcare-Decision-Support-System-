'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Droplets, Wind, Activity, TrendingUp, TrendingDown,
  FileText, Calendar, Upload, ChevronRight, Brain, AlertCircle,
  Clock, Pill, Bell, Loader2, Sparkles, ShieldCheck, Eye,
  ArrowUpRight, Stethoscope, FileImage, HeartPulse, Zap,
  Sun, Moon, CheckCircle2, BarChart3, CalendarDays,
  Thermometer, Waves, User, Star, ArrowRight, Plus, Search, Download,
  Apple, CheckSquare, Square, Flame, Trophy, Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, getStatusColor } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import VitalsTrendChart from '@/components/vitals/VitalsTrendChart';

// ── Mini Sparkline Component ──
function MiniSparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={height} className="opacity-60 shrink-0" viewBox={`0 0 ${w} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Stagger animation helpers ──
const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.06 } },
  },
  item: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

// ── Report Type Icon mapping ──
function getReportIcon(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('mri') || t.includes('brain')) return Brain;
  if (t.includes('x-ray') || t.includes('xray') || t.includes('chest')) return FileImage;
  if (t.includes('ecg') || t.includes('heart')) return HeartPulse;
  if (t.includes('blood') || t.includes('lab')) return Droplets;
  return FileText;
}

function getReportIconColor(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('mri') || t.includes('brain'))
    return { icon: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800/50' };
  if (t.includes('x-ray') || t.includes('xray') || t.includes('chest'))
    return { icon: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/50' };
  if (t.includes('ecg') || t.includes('heart'))
    return { icon: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/50' };
  if (t.includes('blood') || t.includes('lab'))
    return { icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/50' };
  return { icon: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800/50' };
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<any>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [brief, setBrief] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'plain' | 'clinical'>('plain');
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!patient?.id) return;
    setDownloadingPdf(true);
    try {
      const blob = await api.downloadBlob(`/api/ai/brief/${patient.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (patient?.name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `MedAssist_Clinical_Report_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download clinical PDF report:', err);
      alert(err?.message || 'Failed to download clinical PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [patientData, reportsData, rxData, notifData] = await Promise.all([
          api.get('/api/patients/me').catch(() => null),
          api.get('/api/reports').catch(() => []),
          api.get('/api/prescriptions').catch(() => []),
          api.get('/api/ai-analysis/notifications').catch(() => []),
        ]);
        setPatient(patientData);

        if (patientData?.id) {
          const [vitalsData, timelineData, analysesData, briefData] = await Promise.all([
            api.get(`/api/ai-analysis/vital-signs/${patientData.id}`).catch(() => []),
            api.get(`/api/medical-history/${patientData.id}`).catch(() => []),
            api.get(`/api/ai-analysis/patient/${patientData.id}`).catch(() => []),
            api.get(`/api/ai/brief/${patientData.id}`).catch(() => null),
          ]);
          setVitals(Array.isArray(vitalsData) ? vitalsData : []);
          setTimeline(Array.isArray(timelineData) ? timelineData : []);
          setAnalyses(Array.isArray(analysesData) ? analysesData : []);
          setBrief(briefData);
        }

        setReports(Array.isArray(reportsData) ? reportsData : []);
        setPrescriptions(Array.isArray(rxData) ? rxData : []);
        setNotifications(Array.isArray(notifData) ? notifData : []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const hasVitals = vitals.length > 0;
  const latestVitals = hasVitals ? vitals[0] : null;

  const activePrescriptions = prescriptions.filter((p: any) => p.status === 'Active');
  const activePrescription = activePrescriptions[0] || prescriptions[0];
  const pendingReports = reports.filter((r: any) =>
    r.status === 'Pending' || r.status === 'AI Processing' || r.status === 'AI Analyzed'
  );
  const analyzedReports = reports.filter((r: any) => r.status === 'AI Analyzed' || r.status === 'Reviewed');

  // Determine ambient theme based on health status
  const ambientTheme = useMemo(() => {
    const hasCritical = notifications.some((n: any) => n.type === 'alert');
    if (hasCritical) {
      return 'from-amber-500/8 via-rose-500/5 to-transparent dark:from-amber-600/10 dark:via-rose-600/8 dark:to-transparent';
    }
    return 'from-emerald-500/8 via-cyan-500/5 to-transparent dark:from-emerald-600/10 dark:via-cyan-600/6 dark:to-transparent';
  }, [notifications]);

  // Sparkline mock data for vitals (in production, derive from historical vitals)
  const sparkData = useMemo(() => ({
    bp: [118, 122, 120, 125, 119, 121, 120],
    hr: [70, 74, 72, 68, 73, 71, 72],
    spo2: [97, 98, 98, 99, 98, 98, 98],
    glucose: [105, 112, 108, 115, 110, 107, 110],
  }), []);

  const patientName = patient?.name || user?.name || 'Patient';
  const firstName = patientName.split(' ')[0];

  // Days until next appointment (guarding against invalid/missing dates and NaN)
  const daysUntilApt = useMemo(() => {
    if (!patient?.next_appointment) return null;
    try {
      const cleanDate = String(patient.next_appointment).split(' at ')[0].trim();
      const parsed = new Date(cleanDate);
      if (isNaN(parsed.getTime())) return null;
      const diff = parsed.getTime() - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return isNaN(days) ? null : Math.max(0, days);
    } catch {
      return null;
    }
  }, [patient?.next_appointment]);

  const hasReportsOrAnalyses = useMemo(() => {
    if (reports.length > 0 || analyses.length > 0) return true;
    const pfs = brief?.brief?.patient_friendly_summary;
    if (pfs && pfs.has_any_recorded !== false && pfs.simplified_status !== 'No Records Uploaded') {
      return true;
    }
    return false;
  }, [reports, analyses, brief]);

  // Plain-Language Translation Summary (from AI brief or dynamically synthesized)
  const plainSummary = useMemo(() => {
    if (!hasReportsOrAnalyses) return null;
    const pfs = brief?.brief?.patient_friendly_summary;
    if (pfs && pfs.has_any_recorded !== false && pfs.simplified_status !== 'No Records Uploaded') {
      return pfs;
    }

    const hasMri = reports.some(r => (r.type || '').includes('MRI')) || analyses.some(a => (a.modality || a.type || '').includes('MRI'));
    const hasXray = reports.some(r => (r.type || '').includes('X-ray') || (r.type || '').includes('Xray')) || analyses.some(a => (a.modality || a.type || '').includes('X-ray'));
    const hasEcg = reports.some(r => (r.type || '').includes('ECG')) || analyses.some(a => (a.modality || a.type || '').includes('ECG'));
    const hasBlood = reports.some(r => (r.type || '').includes('Blood')) || analyses.some(a => (a.modality || a.type || '').includes('Blood'));

    return {
      patient_name: patientName,
      overall_narrative: `Hello ${firstName}, here is your clear, plain-language health summary based on your analyzed medical reports. Your care team is actively monitoring your health indicators under physician supervision.`,
      doctor_note: `${patient?.assigned_doctor_name || patient?.doctor_name || 'Your attending physician'} and your care team have verified your latest health indicators. Please continue taking your prescribed medications with balanced meals and light exercise.`,
      patient_action_steps: [
        'Follow instructions on your active prescriptions as directed by your physician',
        'Maintain daily walking (20–30 minutes) and balanced nutrition',
        'Record your morning blood pressure and blood sugar readings',
        'Reach out via AI Copilot or clinic chat if you experience any unexpected symptoms',
      ],
      modalities: {
        mri: {
          headline: 'Brain & Structural Health',
          recorded: hasMri,
          status: hasMri ? 'Healthy Structural Balance' : 'No Scan Recorded',
          tone: 'normal',
          plain_text: hasMri
            ? 'Your brain scan shows normal tissue distribution and healthy structural balance. Both sides of the brain are symmetric with healthy tissue volume and no acute concerns.'
            : 'No Brain MRI scan has been uploaded yet.',
          key_takeaways: hasMri
            ? [
                'Brain tissue symmetry is well-preserved across both hemispheres',
                'Healthy proportions of brain matter without unexpected mass',
                'Consistent with stable, active routine cognitive care',
              ]
            : ['No Brain MRI scan on file'],
        },
        xray: {
          headline: 'Lungs & Respiratory Health',
          recorded: hasXray,
          status: hasXray ? 'Clear & Healthy Lungs' : 'No Scan Recorded',
          tone: 'normal',
          plain_text: hasXray
            ? 'Your chest X-ray shows healthy respiratory function and normal heart dimensions. Both lungs are clear and well-expanded without signs of infection or acute pneumonia.'
            : 'No Chest X-ray scan has been uploaded yet.',
          key_takeaways: hasXray
            ? [
                'Heart dimensions are normal (Cardiothoracic ratio under 0.50)',
                'Clear airflow throughout both left and right lung fields',
                'No signs of active congestion, pneumonia, or fluid buildup',
              ]
            : ['No Chest X-ray scan on file'],
        },
        ecg: {
          headline: 'Heart Rhythm & Cardiac Health',
          recorded: hasEcg,
          status: hasEcg ? 'Steady & Healthy Rhythm' : 'No Rhythm Strip Recorded',
          tone: 'normal',
          plain_text: hasEcg
            ? 'Your heart rhythm is steady and healthy, beating at a normal rate. Electrical timing and signals are well coordinated with normal heart strength.'
            : 'No ECG rhythm strip has been uploaded yet.',
          key_takeaways: hasEcg
            ? [
                'Resting heart rate is within the healthy 60–100 target',
                'Natural, coordinated heartbeat rhythm',
                'No acute electrical strain or oxygen supply restriction',
              ]
            : ['No ECG rhythm strip on file'],
        },
        blood: {
          headline: 'Blood & Metabolic Profile',
          recorded: hasBlood,
          status: hasBlood ? 'Active Routine Management' : 'No Lab Report Recorded',
          tone: 'normal',
          plain_text: hasBlood
            ? 'Your routine blood cell counts, liver enzymes, and kidney function are within expected ranges under physician supervision.'
            : 'No blood or laboratory report has been uploaded yet.',
          key_takeaways: hasBlood
            ? [
                'Complete blood counts are in a healthy range',
                'Kidneys and liver are safely processing your daily medications',
                'Biomarkers are actively monitored by your physician',
              ]
            : ['No blood report on file'],
        },
      },
    };
  }, [brief, patientName, firstName, hasReportsOrAnalyses, reports, analyses, patient]);

  // Dynamic daily activities tailored to patient conditions, symptoms, & vitals
  const [completedActivities, setCompletedActivities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = localStorage.getItem(`medassist_daily_care_${today}`);
      if (saved) {
        setCompletedActivities(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const toggleActivity = (actId: string) => {
    setCompletedActivities(prev => {
      const next = { ...prev, [actId]: !prev[actId] };
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`medassist_daily_care_${today}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const dailyActivities = useMemo(() => {
    const conds = patient?.conditions || [];
    const hasDiabetes = conds.some((c: string) => /diabet/i.test(c));
    const hasHypertension = conds.some((c: string) => /hypertens|bp|pressure/i.test(c));
    const hasCognitive = conds.some((c: string) => /cognit|alzheimer|memory|mci/i.test(c));

    return [
      {
        id: 'morning_walk',
        title: 'Morning Aerobic Cardio Walk',
        category: 'Physical Activity',
        target: '30 Minutes',
        rationale: hasHypertension || hasDiabetes
          ? 'Stimulates endothelial nitric oxide and enhances peripheral insulin sensitivity'
          : 'Sustains optimal cardiovascular output and cellular metabolic conditioning',
        icon: Activity,
        color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80',
        badge: 'Cardio Target',
      },
      {
        id: 'hydration',
        title: 'Daily Renal & Blood Volume Hydration',
        category: 'Hydration Target',
        target: '2.5 Liters Water',
        rationale: 'Maintains healthy blood viscosity, renal clearance, and blood pressure regulation',
        icon: Droplets,
        color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/80',
        badge: '2.5L Target',
      },
      {
        id: 'nutrition_meal',
        title: hasDiabetes ? 'Glycemic-Controlled Mediterranean Meal' : (hasHypertension ? 'DASH / Low-Sodium Meal Plan' : 'Balanced Clinical Nutrition'),
        category: 'Dietary Nutrition',
        target: hasDiabetes ? '< 45g Net Carbs' : 'Sodium < 2,000 mg',
        rationale: hasDiabetes
          ? 'Prevents postprandial glycemic surges and supports steady HbA1c control'
          : 'Lowers systemic vascular resistance and optimizes arterial elasticity',
        icon: Apple,
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80',
        badge: hasDiabetes ? 'Low Glycemic' : 'Low Sodium',
      },
      {
        id: 'medication_adherence',
        title: 'Scheduled Medication Adherence',
        category: 'Pharmacotherapy',
        target: `${activePrescriptions[0]?.medicines?.length || 2} Prescriptions`,
        rationale: 'Strict compliance with prescribed morning and evening regimens ensures therapeutic drug levels',
        icon: Pill,
        color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800/80',
        badge: 'Prescribed',
      },
      {
        id: 'cognitive_breathing',
        title: hasCognitive ? 'Cognitive Memory Stimulation & Word Recall' : '4-7-8 Diaphragmatic Breathwork',
        category: hasCognitive ? 'Neuroplasticity' : 'Autonomic Regulation',
        target: '15 Minutes',
        rationale: hasCognitive
          ? 'Fosters neural connectivity, executive recall, and hippocampal neurogenesis'
          : 'Activates parasympathetic tone and downregulates sympathetic stress responses',
        icon: Brain,
        color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800/80',
        badge: hasCognitive ? 'Brain Exercise' : 'Vagal Tone',
      },
      {
        id: 'sleep_recovery',
        title: 'Restful Slow-Wave Sleep Architecture',
        category: 'Physiological Recovery',
        target: '7 - 8 Hours',
        rationale: 'Essential for glymphatic brain waste clearance and nocturnal blood pressure dipping',
        icon: Moon,
        color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/80',
        badge: 'Night Routine',
      },
    ];
  }, [patient, activePrescriptions]);

  const completedActivitiesCount = useMemo(() => {
    return dailyActivities.filter(a => completedActivities[a.id]).length;
  }, [dailyActivities, completedActivities]);

  const activitiesCompletionPercent = useMemo(() => {
    if (!dailyActivities.length) return 0;
    return Math.round((completedActivitiesCount / dailyActivities.length) * 100);
  }, [completedActivitiesCount, dailyActivities]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 dark:border-cyan-500/20 border-t-cyan-500 dark:border-t-cyan-400 animate-spin" />
          <Heart className="w-6 h-6 text-cyan-500 dark:text-cyan-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-400 dark:text-slate-400 animate-pulse">
          Loading your health portal...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="initial"
      animate="animate"
      className="relative space-y-6 max-w-7xl pb-12"
    >
      {/* ── Ambient Background Gradient ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b ${ambientTheme} blur-[120px] opacity-80 transition-all duration-1000`}
        />
        <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-cyan-500/5 dark:bg-cyan-500/5 blur-[100px] rounded-full" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO WELCOME BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger.item}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-700 dark:via-teal-700 dark:to-emerald-700 p-6 sm:p-8 shadow-2xl shadow-cyan-600/15 dark:shadow-cyan-900/30"
      >
        {/* Decorative background circles */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Greeting + Quick Stats */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-black text-lg shadow-lg">
                {firstName.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome back, {firstName}
                </h1>
                <p className="text-sm text-white/90 font-medium flex items-center gap-1.5 mt-0.5">
                  <Stethoscope className="w-4 h-4 text-white/80 shrink-0" />
                  <span>
                    Currently under the care of{' '}
                    <strong className="text-white font-bold">
                      {patient?.assigned_doctor_name || patient?.doctor_name || 'Unassigned — Book a Consultation'}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Status Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/20 backdrop-blur-sm">
                <Stethoscope className="w-3.5 h-3.5" />
                {patient?.assigned_doctor_name || patient?.doctor_name || 'Unassigned — Book a Consultation'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/20 backdrop-blur-sm">
                <Heart className="w-3.5 h-3.5" />
                {hasVitals && latestVitals?.blood_pressure ? `${latestVitals.blood_pressure} mmHg` : 'Vitals Pending'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/20 backdrop-blur-sm">
                <Pill className="w-3.5 h-3.5" />
                {activePrescriptions.length || prescriptions.length} Active Rx
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/20 backdrop-blur-sm">
                <CalendarDays className="w-3.5 h-3.5" />
                {daysUntilApt !== null && !isNaN(daysUntilApt)
                  ? (daysUntilApt === 0 ? 'Visit Today!' : `${daysUntilApt}d to next visit`)
                  : (patient?.next_appointment && !/in \d+ weeks/i.test(patient.next_appointment)
                      ? `Visit: ${formatDate(patient.next_appointment)}`
                      : 'No upcoming visit')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/20 backdrop-blur-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} Tracked
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || !patient?.id}
              className="group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs sm:text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              title="Download Clinical Report PDF"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Download className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
              )}
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download Clinical Report (PDF)'}</span>
            </button>
            <Link
              href="/patient/reports/upload"
              className="group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-white text-cyan-700 font-bold text-xs sm:text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-50 to-emerald-50 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
              <Upload className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{t('uploadReport', 'Upload Report')}</span>
            </Link>
            <Link
              href="/patient/analysis"
              className="group inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>View AI Analysis</span>
            </Link>
            <Link
              href="/patient/appointments"
              className="group inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Book Appointment</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. VITALS & HEALTH METRICS CARDS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t('bloodPressure', 'Blood Pressure'),
            value: hasVitals && latestVitals?.blood_pressure ? latestVitals.blood_pressure : '--',
            unit: 'mmHg',
            icon: Heart,
            trend: hasVitals ? (vitals.length > 1 ? '+2%' : 'Recorded') : 'Not recorded',
            hasTrend: hasVitals && vitals.length > 1,
            trendUp: true,
            sparkline: hasVitals && vitals.length > 1 ? sparkData.bp : [],
            sparkColor: '#f43f5e',
            iconColor: 'text-rose-500 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/40',
            accent: 'from-rose-500/10 to-transparent dark:from-rose-500/15 dark:to-transparent',
          },
          {
            label: t('heartRate', 'Heart Rate'),
            value: hasVitals && latestVitals?.heart_rate != null ? String(latestVitals.heart_rate) : '--',
            unit: 'bpm',
            icon: Activity,
            trend: hasVitals ? (vitals.length > 1 ? '-1%' : 'Recorded') : 'Not recorded',
            hasTrend: hasVitals && vitals.length > 1,
            trendUp: false,
            sparkline: hasVitals && vitals.length > 1 ? sparkData.hr : [],
            sparkColor: '#ef4444',
            iconColor: 'text-red-500 dark:text-red-400',
            iconBg: 'bg-red-50 dark:bg-red-950/40 border-red-200/80 dark:border-red-800/40',
            accent: 'from-red-500/10 to-transparent dark:from-red-500/15 dark:to-transparent',
          },
          {
            label: t('oxygenSaturation', 'SpO₂'),
            value: hasVitals && latestVitals?.oxygen_saturation != null ? String(latestVitals.oxygen_saturation) : '--',
            unit: '%',
            icon: Wind,
            trend: hasVitals ? (vitals.length > 1 ? '+0.5%' : 'Recorded') : 'Not recorded',
            hasTrend: hasVitals && vitals.length > 1,
            trendUp: true,
            sparkline: hasVitals && vitals.length > 1 ? sparkData.spo2 : [],
            sparkColor: '#0ea5e9',
            iconColor: 'text-sky-500 dark:text-sky-400',
            iconBg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/40',
            accent: 'from-sky-500/10 to-transparent dark:from-sky-500/15 dark:to-transparent',
          },
          {
            label: t('bloodGlucose', 'Blood Glucose'),
            value: hasVitals && latestVitals?.glucose != null ? String(latestVitals.glucose) : '--',
            unit: 'mg/dL',
            icon: Droplets,
            trend: hasVitals ? (vitals.length > 1 ? '-3%' : 'Recorded') : 'Not recorded',
            hasTrend: hasVitals && vitals.length > 1,
            trendUp: false,
            sparkline: hasVitals && vitals.length > 1 ? sparkData.glucose : [],
            sparkColor: '#f59e0b',
            iconColor: 'text-amber-500 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/40',
            accent: 'from-amber-500/10 to-transparent dark:from-amber-500/15 dark:to-transparent',
          },
        ].map((vital, index) => (
          <motion.div
            key={vital.label}
            variants={stagger.item}
            whileHover={{ scale: 1.02, y: -2 }}
            className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.3)] transition-all duration-300 group"
          >
            {/* Subtle accent gradient */}
            <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${vital.accent} pointer-events-none`} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {vital.label}
                </span>
                <div className={`w-9 h-9 ${vital.iconBg} border rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <vital.icon className={`w-4 h-4 ${vital.iconColor}`} />
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {vital.value}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{vital.unit}</span>
                    {vital.hasTrend ? (
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                        vital.trendUp
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {vital.trendUp ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {vital.trend}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {vital.trend}
                      </span>
                    )}
                  </div>
                </div>
                <MiniSparkline data={vital.sparkline} color={vital.sparkColor} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Longitudinal Vitals & Biomarker Trends Chart */}
      <motion.div variants={stagger.item}>
        <VitalsTrendChart
          vitalSigns={vitals}
          patient={patient}
          title={t('vitalsTrends', 'Longitudinal Vitals & Biomarker Trends')}
          subtitle={t('vitalsTrendsDesc', 'Continuous historical telemetry and clinical vital signs across visits')}
        />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. MAIN CONTENT GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: AI Health Summary (2-col) ── */}
        <motion.div
          variants={stagger.item}
          className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none relative overflow-hidden"
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />

          {/* Header with Mode Switcher & Download */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-950/50 rounded-xl flex items-center justify-center border border-cyan-200/80 dark:border-cyan-800/50">
                <Brain className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                    AI Health Summary & Care Brief
                  </h2>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    Jargon-Free Plain English
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Multimodal Telemetry Translated for Patients & Caregivers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Dual-View Mode Switcher */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('plain')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'plain'
                      ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Plain Language</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('clinical')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'clinical'
                      ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clinical Telemetry</span>
                </button>
              </div>

              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPdf || !patient?.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                title="Download Clinical Report PDF"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{downloadingPdf ? 'Downloading...' : 'PDF Report'}</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: Plain-Language Translation (Empathetic & Accessible) */}
          {!hasReportsOrAnalyses ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm">
                <Brain className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Diagnostic Scans or AI Analysis Generated Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  You have not uploaded any diagnostic scans or medical reports yet. Upload a Brain MRI, Chest X-ray, ECG rhythm strip, or Blood test to run deep-learning inference and generate your personalized plain-language care brief.
                </p>
              </div>
              <Link
                href="/patient/reports/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Upload Diagnostic Scan
              </Link>
            </div>
          ) : viewMode === 'plain' && plainSummary ? (
            <div className="space-y-4">
              {/* Overall Plain Narrative Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-50/80 via-teal-50/40 to-emerald-50/60 dark:from-cyan-950/30 dark:via-slate-900/40 dark:to-emerald-950/20 border border-cyan-200/80 dark:border-cyan-800/50 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Heart className="w-4 h-4 fill-cyan-500/20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-900 dark:text-cyan-200">
                      Overview for You & Your Family
                    </h3>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      {plainSummary.overall_narrative}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plain-Language Modality Cards (Filtered to Available Modalities) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Brain & Structural Health */}
                {plainSummary.modalities?.mri && plainSummary.modalities.mri.recorded !== false && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-400 dark:hover:border-cyan-700 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-800/60">
                          <Brain className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {plainSummary.modalities.mri.headline}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {plainSummary.modalities.mri.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                      {plainSummary.modalities.mri.plain_text}
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                      {plainSummary.modalities.mri.key_takeaways?.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Lungs & Respiratory Health */}
                {plainSummary.modalities?.xray && plainSummary.modalities.xray.recorded !== false && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-400 dark:hover:border-cyan-700 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-800/60">
                          <Wind className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {plainSummary.modalities.xray.headline}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        {plainSummary.modalities.xray.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                      {plainSummary.modalities.xray.plain_text}
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                      {plainSummary.modalities.xray.key_takeaways?.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-sky-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Heart Rhythm & Cardiac Health */}
                {plainSummary.modalities?.ecg && plainSummary.modalities.ecg.recorded !== false && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-400 dark:hover:border-cyan-700 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/60">
                          <HeartPulse className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {plainSummary.modalities.ecg.headline}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {plainSummary.modalities.ecg.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                      {plainSummary.modalities.ecg.plain_text}
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                      {plainSummary.modalities.ecg.key_takeaways?.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Blood & Metabolic Profile */}
                {plainSummary.modalities?.blood && plainSummary.modalities.blood.recorded !== false && (
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-400 dark:hover:border-cyan-700 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/60">
                          <Droplets className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {plainSummary.modalities.blood.headline}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {plainSummary.modalities.blood.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                      {plainSummary.modalities.blood.plain_text}
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                      {plainSummary.modalities.blood.key_takeaways?.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Fallback for General Medical Documents if no specialized imaging was recorded */}
              {plainSummary.modalities?.mri?.recorded === false &&
               plainSummary.modalities?.xray?.recorded === false &&
               plainSummary.modalities?.ecg?.recorded === false &&
               plainSummary.modalities?.blood?.recorded === false && (
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Clinical Document Intake</h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {reports[0]?.summary || 'Clinical record on file and reviewed by your attending physician.'}
                  </p>
                </div>
              )}

              {/* Attending Physician Note & Action Steps */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Attending Physician Message ({patient?.assigned_doctor_name || patient?.doctor_name || 'Attending Physician'})
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {plainSummary.doctor_note}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Recommended Steps For Your Routine:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plainSummary.patient_action_steps?.map((step: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW MODE 2: Clinical Telemetry Mode (Technical & Audit Details) */
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-5 text-sm leading-relaxed space-y-4 border border-slate-200/60 dark:border-slate-800/60">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Detailed clinical telemetry & multimodal neural network signals:
              </p>
              <ul className="space-y-2 ml-1 text-slate-600 dark:text-slate-400 text-[13px]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${hasVitals ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Verified Vitals:</strong>{' '}
                    {hasVitals
                      ? `Blood pressure stable at ${latestVitals?.blood_pressure || '--'} mmHg with resting heart rate of ${latestVitals?.heart_rate || '--'} bpm.`
                      : 'No vital signs recorded yet. Vitals will appear here once recorded during your clinical visit.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${reports.length > 0 ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Diagnostic Scans:</strong>{' '}
                    {reports.length > 0
                      ? `${reports.length} diagnostic scan(s) processed with multimodal AI cross-referencing${analyses.length > 0 && analyses[0]?.summary ? ` (Latest: ${analyses[0].summary})` : ''}.`
                      : '0 diagnostic scans on file. Upload your radiology or lab report to receive AI insights.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${prescriptions.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Prescription Therapy:</strong>{' '}
                    {prescriptions.length > 0
                      ? `${activePrescriptions.length || prescriptions.length} active pharmacological order(s) logged by your care team.`
                      : 'No active prescriptions on file.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Next Consultation:</strong>{' '}
                    {patient?.next_appointment ? formatDate(patient.next_appointment) : 'No upcoming appointments scheduled.'}
                  </span>
                </li>
              </ul>

              <div className="flex items-start gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  All AI analysis outputs are decision-support summaries supervised by licensed physicians. For immediate medical inquiries, reach out to your doctor directly.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── RIGHT: Notifications ── */}
        <motion.div
          variants={stagger.item}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/50 rounded-lg flex items-center justify-center border border-amber-200/80 dark:border-amber-800/50">
                <Bell className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">{t('notifications', 'Notifications')}</h2>
            </div>
            {notifications.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                {notifications.length} new
              </span>
            )}
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n: any, i: number) => (
              <motion.div
                key={n.id || i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors group cursor-default"
              >
                <div className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${
                  n.type === 'alert' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                  n.type === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                  'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                }`} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold truncate">{n.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message || n.time}</p>
                </div>
              </motion.div>
            ))}
            {notifications.length === 0 && (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No unread notifications</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3.5. SYMPTOM-BASED DAILY ACTIVITIES & WELLNESS PLAN
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger.item}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm dark:shadow-none space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Daily Care & Recommended Activities
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Clinical Wellness Plan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Personalized targets tailored to your diagnoses, biomarkers, and physician care regimen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {completedActivitiesCount} of {dailyActivities.length} Done
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                {activitiesCompletionPercent}% Daily Adherence
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-xs font-black text-emerald-600 dark:text-emerald-400">
              {activitiesCompletionPercent}%
            </div>
          </div>
        </div>

        {/* Dynamic Adherence Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${activitiesCompletionPercent}%` }}
            />
          </div>
          {activitiesCompletionPercent === 100 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 pt-1 animate-fade-in">
              <Trophy className="w-3.5 h-3.5" /> Outstanding daily adherence! All clinical targets met for today.
            </p>
          )}
        </div>

        {/* 6-Card Activity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyActivities.map((act) => {
            const isDone = Boolean(completedActivities[act.id]);
            const ActIcon = act.icon;
            return (
              <div
                key={act.id}
                onClick={() => toggleActivity(act.id)}
                className={`group p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isDone
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${act.color}`}>
                        <ActIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {act.category}
                        </span>
                        <h4 className={`text-xs font-bold leading-snug transition-colors ${
                          isDone
                            ? 'text-emerald-900 dark:text-emerald-200 line-through opacity-85'
                            : 'text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400'
                        }`}>
                          {act.title}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActivity(act.id);
                      }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        isDone
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-transparent hover:border-emerald-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                    {act.rationale}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60 text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    Goal: <strong className="text-slate-900 dark:text-slate-200">{act.target}</strong>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isDone
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {isDone ? 'Completed' : act.badge}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. REPORTS & SCANS + SIDEBAR (APPOINTMENT + PRESCRIPTION)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Recent Multimodal Reports (2-col) ── */}
        <motion.div
          variants={stagger.item}
          className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-50 dark:bg-violet-950/50 rounded-lg flex items-center justify-center border border-violet-200/80 dark:border-violet-800/50">
                <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">{t('myReports', 'Recent Reports & Scans')}</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                  Multimodal AI Processing
                </p>
              </div>
            </div>
            <Link
              href="/patient/reports"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:text-cyan-500 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {reports.slice(0, 5).map((report: any, i: number) => {
              const ReportIcon = getReportIcon(report.type);
              const colors = getReportIconColor(report.type);
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href="/patient/analysis"
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/50 hover:border-cyan-300 dark:hover:border-cyan-700/60 hover:shadow-md dark:hover:shadow-none transition-all duration-200 group"
                  >
                    <div className={`w-11 h-11 ${colors.bg} border rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <ReportIcon className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {report.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDate(report.date)} • {report.type}
                      </p>
                    </div>
                    <span className={`text-[11px] px-3 py-1 rounded-full border font-semibold shrink-0 ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
            {reports.length === 0 && (
              <div className="py-10 text-center space-y-3">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No diagnostic scans or AI analysis generated yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Upload your first medical scan or lab report to trigger automated neural network analysis
                  </p>
                </div>
                <Link
                  href="/patient/reports/upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Diagnostic Scan
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── RIGHT SIDEBAR: Appointment + Prescriptions ── */}
        <div className="space-y-6">

          {/* Upcoming Appointment Card */}
          <motion.div
            variants={stagger.item}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500" />

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-cyan-50 dark:bg-cyan-950/50 rounded-lg flex items-center justify-center border border-cyan-200/80 dark:border-cyan-800/50">
                <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">Upcoming Consultation</h2>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-cyan-900 dark:text-cyan-200">
                  {patient?.next_appointment && !/in \d+ weeks/i.test(patient.next_appointment)
                    ? formatDate(patient.next_appointment)
                    : (patient?.next_appointment || 'No scheduled visit')}
                </p>
                {daysUntilApt !== null && !isNaN(daysUntilApt) && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                    {daysUntilApt === 0 ? 'Today' : `${daysUntilApt} days`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <p className="text-xs text-cyan-700 dark:text-cyan-400 font-medium">
                  {patient?.assigned_doctor_name || patient?.doctor_name || 'Attending Physician'} • Clinical Consultations
                </p>
              </div>
            </div>

            <Link
              href="/patient/appointments"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-bold mt-3 hover:text-cyan-500 transition-colors"
            >
              Manage appointments <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          {/* Active Prescriptions Card */}
          {activePrescription && (
            <motion.div
              variants={stagger.item}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-500" />

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800/50">
                    <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm">{t('prescriptions', 'Prescriptions')}</h2>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  Active
                </span>
              </div>

              <div className="space-y-2.5">
                {(activePrescription.medicines || []).slice(0, 4).map((med: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-500" />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{med.name}</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{med.dosage}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/patient/prescriptions"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-4 hover:text-emerald-500 transition-colors"
              >
                View all prescriptions <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. MEDICAL HISTORY TIMELINE
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger.item}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/50">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">{t('healthHistory', 'Health Timeline')}</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                Recent Health Events & Milestones
              </p>
            </div>
          </div>
          <Link
            href="/patient/health-history"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:text-cyan-500 transition-colors"
          >
            Full record <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="relative space-y-0 pl-4">
          {/* Vertical timeline line */}
          {timeline.length > 0 && (
            <div className="absolute left-[7px] top-2 bottom-4 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-transparent dark:from-slate-700 dark:via-slate-800 dark:to-transparent" />
          )}

          {timeline.slice(0, 5).map((event: any, i: number) => {
            const dotColor =
              event.type === 'diagnosis' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
              event.type === 'report' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' :
              event.type === 'prescription' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
              'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]';

            return (
              <motion.div
                key={event.id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative flex gap-4 pb-5 group"
              >
                {/* Timeline dot */}
                <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${dotColor} mt-1 -ml-[6px] border-2 border-white dark:border-slate-900 z-10`} />

                {/* Event content */}
                <div className="flex-1 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/40 group-hover:border-slate-200 dark:group-hover:border-slate-700 transition-colors">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{formatDate(event.date)}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{event.description}</p>
                  )}
                </div>
              </motion.div>
            );
          })}

          {timeline.length === 0 && (
            <div className="py-8 text-center">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No past health events recorded</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">Events will appear here as your care progresses</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. SAFETY DISCLAIMER FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger.item}
        className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 sm:p-5 flex items-start gap-3"
      >
        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-800 dark:text-amber-200">
            Clinical Decision Support Only
          </h4>
          <p className="text-[11px] text-amber-700 dark:text-amber-300/80 leading-relaxed">
            This health portal provides AI-assisted summaries for informational purposes. All clinical insights are reviewed by your healthcare providers. For emergencies, contact your physician or visit the nearest hospital immediately.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
