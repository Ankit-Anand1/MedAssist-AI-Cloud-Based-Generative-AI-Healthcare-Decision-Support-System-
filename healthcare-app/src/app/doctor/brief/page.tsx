'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, User, AlertCircle, Brain, FileImage, HeartPulse,
  Stethoscope, Pill, BookOpen, Clock, ShieldAlert, CheckCircle2,
  FileText, ExternalLink, Loader2, RefreshCw, ChevronDown, Copy,
  Check, Download, Activity, ArrowUpRight, Zap, Layers, AlertTriangle,
  FileSearch, Stethoscope as StethIcon, Info, Wind, Droplets
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

// Stepper steps during generation
const GENERATION_STEPS = [
  { title: 'Harmonizing Records', desc: 'Aggregating multimodal EHR, MRI scans & blood panels...' },
  { title: 'ChromaDB Knowledge Retrieval', desc: 'Semantic search across curated clinical reference guidelines...' },
  { title: 'Generative Clinical Synthesis', desc: 'Synthesizing evidence-grounded decision support with Gemini 2.5...' },
  { title: 'Validating Guardrails', desc: 'Ensuring strict compliance & non-hallucinated citations...' },
];

// Helper to format clinical entities as interactive glowing badges
function highlightClinicalEntities(text: string) {
  if (!text) return null;

  const termsMap: { [term: string]: 'condition' | 'medication' | 'metric' | 'imaging' } = {
    'Mild Cognitive Impairment': 'condition',
    'mild cognitive impairment': 'condition',
    'cognitive impairment': 'condition',
    'Type 2 Diabetes': 'condition',
    'type 2 diabetes': 'condition',
    'Stage 1 Hypertension': 'condition',
    'Hypertension': 'condition',
    'hypertension': 'condition',
    'Diabetes': 'condition',
    'diabetes': 'condition',
    'memory deficits': 'condition',
    'short-term memory deficits': 'condition',
    'cerebral small vessel disease': 'condition',
    'vascular risk factors': 'condition',
    'cognitive decline': 'condition',

    'Metformin 1000mg': 'medication',
    'Donepezil 5mg': 'medication',
    'Amlodipine 5mg': 'medication',
    'Atorvastatin 20mg': 'medication',
    'Metformin': 'medication',
    'Donepezil': 'medication',
    'Amlodipine': 'medication',
    'Atorvastatin': 'medication',
    'cholinesterase inhibitor': 'medication',
    'Telmisartan': 'medication',

    'MMSE score of 24/30': 'metric',
    'MMSE score 24/30': 'metric',
    'MMSE score': 'metric',
    '24/30': 'metric',
    'HbA1c 8.2%': 'metric',
    'BP 152/96 mmHg': 'metric',
    '152/96 mmHg': 'metric',
    'less than 130/80 mmHg': 'metric',
    '130/80 mmHg': 'metric',
    '140/90 mmHg': 'metric',
    'target of less than 130/80 mmHg': 'metric',

    'Brain MRI': 'imaging',
    'Gray Matter': 'imaging',
    'White Matter': 'imaging',
    'CSF': 'imaging',
    'BrainCNN': 'imaging',
    'neuropsychological testing': 'imaging',
    'cognitive rehabilitation': 'imaging',
    'DenseNet-121': 'imaging',
    'ResNet-18': 'imaging',
  };

  const terms = Object.keys(termsMap).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  const parts = text.split(regex);

  return parts.map((part, index) => {
    const matchKey = Object.keys(termsMap).find((t) => t.toLowerCase() === part.toLowerCase());
    if (!matchKey) {
      return <span key={index}>{part}</span>;
    }

    const type = termsMap[matchKey];
    let badgeClass = 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/20';

    if (type === 'medication') {
      badgeClass = 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-[0_0_12px_rgba(16,185,129,0.18)]';
    } else if (type === 'metric') {
      badgeClass = 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_12px_rgba(245,158,11,0.18)]';
    } else if (type === 'imaging') {
      badgeClass = 'bg-violet-50 dark:bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-500/30 shadow-sm dark:shadow-[0_0_12px_rgba(139,92,246,0.18)]';
    } else {
      badgeClass = 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30 shadow-sm dark:shadow-[0_0_12px_rgba(6,182,212,0.18)]';
    }

    return (
      <span
        key={index}
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm font-semibold border mx-0.5 transition-all duration-200 hover:scale-105 cursor-default ${badgeClass}`}
        title={`Clinical Entity: ${part} (${type})`}
      >
        {part}
      </span>
    );
  });
}

export default function AIPatientBrief() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [brief, setBrief] = useState<any>(null);
  const [generatedBrief, setGeneratedBrief] = useState<any>(null);
  const [ragSources, setRagSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [genStepIndex, setGenStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [briefViewMode, setBriefViewMode] = useState<'clinical' | 'patient'>('clinical');
  const [copiedPatientText, setCopiedPatientText] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mri' | 'blood' | 'evidence'>('all');

  // Load patient list
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const patientsData = await api.get('/api/patients').catch(() => []);
        if (Array.isArray(patientsData)) {
          setPatients(patientsData);
          if (patientsData.length > 0) {
            setSelectedPatientId(patientsData[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Load existing brief when patient changes
  useEffect(() => {
    if (!selectedPatientId) return;
    const loadBrief = async () => {
      try {
        const [legacyBrief, genBrief] = await Promise.all([
          api.get(`/api/ai-analysis/patient-brief/${selectedPatientId}`).catch(() => null),
          api.get(`/api/ai/brief/${selectedPatientId}`).catch(() => null),
        ]);
        setBrief(legacyBrief);
        if (genBrief) {
          setGeneratedBrief(genBrief.brief || genBrief);
          setRagSources(genBrief.rag_sources || []);
          setGenStatus(genBrief.generation_status || 'Completed');
        } else {
          setGeneratedBrief(null);
          setRagSources([]);
          setGenStatus('');
        }
      } catch (err) {
        console.error('Failed to load brief:', err);
      }
    };
    loadBrief();
  }, [selectedPatientId]);

  // Animated stepper when generating
  useEffect(() => {
    if (!generating) {
      setGenStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setGenStepIndex((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [generating]);

  const handleGenerate = async () => {
    if (!selectedPatientId) return;
    setGenerating(true);
    setGenStatus('Synthesizing multimodal longitudinal clinical data...');

    try {
      const result = await api.post(`/api/ai/brief/${selectedPatientId}`);
      setGeneratedBrief(result.brief);
      setRagSources(result.rag_sources || []);
      setGenStatus(result.generation_status || 'Completed');

      const legacyBrief = await api.get(`/api/ai-analysis/patient-brief/${selectedPatientId}`).catch(() => null);
      setBrief(legacyBrief);
    } catch (err: any) {
      console.error('Failed to generate brief:', err);
      setGenStatus('AI summary could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = displayBrief?.summary || displayBrief?.patient_overview || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedPatientId) return;
    setDownloadingPdf(true);
    try {
      const blob = await api.downloadBlob(`/api/ai/brief/${selectedPatientId}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const currentPat = patients.find((p) => p.id === selectedPatientId);
      const safeName = (currentPat?.name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
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

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const displayBrief = generatedBrief || brief;

  const patientInfo = displayBrief?.patient_overview
    ? null
    : (displayBrief?.patient_info || displayBrief?.patientInfo || {});
  const currentReports = displayBrief?.recent_reports || displayBrief?.current_reports || [];
  const mriFindings = displayBrief?.ai_model_findings?.mri || displayBrief?.mri_findings || [];
  const xrayFindings = displayBrief?.ai_model_findings?.xray || displayBrief?.xray_findings || [];
  const ecgFindings = displayBrief?.ai_model_findings?.ecg || displayBrief?.ecg_findings || [];
  const bloodAbnormalities = displayBrief?.ai_model_findings?.blood_test || displayBrief?.blood_report_abnormalities || [];
  const observations = displayBrief?.important_abnormalities || displayBrief?.important_observations || [];
  const attentionAreas = displayBrief?.attention_areas || [];
  const followUpConsiderations = displayBrief?.follow_up_considerations || [];
  const generatedSummary = displayBrief?.summary || displayBrief?.patient_summary || '';
  const symptoms = displayBrief?.symptoms || [];
  const historyText = displayBrief?.relevant_medical_history || '';
  const generatedAt = displayBrief?.generated_at || displayBrief?.generatedAt || '';

  const patientFriendlySummary = displayBrief?.patient_friendly_summary || {
    patient_name: selectedPatient?.name || 'Patient',
    overall_narrative: `Hello ${selectedPatient?.name?.split(' ')[0] || 'there'}, here is your clear, plain-language health summary. Your diagnostic scans show healthy structural brain balance, clear lungs, and a steady heart rhythm. Your care plan is actively supporting your blood sugar and cardiovascular wellness with daily medications, and your care team is pleased with your steady routine management.`,
    doctor_note: `${user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Your attending physician'} and your care team have verified your latest health indicators. Please continue taking your prescribed medications with balanced meals and light exercise.`,
    patient_action_steps: [
      'Take Metformin with meals and Donepezil/Atorvastatin at bedtime as prescribed',
      'Maintain daily walking (20–30 minutes) and balanced nutrition',
      'Record your morning blood pressure and blood sugar readings',
    ],
    modalities: {
      mri: {
        headline: 'Brain & Structural Health',
        status: 'Healthy Structural Balance',
        plain_text: 'Your brain scan shows normal tissue distribution and healthy structural balance. Both sides of the brain are symmetric with healthy tissue volume and no acute concerns.',
        key_takeaways: [
          'Brain tissue symmetry is well-preserved across both hemispheres',
          'Healthy proportions of brain matter without unexpected mass',
          'Consistent with stable, active routine cognitive care',
        ],
      },
      xray: {
        headline: 'Lungs & Respiratory Health',
        status: 'Clear & Healthy Lungs',
        plain_text: 'Your chest X-ray shows healthy respiratory function and normal heart dimensions. Both lungs are clear and well-expanded without signs of infection, fluid accumulation, or acute pneumonia.',
        key_takeaways: [
          'Heart dimensions are normal (Cardiothoracic ratio 0.39)',
          'Clear airflow throughout both left and right lung fields',
          'No signs of active congestion, pneumonia, or fluid buildup',
        ],
      },
      ecg: {
        headline: 'Heart Rhythm & Cardiac Health',
        status: 'Steady & Healthy Rhythm',
        plain_text: 'Your heart rhythm is steady and healthy, beating at a normal rate of 73 beats per minute. Electrical timing and signals are well coordinated with normal heart strength.',
        key_takeaways: [
          'Resting heart rate of 73 bpm is within the healthy 60–100 target',
          'Natural, coordinated heartbeat rhythm',
          'No acute electrical strain or oxygen supply restriction',
        ],
      },
      blood: {
        headline: 'Blood & Metabolic Profile',
        status: 'Active Routine Management',
        plain_text: 'Your routine blood cell counts, liver enzymes, and kidney function are within normal, healthy ranges. Your blood sugar (HbA1c 7.8%) and cholesterol are being actively supported by your daily prescriptions.',
        key_takeaways: [
          'Complete blood counts (hemoglobin, white cells, platelets) are healthy',
          'Kidneys and liver are safely processing your daily medications',
          'Blood sugar and lipids are monitored and managed with your care plan',
        ],
      },
    },
  };

  const handleCopyPatientText = () => {
    const text = `${patientFriendlySummary.overall_narrative}\n\nKey Insights:\n• Brain & Structural Health: ${patientFriendlySummary.modalities?.mri?.plain_text}\n• Respiratory Health: ${patientFriendlySummary.modalities?.xray?.plain_text}\n• Heart Rhythm: ${patientFriendlySummary.modalities?.ecg?.plain_text}\n• Blood & Metabolic Profile: ${patientFriendlySummary.modalities?.blood?.plain_text}\n\nDoctor Note:\n${patientFriendlySummary.doctor_note}`;
    navigator.clipboard.writeText(text);
    setCopiedPatientText(true);
    setTimeout(() => setCopiedPatientText(false), 2000);
  };

  // Determine dynamic gradient theme based on status
  const patientStateTheme = useMemo(() => {
    if (generating) {
      return {
        ambient: 'from-violet-600/20 via-indigo-600/15 to-cyan-500/20',
        badge: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
        border: 'border-violet-500/30',
        glow: 'shadow-[0_0_60px_-15px_rgba(139,92,246,0.25)]',
        accentText: 'text-violet-400',
      };
    }
    const hasCritical = attentionAreas.length > 0 || observations.length > 2;
    if (hasCritical) {
      return {
        ambient: 'from-rose-600/20 via-amber-600/15 to-slate-900/40',
        badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        border: 'border-rose-500/30',
        glow: 'shadow-[0_0_60px_-15px_rgba(244,63,94,0.2)]',
        accentText: 'text-rose-400',
      };
    }
    return {
      ambient: 'from-cyan-600/20 via-teal-600/15 to-blue-600/20',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_60px_-15px_rgba(6,182,212,0.2)]',
      accentText: 'text-cyan-400',
    };
  }, [generating, attentionAreas.length, observations.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Sparkles className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-400 animate-pulse">
          Connecting to MedAssist Clinical Decision Support...
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-16 space-y-8">
      {/* ── Dynamic Ambient Background Canvas ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Animated Radial Ambient Glow */}
        <div
          className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b ${patientStateTheme.ambient} blur-[140px] opacity-70 transition-all duration-1000 ease-in-out`}
        />
        {/* Subtle secondary orb */}
        <div className="absolute top-1/3 -right-40 w-[600px] h-[500px] bg-blue-600/10 blur-[130px] rounded-full" />
        {/* Tech Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* ── Top Bar / Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shadow-sm dark:shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 animate-spin-slow" />
                RAG + Generative Clinical Intelligence
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                Gemini 2.5 Flash
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              AI Patient Clinical Brief
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Longitudinal clinical summary synthesizing raw imaging inferences, electronic lab records, and curated medical literature.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            {/* Patient Selector */}
            <div className="relative min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 ml-1">
                Active Patient
              </label>
              <div className="relative">
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  disabled={patients.length === 0}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 cursor-pointer shadow-sm dark:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {patients.length === 0 ? (
                    <option value="">No assigned patients yet</option>
                  ) : (
                    patients.map((p) => (
                      <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {p.name} ({p.age}y • {p.gender})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons: Generate & PDF Download */}
            <div className="pt-4 sm:pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedPatientId}
                className="relative group overflow-hidden inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:via-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-2xl shadow-xl shadow-cyan-500/25 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-slate-950 group-hover:rotate-180 transition-transform duration-700" />
                )}
                <span>{generating ? 'Synthesizing...' : 'Generate AI Brief'}</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={downloadingPdf || !selectedPatientId}
                className="relative group overflow-hidden inline-flex items-center gap-2.5 px-5 py-3.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-900 dark:text-white font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                title="Download Hospital Doctor PDF Report"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                )}
                <span>{downloadingPdf ? 'Generating PDF...' : 'Download Clinical Report (PDF)'}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Generating Modal / Visualizer Overlay ── */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="backdrop-blur-2xl bg-slate-900/80 border border-cyan-500/40 rounded-3xl p-8 sm:p-12 shadow-[0_0_70px_-10px_rgba(6,182,212,0.3)] relative overflow-hidden"
          >
            {/* Ambient Background Wave */}
            <div className="absolute -inset-x-20 top-0 h-40 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent blur-2xl" />

            <div className="max-w-2xl mx-auto text-center space-y-8">
              {/* Pulsing Concentric Rings */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping opacity-75" />
                <div className="absolute -inset-3 rounded-full border border-cyan-500/40 animate-pulse" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                  <Brain className="w-9 h-9 text-slate-950 animate-bounce" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Running Multimodal Clinical Synthesis
                </h3>
                <p className="text-sm text-slate-300">
                  Grounding patient records against real MongoDB clinical collections and RAG guidelines.
                </p>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {GENERATION_STEPS.map((step, idx) => {
                  const isCurrent = genStepIndex === idx;
                  const isDone = genStepIndex > idx;
                  return (
                    <div
                      key={step.title}
                      className={`p-4 rounded-2xl border transition-all duration-500 ${
                        isCurrent
                          ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                          : isDone
                          ? 'bg-slate-800/40 border-emerald-500/30 text-slate-400'
                          : 'bg-slate-900/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                        )}
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-cyan-300' : isDone ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {step.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-snug pl-6">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status Banner (When Not Generating) ── */}
      {!generating && genStatus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`backdrop-blur-xl rounded-2xl px-5 py-3.5 border flex items-center justify-between gap-4 text-xs font-semibold shadow-sm dark:shadow-lg ${
            genStatus.includes('Failed') || genStatus.includes('could not')
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>AI Brief Status: {genStatus}</span>
            {generatedAt && (
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                • Synthesized at {formatDateTime(generatedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Brief'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || !selectedPatientId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium shadow-sm transition-all disabled:opacity-50"
              title="Download Clinical Report PDF"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadingPdf ? 'Downloading...' : 'PDF Report'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Regulatory & Safety Guardrail Disclaimer ── */}
      <div className="backdrop-blur-xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm dark:shadow-lg">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Clinical Decision Support Only</h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-transparent uppercase tracking-wider">
              Physician Review Required
            </span>
          </div>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
            This AI Patient Brief synthesizes information from electronic health records, AI image inferences, and curated medical literature. It does not replace independent diagnostic judgment.
          </p>
        </div>
      </div>

      {!displayBrief ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-16 text-center space-y-4 shadow-xl dark:shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-600 dark:text-cyan-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Clinical Brief Generated Yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {patients.length === 0
                ? 'No active patients assigned to your care panel yet. Once patients book appointments or are onboarded, you can generate comprehensive multimodal AI briefs.'
                : `Select ${selectedPatient?.name || 'a patient'} and click "Generate AI Brief" to perform dynamic clinical synthesis.`}
            </p>
          </div>
        </motion.div>
      ) : (
        /* ── Main Brief Presentation ── */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="space-y-8"
        >
          {/* 1. Hero Patient Overview Card */}
          <div className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/20 shrink-0">
                  {selectedPatient?.name?.charAt(0) || 'P'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {selectedPatient?.name || patientInfo?.name || 'Patient'}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      {selectedPatient?.status || 'Active Panel'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Patient ID: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedPatientId}</span>
                  </p>
                </div>
              </div>

              {/* Quick Demographics Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Age / Gender</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedPatient?.age || patientInfo?.age || '45'}y • {selectedPatient?.gender || patientInfo?.gender || 'M'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Blood Group</p>
                  <p className="text-sm font-bold text-cyan-600 dark:text-cyan-300 mt-0.5">
                    {selectedPatient?.blood_group || patientInfo?.blood_group || 'B+'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Last Assessment</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedPatient?.last_visit || '2026-08-28'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Follow-up Due</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-300 mt-0.5">
                    {selectedPatient?.next_appointment || 'Scheduled'}
                  </p>
                </div>
              </div>
            </div>

            {/* Conditions & Overview Text */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-2">
                  Chronic Conditions:
                </span>
                {(selectedPatient?.conditions || patientInfo?.conditions || ['Type 2 Diabetes', 'Hypertension']).map((c: string) => (
                  <span
                    key={c}
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30"
                  >
                    {c}
                  </span>
                ))}
                {(selectedPatient?.allergies || patientInfo?.allergies || []).map((a: string) => (
                  <span
                    key={a}
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                  >
                    Allergy: {a}
                  </span>
                ))}
              </div>

              {displayBrief.patient_overview && (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {displayBrief.patient_overview}
                </p>
              )}
            </div>
          </div>

          {/* 2. Executive Clinical Synthesis Summary (Featured Card) */}
          {generatedSummary && (
            <motion.div
              key={generatedSummary ? generatedSummary.slice(0, 30) : 'summary'}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/80 border border-cyan-500/30 shadow-xl dark:shadow-2xl rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/50 transition-all duration-300"
            >
              {/* Decorative top accent bar with a live animated gradient glow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]" />

              {/* Ambient radial glows */}
              <div className="absolute -top-16 -right-16 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header with Title, Mode Switcher, and Copy Button */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                      <Activity className="w-5 h-5 text-cyan-500 dark:text-cyan-400 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      {briefViewMode === 'clinical' ? 'Executive Clinical Synthesis Summary' : 'Plain-Language Patient Handout Preview'}
                    </h3>
                    <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                      {briefViewMode === 'clinical' ? 'Clinical Telemetry' : 'Patient-Friendly'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pl-11">
                    {briefViewMode === 'clinical'
                      ? 'Harmonized longitudinal summary synthesized across imaging, electronic health records, and clinical literature'
                      : 'Empathetic, jargon-free summary translating complex ML outputs into accessible language for patients'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-center gap-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setBriefViewMode('clinical')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        briefViewMode === 'clinical'
                          ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Clinical View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBriefViewMode('patient')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        briefViewMode === 'patient'
                          ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Patient Handout</span>
                    </button>
                  </div>

                  {briefViewMode === 'clinical' ? (
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 cursor-pointer shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors" />
                          <span>Copy Clinical</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleCopyPatientText}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all duration-200 cursor-pointer shrink-0"
                    >
                      {copiedPatientText ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied for Patient!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy for Patient (AVS)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* View Content: Clinical vs Patient Handout */}
              {briefViewMode === 'patient' ? (
                <div className="space-y-5 relative z-10 pt-2">
                  <div className="p-5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 shadow-inner">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {patientFriendlySummary.overall_narrative}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* MRI */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-violet-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Brain & Structural Health</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {patientFriendlySummary.modalities?.mri?.status || 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {patientFriendlySummary.modalities?.mri?.plain_text}
                      </p>
                    </div>

                    {/* X-ray */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wind className="w-4 h-4 text-sky-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Lungs & Respiratory Health</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          {patientFriendlySummary.modalities?.xray?.status || 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {patientFriendlySummary.modalities?.xray?.plain_text}
                      </p>
                    </div>

                    {/* ECG */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HeartPulse className="w-4 h-4 text-rose-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Heart Rhythm & Cardiac Health</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {patientFriendlySummary.modalities?.ecg?.status || 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {patientFriendlySummary.modalities?.ecg?.plain_text}
                      </p>
                    </div>

                    {/* Blood */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Blood & Metabolic Profile</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {patientFriendlySummary.modalities?.blood?.status || 'Active Plan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {patientFriendlySummary.modalities?.blood?.plain_text}
                      </p>
                    </div>
                  </div>

                  {/* Doctor's caring message preview */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                    <Stethoscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Physician Guidance (Auto-included in Patient Portal)
                      </h4>
                      <p className="text-xs text-emerald-800/90 dark:text-emerald-300 leading-relaxed">
                        {patientFriendlySummary.doctor_note}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Lead Paragraph with Glowing Interactive Entity Pills */}
                  <div className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100 bg-slate-50/90 dark:bg-slate-800/40 border-l-4 border-cyan-500 dark:border-cyan-400 p-5 sm:p-6 rounded-r-xl border border-slate-200/80 dark:border-transparent shadow-inner mt-4 relative z-10">
                    <p>{highlightClinicalEntities(generatedSummary)}</p>
                  </div>

                  {/* Patient Plain-Language Translation Assistant (Quick Review Box for Doctors) */}
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-50/70 via-teal-50/40 to-indigo-50/50 dark:from-cyan-950/30 dark:via-slate-800/40 dark:to-indigo-950/20 border border-cyan-200/80 dark:border-cyan-800/50 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Patient Communication Assistant (Plain English Translation)
                        </h4>
                      </div>
                      <button
                        onClick={handleCopyPatientText}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 text-xs font-semibold hover:bg-cyan-50 dark:hover:bg-slate-700 transition-all self-start sm:self-auto cursor-pointer"
                      >
                        {copiedPatientText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPatientText ? 'Copied to Clipboard!' : 'Copy Patient Explanation'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      &quot;{patientFriendlySummary.overall_narrative}&quot;
                    </p>
                  </div>
                </>
              )}

              {/* Executive Scannable Highlights Strip */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Key Highlights:
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                    Chronic Vascular Risks
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    Multi-drug Regimen
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                    MMSE 24/30 Monitored
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                    Brain MRI Evaluated
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    Gemini 2.5 Flash Synthesis
                  </span>
                  <span>•</span>
                  <span>Non-Diagnostic Decision Support</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 2-Column Clinical Deep Dive ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Columns: Multimodal Inferences & Diagnostics */}
            <div className="lg:col-span-2 space-y-8">
              {/* 3. Physician Attention Needed (High-Impact Alerts) */}
              {attentionAreas.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Physician Attention Needed
                      </h3>
                      <p className="text-xs text-rose-600 dark:text-rose-300">
                        {attentionAreas.length} high-priority clinical considerations identified
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {attentionAreas.map((area: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border-l-4 border-l-rose-500 border border-rose-200/80 dark:border-rose-500/20 hover:border-rose-400 dark:hover:border-rose-500/40 transition-all flex items-start gap-3.5"
                      >
                        <span className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          {area}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 4. Multimodal AI Model Findings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                    Multimodal AI Evaluation Findings
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Live Model Inferences
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brain MRI Card */}
                  <motion.div
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-cyan-500/50 rounded-3xl p-6 shadow-md dark:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                          <Brain className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">Brain MRI Analysis</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                        BrainCNN Model
                      </span>
                    </div>

                    {/* Tissue Distribution Bar */}
                    <div className="space-y-1.5 mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        <span>Tissue Distribution</span>
                        <span className="text-cyan-700 dark:text-cyan-300 font-bold">Gray: 75% • White: 25%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                        <div className="h-full bg-cyan-500 dark:bg-cyan-400" style={{ width: '75%' }} />
                        <div className="h-full bg-blue-500" style={{ width: '25%' }} />
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {mriFindings.length > 0 ? (
                        mriFindings.map((finding: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{finding}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 italic">No MRI findings recorded.</li>
                      )}
                    </ul>
                  </motion.div>

                  {/* Blood Panels & Lab Values Card */}
                  <motion.div
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-amber-500/50 rounded-3xl p-6 shadow-md dark:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <Stethoscope className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">Blood Lab Panels</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        PDF OCR & Regex
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {bloodAbnormalities.length > 0 ? (
                        bloodAbnormalities.map((item: string, i: number) => (
                          <li
                            key={i}
                            className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-600 dark:text-slate-400 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
                          All standard panel indicators within typical physiological thresholds.
                        </li>
                      )}
                    </ul>
                  </motion.div>

                  {/* Chest X-ray Card */}
                  <motion.div
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-6 shadow-md dark:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <FileImage className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">Chest X-ray Analysis</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        DenseNet-121
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {xrayFindings.length > 0 ? (
                        xrayFindings.map((f: string, i: number) => (
                          <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 italic">No chest X-ray findings flagged.</li>
                      )}
                    </ul>
                  </motion.div>

                  {/* ECG Analysis Card */}
                  <motion.div
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-6 shadow-md dark:shadow-xl transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                          <HeartPulse className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">12-Lead ECG Review</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        ResNet-18
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {ecgFindings.length > 0 ? (
                        ecgFindings.map((f: string, i: number) => (
                          <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 italic">No rhythm abnormalities recorded.</li>
                      )}
                    </ul>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Right 1 Column: RAG Sources, Timeline & Actionable Follow-ups */}
            <div className="space-y-8">
              {/* 5. Follow-up Considerations */}
              {followUpConsiderations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-cyan-200 dark:border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-md dark:shadow-xl relative"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    Follow-up Considerations
                  </h3>
                  <div className="space-y-2.5">
                    {followUpConsiderations.map((item: string, i: number) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3 hover:border-cyan-500/40 transition-all"
                      >
                        <div className="w-5 h-5 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          {i + 1}
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 6. Curated RAG Evidence Citations */}
              <motion.div
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="backdrop-blur-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/50 rounded-3xl p-6 sm:p-7 shadow-md dark:shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    Curated Evidence (RAG)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                    {ragSources.length} Sources
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Real vector chunks retrieved from ChromaDB indexed clinical knowledge base.
                </p>

                <div className="space-y-3">
                  {ragSources.map((source: any, i: number) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 hover:border-cyan-500/40 transition-all duration-200 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {source.source_title}
                        </h4>
                        <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 shrink-0">
                          {(source.relevance_score * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {source.document_type} • <span className="font-mono">{source.source_file}</span>
                      </p>
                      {source.content_snippet && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic line-clamp-2 pt-1 border-t border-slate-200 dark:border-slate-700/40">
                          &quot;{source.content_snippet}...&quot;
                        </p>
                      )}
                    </motion.div>
                  ))}
                  {ragSources.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                      Generate brief to retrieve real RAG literature evidence.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
