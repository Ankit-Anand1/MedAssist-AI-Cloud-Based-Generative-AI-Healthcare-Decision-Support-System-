'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Brain, FileImage, HeartPulse, Stethoscope, FileText,
  AlertCircle, CheckCircle2, ShieldAlert, Info, Loader2,
  RefreshCw, XCircle, Users, TrendingUp, Sparkles, Download, Check
} from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { getStatusColor, getConfidenceColor, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import ExplainableAITelemetry from '@/components/analysis/ExplainableAITelemetry';

const tabs = [
  { key: 'mri', label: 'Brain MRI', icon: Brain, type: 'Brain MRI', translationKey: 'modality.mri' },
  { key: 'xray', label: 'X-ray', icon: FileImage, type: 'X-ray', translationKey: 'modality.xray' },
  { key: 'ecg', label: 'ECG', icon: HeartPulse, type: 'ECG', translationKey: 'modality.ecg' },
  { key: 'blood', label: 'Blood Report', icon: Stethoscope, type: 'Blood Test', translationKey: 'modality.blood' },
  { key: 'medical', label: 'Medical Report', icon: FileText, type: 'Medical Report', translationKey: 'modality.medical_report' },
];

export default function DoctorAnalysis() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('mri');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [labValues, setLabValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedSuccess, setReviewedSuccess] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  // Fetch patient list
  useEffect(() => {
    if (!user) return;
    api.get('/api/patients').then(data => {
      const pts = Array.isArray(data) ? data : [];
      setPatients(pts);
      if (pts.length > 0 && !selectedPatientId) {
        setSelectedPatientId(pts[0].id);
      }
    }).catch(() => { }).finally(() => setLoading(false));
  }, [user]);

  // Fetch analysis data for selected patient
  const fetchAnalyses = useCallback(async () => {
    if (!selectedPatientId) return;
    try {
      const [analysisData, reportsData, labData] = await Promise.all([
        api.get(`/api/ai-analysis/patient/${selectedPatientId}`).catch(() => []),
        api.get('/api/reports').catch(() => []),
        api.get(`/api/ai-analysis/lab-values/${selectedPatientId}`).catch(() => []),
      ]);
      setAnalyses(Array.isArray(analysisData) ? analysisData : []);
      setReports(
        (Array.isArray(reportsData) ? reportsData : [])
          .filter((r: any) => r.patient_id === selectedPatientId || r.patientId === selectedPatientId)
      );
      setLabValues(Array.isArray(labData) ? labData : []);
    } catch (err) {
      console.error('Failed to load doctor analysis:', err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    if (selectedPatientId) fetchAnalyses();
  }, [selectedPatientId, fetchAnalyses]);

  // Auto-polling if any report is in AI Processing state
  useEffect(() => {
    const hasProcessing = reports.some(r => r.status === 'AI Processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchAnalyses();
    }, 3000);

    return () => clearInterval(interval);
  }, [reports, fetchAnalyses]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalyses();
  };

  const currentTab = tabs.find(t => t.key === activeTab)!;

  // Filter reports for current modality and patient
  const tabReports = reports.filter(r => r.type === currentTab.type);

  // Active report
  const selectedReport = tabReports.find(r => r.id === selectedReportId) || tabReports[0];

  // Matching analysis for active report
  const analysis = selectedReport
    ? analyses.find(a => a.report_id === selectedReport.id) ||
    analyses.find(a => (a.modality === currentTab.type || a.type === currentTab.type))
    : null;

  // Filter lab values for active report
  const currentLabValues = selectedReport?.id
    ? labValues.filter(lv => lv.report_id === selectedReport.id)
    : labValues;

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const isFailedState =
    selectedReport?.status === 'AI Analysis Failed' ||
    selectedReport?.status === 'Unsupported File' ||
    analysis?.status === 'AI Analysis Failed' ||
    analysis?.status === 'Unsupported File' ||
    analysis?.status === 'Error';

  const isProcessingState =
    selectedReport?.status === 'AI Processing' ||
    (analysis?.status === 'Processing' && !isFailedState);

  const isReviewed = selectedReport?.status === 'Reviewed';

  // Live backend review submission
  const handleMarkAsReviewed = async () => {
    if (!selectedReport?.id) return;
    setReviewing(true);
    try {
      await api.put(`/api/reports/${selectedReport.id}`, {
        status: 'Reviewed',
      });
      // Optimistic update
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: 'Reviewed' } : r));
      setReviewedSuccess(true);
      setTimeout(() => setReviewedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to mark report as reviewed:', err);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('nav.analysis', 'Multimodal AI Analysis')}
            </h1>
            <span className="badge-glow-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Pretrained Neural Models
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Real AI inference across Brain MRI, Chest X-ray, ECG, and Blood Report modalities — Physician review required
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent-600' : ''}`} />
          {t('btn.refresh', 'Refresh')}
        </button>
      </div>

      {/* Patient Selector */}
      {patients.length > 0 ? (
        <div className="medical-glass-card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Users className="w-4 h-4 text-cyan-500" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Patient:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                setSelectedReportId('');
              }}
              className="flex-1 max-w-sm px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer shadow-sm"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-slate-900">
                  {p.name} — {p.age}y {p.gender} ({p.email})
                </option>
              ))}
            </select>
            {selectedPatient && (
              <Link
                href={`/doctor/patients/${selectedPatientId}`}
                className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline ml-auto flex items-center gap-1"
              >
                View Full Patient Record →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 medical-glass-card text-center rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Assigned Patients Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Your clinical roster is currently empty. Multimodal diagnostic analyses (Brain MRI, Chest X-ray, ECG, Blood Panels) will appear here once patients book consultations or are assigned to your care.
          </p>
        </div>
      )}

      {/* Clinical Disclaimer */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl px-5 py-3.5 flex items-start gap-3 backdrop-blur-md">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Physician Review Required — AI Decision Support</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            Model inference outputs and document extractions are assistive tools. All observations must be validated against patient symptoms, physical examination, and clinical judgment before diagnostic or treatment decisions.
          </p>
        </div>
      </div>

      {/* Modality Tabs */}
      <div className="medical-glass-card overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-950/40">
          {tabs.map((tab) => {
            const hasReports = reports.some(r => r.type === tab.type);
            const isTabProcessing = reports.some(r => r.type === tab.type && r.status === 'AI Processing');
            const hasTabAnalysis = analyses.some(a => (a.modality === tab.type || a.type === tab.type) && a.status !== 'AI Analysis Failed' && a.status !== 'Unsupported File');

            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  const firstRep = reports.find(r => r.type === tab.type);
                  setSelectedReportId(firstRep?.id || '');
                }}
                className={`flex items-center gap-2.5 px-6 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === tab.key
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900/90 shadow-sm'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-900/40'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {t(tab.translationKey, tab.label)}
                {isTabProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />}
                {hasTabAnalysis && !isTabProcessing && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </button>
            );
          })}
        </div>

        {/* Report Selector */}
        {tabReports.length > 1 && (
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Select Report:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {tabReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${selectedReport?.id === r.id
                      ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 border-cyan-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-white'
                    }`}
                >
                  <span>{r.title || r.file_name}</span>
                  <span className="text-[10px] text-slate-400">({r.date})</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getStatusColor(r.status)}`}>
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success Banner when marked as reviewed */}
        {reviewedSuccess && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold animate-fade-in shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Report status has been successfully updated to &quot;Reviewed&quot; in the clinical database!</span>
          </div>
        )}

        {/* State 1: AI Processing */}
        {isProcessingState && (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-100 dark:border-cyan-900 shadow-xl shadow-cyan-500/10">
              <Loader2 className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-spin" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">AI Inference Pipeline Executing</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Backend neural analyzer is generating observations for {selectedPatient?.name}&apos;s {currentTab.label}.
            </p>
          </div>
        )}

        {/* State 2: AI Failure State */}
        {isFailedState && (
          <div className="p-6 space-y-6">
            <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-red-900 dark:text-red-200">
                    AI Inference Notice
                  </h3>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    {analysis?.error_message || selectedReport?.summary || 'The model could not process this file format.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 3: AI Analyzed (Completed Real Inference) */}
        {!isProcessingState && !isFailedState && analysis && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {analysis.type || analysis.modality} Analysis
                  </h2>
                  <span className="badge-glow-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Real Model Inference
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(selectedReport?.status || 'AI Analyzed')}`}>
                    {selectedReport?.status || 'AI Analyzed'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Model: <span className="font-semibold text-slate-700 dark:text-slate-200">{analysis.model_name || analysis.modelName}</span> • {analysis.model_type || analysis.modelType}
                </p>
              </div>
              <div className="text-right bg-slate-50 dark:bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Model Confidence</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 tracking-tight">
                  {analysis.confidence}%
                </p>
              </div>
            </div>

            {/* Imaging Display (MRI, X-ray, ECG) with Radiology Chassis Framing */}
            {(activeTab === 'mri' || activeTab === 'xray' || activeTab === 'ecg') && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Original Scan */}
                <div className="radiology-chassis aspect-video flex flex-col justify-between relative group">
                  {/* HUD Top Bar */}
                  <div className="z-10 px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-400 font-bold tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      ORIGINAL SCAN • {currentTab.label.toUpperCase()}
                    </span>
                    <span className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
                      {selectedReport?.date || 'DICOM'}
                    </span>
                  </div>

                  {/* Scan Viewer Image */}
                  <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
                    {selectedReport?.file_url ? (
                      <img
                        src={`${API_BASE}${selectedReport.file_url}`}
                        alt={`Original ${currentTab.label}`}
                        className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">Scan Unavailable</p>
                    )}
                  </div>

                  {/* HUD Bottom Bar */}
                  <div className="z-10 px-4 py-2.5 bg-slate-950/85 backdrop-blur-md border-t border-slate-800/80 flex items-center justify-between">
                    <p className="text-xs text-slate-200 font-semibold">{selectedReport?.title || 'Patient Radiographic Source'}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Source Capture</span>
                  </div>
                </div>

                {/* Real AI Output Visualization with Radiology Framing */}
                <div className="radiology-chassis aspect-video flex flex-col justify-between relative group border-emerald-500/30">
                  {/* HUD Top Bar */}
                  <div className="z-10 px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      AI NEURAL ACTIVATION
                    </span>
                    <span className="text-emerald-400/90 text-[10px] font-bold uppercase tracking-widest font-mono">
                      CONFIDENCE: {analysis.confidence}%
                    </span>
                  </div>

                  {/* Output Image */}
                  <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
                    {analysis.output_image_url ? (
                      <img
                        src={`${API_BASE}${analysis.output_image_url}`}
                        alt="AI Output"
                        className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">Output Visualization Processing</p>
                    )}
                  </div>

                  {/* HUD Bottom Bar */}
                  <div className="z-10 px-4 py-2.5 bg-slate-950/85 backdrop-blur-md border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {activeTab === 'mri' ? 'Tissue Segmentation Overlay' :
                          activeTab === 'xray' ? 'Pathology Activation Heatmap' :
                            'Arrhythmia Rhythm Trace'}
                      </p>
                      <p className="text-[10px] text-slate-400">Deep neural inference heatmap</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono font-bold">
                      SYNTHESIZED
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Blood Test Extracted Lab Values */}
            {activeTab === 'blood' && currentLabValues.length > 0 && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50/50 dark:bg-slate-950/40">
                <div className="bg-slate-100/70 dark:bg-slate-900/80 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    Extracted Laboratory Parameters ({currentLabValues.length} Values)
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Automated OCR & Normalizer</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="text-left px-5 py-3.5">Parameter</th>
                      <th className="text-left px-5 py-3.5">Extracted Value</th>
                      <th className="text-left px-5 py-3.5">Unit</th>
                      <th className="text-left px-5 py-3.5">Reference Range</th>
                      <th className="text-left px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {currentLabValues.map((lab: any) => (
                      <tr key={lab.name || lab.id} className="hover:bg-cyan-50/20 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{lab.name}</td>
                        <td className={`px-5 py-3.5 font-bold ${lab.status === 'Normal' ? 'text-slate-800 dark:text-slate-200' :
                            lab.status === 'Critical' ? 'text-rose-600 dark:text-rose-400' :
                              lab.status === 'High' || lab.status === 'Low' ? 'text-amber-600 dark:text-amber-400' :
                                'text-slate-400 italic'
                          }`}>
                          {lab.value !== null && lab.value !== undefined ? lab.value : 'N/A'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{lab.unit}</td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{lab.reference_range || lab.referenceRange || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(lab.status)}`}>
                            {lab.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Explainable AI (XAI) Visual Telemetry Breakdown */}
            <ExplainableAITelemetry
              modality={activeTab}
              analysis={analysis}
              labValues={currentLabValues}
            />

            {/* Model Findings */}
            {analysis.findings && analysis.findings.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span>Model Findings</span>
                  <span className="badge-glow-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Validated Model Output
                  </span>
                </h3>
                <div className="space-y-2.5">
                  {analysis.findings.map((finding: any, i: number) => (
                    <div key={i} className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/30 transition-all">
                      <div className="mt-0.5">
                        {finding.status === 'Normal' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : finding.status === 'Borderline' ? (
                          <Info className="w-4 h-4 text-orange-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{finding.label}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getStatusColor(finding.status)}`}>
                            {finding.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">{finding.value}</p>
                        {finding.detail && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{finding.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            {analysis.summary && (
              <div className="mb-6 bg-cyan-50/40 dark:bg-cyan-950/20 rounded-2xl p-5 border border-cyan-200/60 dark:border-cyan-900/50 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  AI Pipeline Summary
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">{analysis.summary}</p>
              </div>
            )}

            {/* Doctor Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleMarkAsReviewed}
                disabled={reviewing || isReviewed}
                className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg ${isReviewed
                    ? 'bg-emerald-700 dark:bg-emerald-800 shadow-emerald-700/20 cursor-default'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                  }`}
              >
                {reviewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isReviewed ? t('btn.reviewed_validated', 'Clinically Reviewed & Validated') : t('btn.mark_reviewed', 'Mark as Reviewed')}
              </button>
              <Link
                href={`/doctor/patients/${selectedPatientId}`}
                className="px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
              >
                View Patient Profile
              </Link>
            </div>
          </div>
        )}

        {/* State 4: No Report */}
        {!selectedReport && (
          reports.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 shadow-sm">
                <Brain className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                No Diagnostic Scans or AI Analysis Generated Yet
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md">
                {selectedPatient ? `No diagnostic imaging scans or laboratory reports have been uploaded yet by ${selectedPatient.name}.` : 'No patient records or diagnostic files found for your clinical roster.'}
              </p>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <currentTab.icon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">No {currentTab.label} available for this patient</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {selectedPatient ? `No reports uploaded by ${selectedPatient.name} for this modality.` : 'No patient records found.'}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
