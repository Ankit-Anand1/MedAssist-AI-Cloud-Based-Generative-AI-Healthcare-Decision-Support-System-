'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, Loader2, Plus, CheckCircle2, AlertCircle, X, Check, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getInitials } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function DoctorAppointments() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('');
  const [aptType, setAptType] = useState('Consultation');
  const [aptNotes, setAptNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [aptData, patientsData] = await Promise.all([
        api.get('/api/appointments'),
        api.get('/api/patients'),
      ]);
      setAppointments(Array.isArray(aptData) ? aptData : []);
      const pts = Array.isArray(patientsData) ? patientsData : [];
      setPatients(pts);
      if (pts.length > 0 && !selectedPatientId) setSelectedPatientId(pts[0].id);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const handleCreateAppointment = async () => {
    if (!selectedPatientId || !aptDate || !aptTime) {
      setError('Please fill in patient, date, and time');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const newApt = await api.post('/api/appointments', {
        patient_id: selectedPatientId,
        date: aptDate,
        time: aptTime,
        type: aptType,
        notes: aptNotes.trim(),
      });
      setAppointments(prev => [newApt, ...prev]);
      setFeedback('Appointment scheduled successfully!');
      setShowForm(false);
      setAptDate('');
      setAptTime('');
      setAptNotes('');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: 'Completed' | 'Cancelled') => {
    setActionInProgress(appointmentId);
    try {
      await api.put(`/api/appointments/${appointmentId}`, {
        status: newStatus,
      });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));
      setFeedback(`Appointment marked as ${newStatus}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update appointment status');
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  const upcoming = appointments.filter(a => {
    const st = (a.status || '').toLowerCase();
    return st === 'scheduled' || st === 'in progress' || st === 'pending';
  });
  const completed = appointments.filter(a => {
    const st = (a.status || '').toLowerCase();
    return st === 'completed' || st === 'cancelled';
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('nav.appointments', 'Appointments')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage patient consultations, follow-ups, and review schedules
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-accent-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('btn.new_appointment', 'New Appointment')}
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-3 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-5 py-3 flex items-center gap-2.5 text-xs text-red-800 dark:text-red-300 font-semibold animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Create Appointment Form */}
      {showForm && (
        <div className="medical-glass-card p-6 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-white">
              Schedule New Consultation
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.name}</option>
                ))}
                {patients.length === 0 && <option value="">No patients available</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
              <input
                type="date"
                value={aptDate}
                onChange={(e) => setAptDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Time</label>
              <input
                type="time"
                value={aptTime}
                onChange={(e) => setAptTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
              <select
                value={aptType}
                onChange={(e) => setAptType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 cursor-pointer"
              >
                <option className="dark:bg-slate-900">Consultation</option>
                <option className="dark:bg-slate-900">Follow-up</option>
                <option className="dark:bg-slate-900">Report Review</option>
                <option className="dark:bg-slate-900">Emergency</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Clinical Notes</label>
            <input
              type="text"
              value={aptNotes}
              onChange={(e) => setAptNotes(e.target.value)}
              placeholder="Brief clinical focus or consultation notes..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
            />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAppointment}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-accent-600/20 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Schedule Consultation
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Table with Interactive Action Buttons */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-accent-500" />
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            Upcoming Consultations ({upcoming.length})
          </h2>
        </div>

        <div className="medical-glass-card overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="px-6 py-3.5">Patient</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Time</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {upcoming.map((apt) => {
                const pId = apt.patient_id || apt.patientId;
                const pName = apt.patient_name || apt.patientName || 'Patient';
                const isUpdating = actionInProgress === apt.id;

                return (
                  <tr key={apt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-accent-100 dark:bg-accent-950/60 rounded-full flex items-center justify-center text-xs font-bold text-accent-700 dark:text-accent-300 shrink-0">
                          {getInitials(pName)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{pName}</span>
                          <p className="text-[10px] text-slate-400">{apt.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{formatDate(apt.date)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{apt.time}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        apt.type === 'Follow-up' ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' :
                        apt.type === 'Report Review' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                        apt.type === 'Consultation' ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' : 'bg-red-50 text-red-700'
                      }`}>{apt.type}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{apt.notes || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Live Mark Complete button */}
                        <button
                          onClick={() => handleUpdateStatus(apt.id, 'Completed')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Mark Consultation Completed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('btn.complete_apt', 'Complete')}</span>
                        </button>
                        {/* Cancel Appointment button */}
                        <button
                          onClick={() => handleUpdateStatus(apt.id, 'Cancelled')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Cancel Consultation"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                        <Link
                          href={`/doctor/patients/${pId}`}
                          className="text-accent-600 dark:text-accent-400 hover:underline text-xs font-semibold ml-1"
                        >
                          Patient →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-400 dark:text-slate-500">
                    No upcoming consultations scheduled
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completed History Table */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              Consultation History ({completed.length})
            </h2>
          </div>
          <div className="medical-glass-card overflow-hidden shadow-2xl">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {completed.map((apt) => {
                const pName = apt.patient_name || apt.patientName || 'Patient';
                return (
                  <div key={apt.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                        {getInitials(pName)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{pName}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(apt.date)} • {apt.time} • {apt.type}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
