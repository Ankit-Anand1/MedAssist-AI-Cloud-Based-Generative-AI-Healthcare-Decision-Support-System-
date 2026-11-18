'use client';

import React from 'react';
import { X, Pill, Printer, Calendar, User, FileText, CheckCircle2, Clock } from 'lucide-react';
import { formatDate, getStatusColor } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface PrescriptionModalProps {
  prescription: any | null;
  patientName?: string;
  doctorName?: string;
  onClose: () => void;
}

export default function PrescriptionModal({
  prescription,
  patientName,
  doctorName,
  onClose,
}: PrescriptionModalProps) {
  const { t } = useLanguage();

  if (!prescription) return null;

  const pName = patientName || prescription.patient_name || prescription.patientName || 'Patient';
  const dName = doctorName || prescription.doctor_name || prescription.doctorName || 'Attending Physician';
  const medicines: Medicine[] = prescription.medicines || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/80 dark:border-slate-800/80 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Official Clinical Prescription
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Issued on {formatDate(prescription.date)} • ID: {prescription.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prescription Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Patient</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{pName}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Prescribing Doctor</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{dName}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Status</p>
              <span className={`inline-block mt-0.5 text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getStatusColor(prescription.status)}`}>
                {prescription.status || 'Active'}
              </span>
            </div>
          </div>

          {/* Clinical Diagnosis */}
          {prescription.diagnosis && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Clinical Diagnosis
              </h4>
              <div className="p-3.5 bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 rounded-xl">
                <p className="text-sm font-medium text-violet-950 dark:text-violet-200">
                  {prescription.diagnosis}
                </p>
              </div>
            </div>
          )}

          {/* Prescribed Medications */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Prescribed Medications ({medicines.length})
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Dosage</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Special Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {medicines.map((med, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {med.name}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                        {med.dosage}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {med.frequency}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {med.duration}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 italic">
                        {med.instructions || '—'}
                      </td>
                    </tr>
                  ))}
                  {medicines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No specific medicines listed
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Physician Notes */}
          {prescription.notes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Physician Instructions &amp; Dietary Advice
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
                {prescription.notes}
              </p>
            </div>
          )}

          {/* Follow-up Date */}
          {(prescription.follow_up_date || prescription.followUpDate) && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                Recommended Clinical Follow-up: <strong>{formatDate(prescription.follow_up_date || prescription.followUpDate)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            MedAssist AI Clinical Decision Support • Validated by Registered Physician
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {t('btn.print', 'Print Prescription')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {t('btn.close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
