'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pill, Filter, Loader2, Eye, Printer, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getInitials } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal';

export default function DoctorPrescriptions() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPrescriptionsAndPatients = async () => {
      try {
        const [rxData, patientsData] = await Promise.all([
          api.get('/api/prescriptions'),
          api.get('/api/patients'),
        ]);
        setPrescriptions(Array.isArray(rxData) ? rxData : []);
        setPatients(Array.isArray(patientsData) ? patientsData : []);
      } catch (err) {
        console.error('Failed to load prescriptions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrescriptionsAndPatients();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  const selectedPatient = selectedPrescription
    ? patients.find(p => p.id === (selectedPrescription.patient_id || selectedPrescription.patientId))
    : null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('nav.prescriptions', 'Prescriptions')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage and issue clinical prescriptions with drug safety cross-checks
          </p>
        </div>
        <Link
          href="/doctor/prescriptions/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-accent-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('btn.new_prescription', 'New Prescription')}
        </Link>
      </div>

      <div className="medical-glass-card overflow-hidden shadow-2xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              <th className="px-6 py-3.5">Patient</th>
              <th className="px-6 py-3.5">Date</th>
              <th className="px-6 py-3.5">Diagnosis</th>
              <th className="px-6 py-3.5">Medicines</th>
              <th className="px-6 py-3.5">Follow-up</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {prescriptions.map((rx) => {
              const pId = rx.patient_id || rx.patientId;
              const patient = patients.find(p => p.id === pId);
              const pName = patient?.name || 'Patient';
              const medCount = (rx.medicines || []).length;
              const followUp = rx.follow_up_date || rx.followUpDate;

              return (
                <tr
                  key={rx.id}
                  onClick={() => setSelectedPrescription(rx)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-accent-100 dark:bg-accent-950/60 rounded-full flex items-center justify-center text-xs font-bold text-accent-700 dark:text-accent-300 shrink-0">
                        {getInitials(pName)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                          {pName}
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{pId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                    {formatDate(rx.date)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                    {rx.diagnosis}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                      {medCount} {medCount === 1 ? 'medicine' : 'medicines'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                    {formatDate(followUp)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(rx.status)}`}>
                      {rx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrescription(rx);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-accent-50 dark:hover:bg-accent-950/60 text-slate-700 dark:text-slate-300 hover:text-accent-600 dark:hover:text-accent-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </td>
                </tr>
              );
            })}
            {prescriptions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                  <Pill className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  No prescriptions recorded yet. Click &quot;New Prescription&quot; to issue one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Prescription Detail Modal */}
      {selectedPrescription && (
        <PrescriptionModal
          prescription={selectedPrescription}
          patientName={selectedPatient?.name}
          doctorName={user?.name}
          onClose={() => setSelectedPrescription(null)}
        />
      )}
    </div>
  );
}
