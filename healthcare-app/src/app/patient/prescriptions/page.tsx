'use client';

import { useState, useEffect } from 'react';
import { Pill, Calendar, Clock, FileText, ChevronDown, ChevronUp, Loader2, Printer, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPrescriptions = async () => {
      try {
        const data = await api.get('/api/prescriptions');
        if (Array.isArray(data)) {
          setPrescriptions(data);
          if (data.length > 0) {
            setExpanded(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load prescriptions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrescriptions();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('prescriptions')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Active and past medications, dosages, and clinician regimen instructions
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer w-fit"
        >
          <Printer className="w-4 h-4" /> Print Current Regimen
        </button>
      </div>

      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <div key={rx.id} className="medical-glass-card shadow-2xl overflow-hidden">
            {/* Header / Accordion Trigger */}
            <button
              onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}
              className="w-full flex items-center justify-between px-6 py-4.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  rx.status === 'Active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Prescription #{rx.id} — {formatDate(rx.date)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Prescribed by {rx.doctor_name || rx.doctorName || 'Dr. Priya Sharma'} • {rx.diagnosis}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(rx.status)}`}>
                  {rx.status}
                </span>
                {expanded === rx.id ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {expanded === rx.id && (
              <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-800/80 animate-fade-in">
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Prescribed Medications & Posology
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Medicine Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Dosage</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Frequency</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Duration</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(rx.medicines || []).map((med: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{med.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{med.dosage}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{med.frequency}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{med.duration}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{med.instructions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Doctor Notes */}
                {rx.notes && (
                  <div className="mt-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Physician Dietary & Care Notes
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{rx.notes}</p>
                  </div>
                )}

                {/* Follow-up */}
                {(rx.follow_up_date || rx.followUpDate) && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar className="w-4 h-4 text-cyan-500" />
                    <span>Follow-up Review: <strong className="text-slate-900 dark:text-slate-100">{formatDate(rx.follow_up_date || rx.followUpDate)}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {prescriptions.length === 0 && (
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Pill className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No prescriptions recorded</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Prescriptions issued by your doctor will automatically appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
