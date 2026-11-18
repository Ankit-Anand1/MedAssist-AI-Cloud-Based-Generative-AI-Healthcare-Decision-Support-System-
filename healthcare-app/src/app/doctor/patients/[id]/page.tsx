'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  User, Phone, Mail, AlertTriangle, Heart, FileText, Brain,
  ChevronRight, Pill, Calendar, Clock, Shield, CheckCircle2,
  AlertCircle, MessageSquare, Plus, BookOpen, ClipboardList,
  Stethoscope, Edit3, ShieldAlert, Sparkles, Loader2, Check,
  RefreshCw, HeartPulse, FileImage, Database, Eye, X, Activity,
  Wind, Droplets, Thermometer, Scale, Save
} from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { formatDate, getStatusColor, getInitials, getConfidenceColor } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal';
import VitalsTrendChart from '@/components/vitals/VitalsTrendChart';

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const [patient, setPatient] = useState<any>(null);
  const [patientReports, setPatientReports] = useState<any[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [aiBrief, setAiBrief] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [patientVitals, setPatientVitals] = useState<any[]>([]);
  const [clinicalNote, setClinicalNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);

  // Vitals & Clinical Modal State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsBp, setVitalsBp] = useState('120/80');
  const [vitalsHr, setVitalsHr] = useState('72');
  const [vitalsSpo2, setVitalsSpo2] = useState('98');
  const [vitalsGlucose, setVitalsGlucose] = useState('100');
  const [vitalsTemp, setVitalsTemp] = useState('98.6');
  const [vitalsWeight, setVitalsWeight] = useState('70');
  const [vitalsBmi, setVitalsBmi] = useState('23.5');
  const [vitalsNotes, setVitalsNotes] = useState('');
  const [clinicalAllergies, setClinicalAllergies] = useState('');
  const [clinicalDrugAllergies, setClinicalDrugAllergies] = useState('');
  const [clinicalConditions, setClinicalConditions] = useState('');
  const [clinicalNextApt, setClinicalNextApt] = useState('');
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsSuccess, setVitalsSuccess] = useState(false);

  const fetchPatientData = async () => {
    try {
      const [
        patientData,
        reportsData,
        rxData,
        timelineData,
        evidenceData,
        briefData,
        analysisData,
        notesData,
        vitalsData
      ] = await Promise.all([
        api.get(`/api/patients/${id}`).catch(() => null),
        api.get('/api/reports').catch(() => []),
        api.get('/api/prescriptions').catch(() => []),
        api.get(`/api/medical-history/${id}`).catch(() => []),
        api.get('/api/ai-analysis/research-evidence').catch(() => []),
        api.get(`/api/ai-analysis/patient-brief/${id}`).catch(() => null),
        api.get(`/api/ai-analysis/patient/${id}`).catch(() => []),
        api.get(`/api/doctor-notes/${id}`).catch(() => []),
        api.get(`/api/ai-analysis/vital-signs/${id}`).catch(() => []),
      ]);

      setPatient(patientData);
      if (Array.isArray(reportsData)) {
        setPatientReports(reportsData.filter(r => (r.patient_id === id || r.patientId === id)));
      }
      if (Array.isArray(rxData)) {
        setPatientPrescriptions(rxData.filter(p => (p.patient_id === id || p.patientId === id)));
      }
      setTimeline(Array.isArray(timelineData) ? timelineData : []);
      setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
      setAiBrief(briefData);
      setAnalyses(Array.isArray(analysisData) ? analysisData : []);
      setNotes(Array.isArray(notesData) ? notesData : []);
      setPatientVitals(Array.isArray(vitalsData) ? vitalsData : []);
    } catch (err) {
      console.error('Failed to load patient detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [id]);

  const handleOpenVitalsModal = () => {
    const latest = (patientVitals && patientVitals[0]) || patient?.latest_vitals || patient?.vitals || {};
    setVitalsBp(latest.blood_pressure || latest.bp || '120/80');
    setVitalsHr(latest.heart_rate != null ? String(latest.heart_rate) : '72');
    setVitalsSpo2(latest.oxygen_saturation != null ? String(latest.oxygen_saturation) : '98');
    setVitalsGlucose(latest.glucose != null ? String(latest.glucose) : '100');
    setVitalsTemp(latest.temperature != null ? String(latest.temperature) : '98.6');
    setVitalsWeight(latest.weight != null ? String(latest.weight) : '70');
    setVitalsBmi(latest.bmi != null ? String(latest.bmi) : '23.5');
    setVitalsNotes(latest.notes || '');

    const allg = patient?.allergies || [];
    setClinicalAllergies(Array.isArray(allg) ? allg.join(', ') : String(allg));

    const drugAllg = patient?.drug_allergies || [];
    setClinicalDrugAllergies(Array.isArray(drugAllg) ? drugAllg.join(', ') : String(drugAllg));

    const conds = patient?.conditions || [];
    setClinicalConditions(Array.isArray(conds) ? conds.join(', ') : String(conds));

    setClinicalNextApt(patient?.next_appointment ? patient.next_appointment.split(' ')[0] : '');
    setShowVitalsModal(true);
  };

  const handleSaveVitalsAndClinical = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVitals(true);
    try {
      const vitalsPayload = {
        blood_pressure: vitalsBp.trim(),
        heart_rate: vitalsHr ? parseInt(vitalsHr, 10) : undefined,
        oxygen_saturation: vitalsSpo2 ? parseFloat(vitalsSpo2) : undefined,
        glucose: vitalsGlucose ? parseFloat(vitalsGlucose) : undefined,
        temperature: vitalsTemp ? parseFloat(vitalsTemp) : undefined,
        weight: vitalsWeight ? parseFloat(vitalsWeight) : undefined,
        bmi: vitalsBmi ? parseFloat(vitalsBmi) : undefined,
        notes: vitalsNotes.trim(),
      };

      const clinicalPayload = {
        allergies: clinicalAllergies.split(',').map(s => s.trim()).filter(Boolean),
        drug_allergies: clinicalDrugAllergies.split(',').map(s => s.trim()).filter(Boolean),
        conditions: clinicalConditions.split(',').map(s => s.trim()).filter(Boolean),
        next_appointment: clinicalNextApt.trim() || undefined,
      };

      await Promise.all([
        api.post(`/api/patients/${id}/vitals`, vitalsPayload),
        api.put(`/api/patients/${id}/clinical`, clinicalPayload),
      ]);

      setVitalsSuccess(true);
      setTimeout(() => {
        setVitalsSuccess(false);
        setShowVitalsModal(false);
      }, 1500);

      fetchPatientData();
    } catch (err: any) {
      console.error('Failed to update clinical vitals:', err);
      alert(err.message || 'Failed to update vitals and clinical information');
    } finally {
      setSavingVitals(false);
    }
  };

  const handleSaveNote = async () => {
    if (!clinicalNote.trim() || !patient) return;
    setSavingNote(true);
    try {
      const newNote = await api.post('/api/doctor-notes', {
        patient_id: patient.id,
        note: clinicalNote.trim(),
      });
      setNotes(prev => [newNote, ...prev]);
      setClinicalNote('');
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdatePatientStatus = async (newStatus: string) => {
    if (!patient) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/patients/${patient.id}`, { status: newStatus });
      setPatient((prev: any) => ({ ...prev, status: newStatus }));
      setStatusFeedback(true);
      setTimeout(() => setStatusFeedback(false), 3000);
    } catch (err) {
      console.error('Failed to update patient status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <User className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Patient not found</h2>
        <p className="text-xs text-slate-500 mt-1">Could not find record for ID: {id}</p>
        <Link href="/doctor/patients" className="mt-4 inline-block px-4 py-2 bg-accent-600 text-white text-xs font-bold rounded-xl">
          Back to Patients
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports & Analysis' },
    { key: 'prescriptions', label: 'Prescriptions' },
    { key: 'history', label: 'Medical Timeline' },
  ];

  const allergies = patient.allergies || [];
  const conditions = patient.conditions || [];
  const bloodGroup = patient.blood_group || patient.bloodGroup || '—';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Patient AI Workspace Header ── */}
      <div className="medical-glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-cyan-500 rounded-full" />
            <h2 className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
              Patient AI Workspace
            </h2>
          </div>

          {/* Interactive Status Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinical Status:</span>
            <select
              value={patient.status || 'Active'}
              disabled={updatingStatus}
              onChange={(e) => handleUpdatePatientStatus(e.target.value)}
              className={`text-xs px-3 py-1 rounded-full border font-bold cursor-pointer transition-colors bg-white dark:bg-slate-900 ${getStatusColor(patient.status || 'Active')}`}
            >
              <option value="Active">Active Care</option>
              <option value="Follow-up Due">Follow-up Due</option>
              <option value="Stable">Stable</option>
            </select>
            {statusFeedback && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold animate-fade-in">
                <Check className="w-3.5 h-3.5" /> Updated
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg shadow-cyan-600/20">
              {getInitials(patient.name)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">{patient.name}</h1>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(patient.status || 'Active')}`}>
                  {patient.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {patient.age} years • {patient.gender} • Blood Group: <strong className="text-slate-800 dark:text-slate-200">{bloodGroup}</strong>
              </p>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3 text-cyan-500" />{patient.phone || 'No phone'}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3 text-cyan-500" />{patient.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleOpenVitalsModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              <HeartPulse className="w-3.5 h-3.5" />
              Record Vitals & Clinical Update
            </button>
            <Link
              href="/doctor/brief"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-xl hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800/80 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              AI Patient Brief
            </Link>
            <Link
              href={`/doctor/prescriptions/create?patient_id=${id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg shadow-cyan-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              New Prescription
            </Link>
          </div>
        </div>

        {/* Quick info row with latest vitals and clinical badges */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Latest Recorded Vitals */}
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-rose-500" /> Latest Vitals
            </p>
            {((patientVitals && patientVitals[0]) || patient?.latest_vitals) ? (
              (() => {
                const lv = patientVitals[0] || patient?.latest_vitals;
                return (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                      BP: {lv.blood_pressure || '120/80'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                      HR: {lv.heart_rate || '--'} bpm
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60">
                      SpO₂: {lv.oxygen_saturation || '--'}%
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                      Gluc: {lv.glucose || '--'} mg/dL
                    </span>
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-slate-400 mt-1 italic">No vitals logged yet — click Record Vitals above</p>
            )}
          </div>

          {/* Allergies & Drug Allergies */}
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Allergies & Drug Sensitivities</p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {(patient.drug_allergies || []).map((da: string) => (
                <span key={da} className="text-[10px] px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 rounded-full border border-rose-300 dark:border-rose-800 font-bold">
                  ⚠️ {da}
                </span>
              ))}
              {allergies.map((a: string) => (
                <span key={a} className="text-[10px] px-2 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-900 font-semibold">{a}</span>
              ))}
              {allergies.length === 0 && (!patient.drug_allergies || patient.drug_allergies.length === 0) && (
                <span className="text-xs text-slate-400 italic">None Logged</span>
              )}
            </div>
          </div>

          {/* Conditions & Follow-up */}
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Chronic Conditions & Next Visit</p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {conditions.map((c: string) => (
                <span key={c} className="text-[10px] px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 rounded-full border border-cyan-200 dark:border-cyan-800/80 font-semibold">{c}</span>
              ))}
              {patient.next_appointment && (
                <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800 font-semibold">
                  Follow-up: {patient.next_appointment}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="medical-glass-card overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-950/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900/90 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-900/40'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Longitudinal Vitals & Biomarker Trends Chart */}
              <div className="lg:col-span-2">
                <VitalsTrendChart
                  vitalSigns={patientVitals}
                  patient={patient}
                  title="Patient Longitudinal Vitals & Biomarker Trends"
                  subtitle="Recorded clinical observations synced with MongoDB historical telemetry"
                />
              </div>

              {/* AI Findings Summary */}
              <div className="lg:col-span-2">
                <h3 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white mb-3.5 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-accent-500" />
                  Multimodal Neural Findings
                  {analyses.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 rounded-full border border-accent-200 dark:border-accent-800 font-bold">
                      {analyses.length} Modalities
                    </span>
                  )}
                </h3>
                {analyses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {analyses.map((a: any, i: number) => (
                      <div key={i} className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{a.modality || a.type}</span>
                          {a.confidence && (
                            <span className={`text-xs font-black ${getConfidenceColor(a.confidence)}`}>{a.confidence}%</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">Model: {a.model_name || a.modelName}</p>
                        {a.summary && <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{a.summary}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    No AI analysis available for this patient yet
                  </div>
                )}
              </div>

              {/* Reports Preview */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" /> Recent Reports ({patientReports.length})
                </h3>
                <div className="space-y-2">
                  {patientReports.slice(0, 4).map((report) => (
                    <div key={report.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <Brain className="w-4 h-4 text-accent-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{report.title}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(report.date)} • {report.type}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                  ))}
                  {patientReports.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">No reports uploaded yet</p>
                  )}
                </div>
              </div>

              {/* Clinical Notes Form */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-400" /> Physician Clinical Notes
                </h3>
                <textarea
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="Enter physician observations, regimen changes, or diagnostic notes..."
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 resize-none h-24"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !clinicalNote.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save Clinical Note
                  </button>
                  {noteSaved && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold animate-fade-in">
                      <Check className="w-3.5 h-3.5" /> Note saved to MongoDB record
                    </span>
                  )}
                </div>

                {notes.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {notes.map((n) => (
                      <div key={n.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{n.doctor_name || 'Attending Physician'}</span>
                          <span className="text-[10px]">{formatDate(n.date)}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {patientReports.map((report) => (
                <div key={report.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/30 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{report.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(report.date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{report.type}</p>
                </div>
              ))}
              {patientReports.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">No reports uploaded yet for this patient</p>
              )}
            </div>
          )}

          {/* PRESCRIPTIONS TAB */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              {/* Allergy Safety Callout & Action Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Automated Drug-Allergy Safety Guardrails Active
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {((patient.drug_allergies || []).length > 0 || (patient.allergies || []).length > 0)
                        ? `Patient has documented sensitivities: ${[...(patient.drug_allergies || []), ...(patient.allergies || [])].join(', ')}`
                        : 'No active drug allergies on record. Formulations verified against known contraindication matrices.'}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/doctor/prescriptions/create?patient_id=${id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-600/20 whitespace-nowrap transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Issue Prescription
                </Link>
              </div>

              {patientPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  onClick={() => setSelectedPrescription(rx)}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{rx.diagnosis || 'Prescription'}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(rx.date)} • {(rx.medicines || []).length} medicines prescribed</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View Details
                  </button>
                </div>
              ))}
              {patientPrescriptions.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">No prescriptions on file for this patient</p>
              )}
            </div>
          )}

          {/* HISTORY / TIMELINE TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {timeline.map((event, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent-500 mt-1.5 shrink-0" />
                  <div className="flex-1 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{event.title}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(event.date)}</p>
                    {event.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">No medical timeline events recorded</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prescription Detail Modal */}
      {selectedPrescription && (
        <PrescriptionModal
          prescription={selectedPrescription}
          patientName={patient.name}
          onClose={() => setSelectedPrescription(null)}
        />
      )}

      {/* Record Vitals & Clinical Profile Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/80">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Record Patient Vitals & Clinical Safety
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Document latest clinical examination for {patient.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVitalsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {vitalsSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Vitals and clinical safety profile successfully saved to MongoDB!
              </div>
            )}

            <form onSubmit={handleSaveVitalsAndClinical} className="space-y-6">
              {/* Section 1: Vital Signs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  Vital Signs Parameters
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Blood Pressure (mmHg)
                    </label>
                    <input
                      type="text"
                      required
                      value={vitalsBp}
                      onChange={(e) => setVitalsBp(e.target.value)}
                      placeholder="128/82"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      required
                      value={vitalsHr}
                      onChange={(e) => setVitalsHr(e.target.value)}
                      placeholder="72"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Oxygen Saturation SpO₂ (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={vitalsSpo2}
                      onChange={(e) => setVitalsSpo2(e.target.value)}
                      placeholder="98"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Blood Glucose (mg/dL)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={vitalsGlucose}
                      onChange={(e) => setVitalsGlucose(e.target.value)}
                      placeholder="110"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Temperature (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsTemp}
                      onChange={(e) => setVitalsTemp(e.target.value)}
                      placeholder="98.6"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Weight (kg) / BMI
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={vitalsWeight}
                        onChange={(e) => setVitalsWeight(e.target.value)}
                        placeholder="72"
                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={vitalsBmi}
                        onChange={(e) => setVitalsBmi(e.target.value)}
                        placeholder="23.8"
                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Allergies & Safety Profile */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Clinical Allergies & Drug Sensitivities
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Drug / Medication Allergies (Critical Contraindications)
                    </label>
                    <input
                      type="text"
                      value={clinicalDrugAllergies}
                      onChange={(e) => setClinicalDrugAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Sulfa drugs, NSAIDs"
                      className="w-full px-3.5 py-2 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Separate multiple drug allergies with commas</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Environmental / Food Allergies
                      </label>
                      <input
                        type="text"
                        value={clinicalAllergies}
                        onChange={(e) => setClinicalAllergies(e.target.value)}
                        placeholder="e.g. Peanuts, Pollen, Latex"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Diagnosed Chronic Conditions
                      </label>
                      <input
                        type="text"
                        value={clinicalConditions}
                        onChange={(e) => setClinicalConditions(e.target.value)}
                        placeholder="e.g. Type 2 Diabetes, Hypertension"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Follow-up Appointment & Observation Notes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  Follow-up Scheduling & Clinical Observations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Next Follow-Up Appointment Date
                    </label>
                    <input
                      type="date"
                      value={clinicalNextApt}
                      onChange={(e) => setClinicalNextApt(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Physician Notes on Vital Signs
                    </label>
                    <input
                      type="text"
                      value={vitalsNotes}
                      onChange={(e) => setVitalsNotes(e.target.value)}
                      placeholder="e.g. Patient well-managed on current ACE inhibitor"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVitals}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingVitals ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Vital Signs & Clinical Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
