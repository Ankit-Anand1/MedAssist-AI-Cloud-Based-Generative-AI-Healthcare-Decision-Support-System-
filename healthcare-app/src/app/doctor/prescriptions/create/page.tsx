'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Pill, Plus, Trash2, Save, FileText, Calendar, Stethoscope, CheckCircle2,
  Loader2, AlertCircle, ArrowLeft, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { checkDrugContraindications, AllergyConflict } from '@/lib/allergyChecker';
import ContraindicationAlertBanner from '@/components/prescriptions/ContraindicationAlertBanner';

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

function CreatePrescriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams?.get('patient_id') || '';

  const { user } = useAuth();
  const { t } = useLanguage();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medicines, setMedicines] = useState<MedicineRow[]>([
    { name: '', dosage: '', frequency: 'Once daily', duration: '30 days', instructions: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contraindication Override State
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const data = await api.get('/api/patients');
        if (Array.isArray(data) && data.length > 0) {
          setPatients(data);
          if (preselectedPatientId && data.some(p => p.id === preselectedPatientId)) {
            setSelectedPatientId(preselectedPatientId);
          } else if (!selectedPatientId) {
            setSelectedPatientId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load patients for prescription:', err);
      }
    };
    fetchPatients();
  }, [preselectedPatientId]);

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Real-time Contraindication Cross-check
  const allergyConflicts = useMemo(() => {
    if (!selectedPatient) return [];
    return checkDrugContraindications(medicines, selectedPatient);
  }, [medicines, selectedPatient]);

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: 'Once daily', duration: '30 days', instructions: '' }]);
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index: number, field: keyof MedicineRow, value: string) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSave = async () => {
    if (!selectedPatientId) {
      setError('Please select a patient');
      return;
    }
    if (!diagnosis.trim()) {
      setError('Please enter a clinical diagnosis');
      return;
    }
    const validMeds = medicines.filter(m => m.name.trim());
    if (validMeds.length === 0) {
      setError('Please add at least one medicine with a name');
      return;
    }

    // Safety Gate: Block if contraindication detected without override
    if (allergyConflicts.length > 0 && !overrideChecked) {
      setError('Critical Contraindication: Prescribing restricted until physician override is confirmed.');
      return;
    }
    if (allergyConflicts.length > 0 && overrideChecked && !overrideReason.trim()) {
      setError('Please enter clinical override justification notes before issuing prescription.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalNotes = allergyConflicts.length > 0
        ? `${notes ? notes + '\n\n' : ''}[PHYSICIAN CONTRAINDICATION OVERRIDE: ${overrideReason.trim()}]`
        : notes.trim();

      await api.post('/api/prescriptions', {
        patient_id: selectedPatientId,
        diagnosis: diagnosis.trim(),
        medicines: validMeds,
        notes: finalNotes,
        follow_up_date: followUpDate || undefined,
      });

      setSaved(true);
      setTimeout(() => {
        router.push('/doctor/prescriptions');
      }, 1200);
    } catch (err: any) {
      console.error('Failed to save prescription:', err);
      setError(err.message || 'Failed to save prescription');
    } finally {
      setLoading(false);
    }
  };

  const doctorName = user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Dr. Priya Sharma';

  // Extract patient allergies for display badge
  const displayAllergies = useMemo(() => {
    if (!selectedPatient) return [];
    const list: string[] = [];
    if (Array.isArray(selectedPatient.allergies)) list.push(...selectedPatient.allergies);
    if (Array.isArray(selectedPatient.drug_allergies)) list.push(...selectedPatient.drug_allergies);
    return list.filter(a => a && a.toLowerCase() !== 'none' && a.toLowerCase() !== 'n/a');
  }, [selectedPatient]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/doctor/prescriptions"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('newPrescription')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Issue verified medications, dosages, and regimen instructions with real-time allergy cross-checks</p>
          </div>
        </div>
      </div>

      {saved && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl px-5 py-3 flex items-center gap-2 animate-fade-in text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium">Prescription issued and synced to patient records! Redirecting...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl px-5 py-3 flex items-center gap-2 animate-fade-in text-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Patient & Doctor Info */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-cyan-500" />
          Patient & Physician Context
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t('patient')}</label>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                setOverrideChecked(false);
                setOverrideReason('');
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {p.name} ({p.id}) — {p.age}y, {p.gender}
                </option>
              ))}
            </select>

            {/* Known Allergies Preview Badge */}
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documented Allergies:</span>
                {displayAllergies.length > 0 ? (
                  displayAllergies.map((allg, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                    >
                      {allg}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    No known drug allergies (NKDA)
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Attending Physician</label>
            <input
              type="text"
              value={doctorName}
              readOnly
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 cursor-not-allowed"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Primary Clinical Diagnosis *</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Type 2 Diabetes Mellitus with mild neuropathy, Essential Hypertension..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Contraindication Alert Banner */}
      {allergyConflicts.length > 0 && (
        <ContraindicationAlertBanner
          conflicts={allergyConflicts}
          overrideChecked={overrideChecked}
          onOverrideChange={setOverrideChecked}
          overrideReason={overrideReason}
          onOverrideReasonChange={setOverrideReason}
        />
      )}

      {/* Medicines */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-500" />
              Pharmaceutical Formulations & Dosing
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Real-time contraindication engine actively scans entered medication names</p>
          </div>
          <button
            onClick={addMedicine}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/40 border border-cyan-200 dark:border-cyan-800/60 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Drug
          </button>
        </div>

        <div className="space-y-4">
          {medicines.map((med, index) => {
            const hasConflict = allergyConflicts.some(c => c.medicineName.toLowerCase() === med.name.trim().toLowerCase());

            return (
              <div
                key={index}
                className={`border rounded-xl p-4 transition-all ${
                  hasConflict
                    ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Medicine #{index + 1}</span>
                    {hasConflict && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Allergy Conflict
                      </span>
                    )}
                  </div>
                  {medicines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMedicine(index)}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remove medicine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Drug Name</label>
                    <input
                      type="text"
                      value={med.name}
                      onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                      placeholder="e.g. Amoxicillin, Metformin, Bactrim..."
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                        hasConflict
                          ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-cyan-500/20 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                      placeholder="e.g. 500 mg"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Frequency</label>
                    <select
                      value={med.frequency}
                      onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    >
                      <option value="Once daily">Once daily</option>
                      <option value="Twice daily">Twice daily</option>
                      <option value="Three times daily">Three times daily</option>
                      <option value="Every 8 hours">Every 8 hours</option>
                      <option value="As needed (PRN)">As needed (PRN)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Duration</label>
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                      placeholder="e.g. 30 days"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Instructions</label>
                    <input
                      type="text"
                      value={med.instructions}
                      onChange={(e) => updateMedicine(index, 'instructions', e.target.value)}
                      placeholder="e.g. Take with dinner"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes & Follow-up */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">Clinical Instructions & Review Schedule</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Doctor&apos;s Notes / Dietary Precautions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Maintain adequate hydration, avoid high-sodium meals, monitor fasting blood glucose daily..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none h-24"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Next Recommended Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={loading || saved || (allergyConflicts.length > 0 && !overrideChecked)}
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            allergyConflicts.length > 0 && !overrideChecked
              ? 'bg-slate-400'
              : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
          }`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('save')} Prescription
        </button>
        <button
          onClick={handleSave}
          disabled={loading || saved || (allergyConflicts.length > 0 && !overrideChecked)}
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            allergyConflicts.length > 0 && !overrideChecked
              ? 'bg-slate-400'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Finalize & Approve
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FileText className="w-4 h-4" /> Print Preview
        </button>
      </div>
    </div>
  );
}

export default function CreatePrescription() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    }>
      <CreatePrescriptionForm />
    </Suspense>
  );
}
