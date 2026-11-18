'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Loader2, Plus, X,
  CheckCircle2, Stethoscope
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

interface DoctorOption {
  id: string;
  _id?: string;
  name: string;
  specialization?: string;
  specialty?: string;
  qualification?: string;
  hospital?: string;
  experience?: number;
  email?: string;
  phone?: string;
}

interface AppointmentItem {
  id: string;
  patient_id?: string;
  doctor_id?: string;
  doctor_name?: string;
  doctorName?: string;
  date: string;
  time: string;
  type: string;
  status: string;
  notes?: string;
}

const DEFAULT_DOCTOR: DoctorOption = {
  id: 'default_dr_priya',
  name: 'Dr. Priya Sharma',
  specialization: 'Cardiology & Internal Medicine',
  hospital: 'MedAssist Medical Center',
};

export default function PatientAppointments() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([DEFAULT_DOCTOR]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(DEFAULT_DOCTOR.id);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00 AM');
  const [type, setType] = useState('Consultation');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await api.get('/api/appointments');
      if (Array.isArray(data)) {
        setAppointments(data as AppointmentItem[]);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      const data = await api.get('/api/doctors');
      if (Array.isArray(data) && data.length > 0) {
        setDoctors(data as DoctorOption[]);
        setSelectedDoctorId((prev) => prev && prev !== 'default_dr_priya' ? prev : (data[0].id || data[0]._id || ''));
      }
    } catch (err) {
      console.error('Failed to load doctors list:', err);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (!user) return;

    const loadAll = async () => {
      try {
        const [aptsRes, docsRes] = await Promise.allSettled([
          api.get('/api/appointments'),
          api.get('/api/doctors'),
        ]);

        if (!ignore) {
          if (aptsRes.status === 'fulfilled' && Array.isArray(aptsRes.value)) {
            setAppointments(aptsRes.value as AppointmentItem[]);
          }
          if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) && docsRes.value.length > 0) {
            setDoctors(docsRes.value as DoctorOption[]);
            setSelectedDoctorId(docsRes.value[0].id || docsRes.value[0]._id || DEFAULT_DOCTOR.id);
          }
        }
      } catch (err) {
        if (!ignore) console.error('Error fetching data:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadAll();

    return () => {
      ignore = true;
    };
  }, [user]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    try {
      const selectedDoc =
        doctors.find((d) => (d.id || d._id) === selectedDoctorId) || doctors[0] || DEFAULT_DOCTOR;
      const docName = selectedDoc?.name || 'Dr. Priya Sharma';
      const docId = selectedDoc?.id || selectedDoc?._id || selectedDoctorId;

      await api.post('/api/appointments', {
        patient_id: '',
        doctor_id: docId,
        doctor_name: docName,
        date,
        time,
        type,
        notes,
      });

      setShowModal(false);
      setFeedback(`Appointment scheduled successfully with ${docName}!`);
      setTimeout(() => setFeedback(null), 5000);
      await fetchAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to book appointment';
      console.error('Failed to book appointment:', err);
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (aptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.put(`/api/appointments/${aptId}`, { status: 'Cancelled' });
      await fetchAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment';
      alert(msg);
    }
  };

  const selectedDoctor =
    doctors.find((d) => (d.id || d._id) === selectedDoctorId) || doctors[0] || DEFAULT_DOCTOR;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const upcoming = appointments.filter(
    (a) => a.status === 'Scheduled' || a.status === 'In Progress'
  );
  const past = appointments.filter(
    (a) => a.status === 'Completed' || a.status === 'Cancelled'
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('appointments')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Schedule and manage clinical appointments with your healthcare team
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            if (doctors.length <= 1) {
              fetchDoctors();
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-600/20 transition-all cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" /> Book Consultation
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl px-5 py-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{feedback}</p>
        </div>
      )}

      {/* Upcoming Consultations */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
          Upcoming Consultations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcoming.map((apt) => (
            <div
              key={apt.id}
              className="medical-glass-card p-6 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getStatusColor(
                      apt.status
                    )}`}
                  >
                    {apt.status}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-semibold">
                    {apt.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {apt.doctor_name || apt.doctorName || 'Dr. Priya Sharma'}
                  </h3>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-cyan-500" />
                    <span>{formatDate(apt.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-cyan-500" />
                    <span>{apt.time}</span>
                  </div>
                </div>
                {apt.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {apt.notes}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleCancelAppointment(apt.id)}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors cursor-pointer"
                >
                  Cancel Appointment
                </button>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="col-span-full bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No upcoming consultations
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click &apos;Book Consultation&apos; above to schedule a clinical visit
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Past Consultations */}
      {past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
            Past Consultations
          </h2>
          <div className="medical-glass-card shadow-2xl overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {past.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {apt.doctor_name || apt.doctorName || 'Dr. Priya Sharma'} — {apt.type}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(apt.date)} at {apt.time}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getStatusColor(
                      apt.status
                    )}`}
                  >
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="medical-glass-card max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              Book Clinical Consultation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Select your attending physician and choose an available consultation time
            </p>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              {/* Dynamic Doctor Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Select Attending Physician
                </label>
                <div className="relative">
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-medium"
                  >
                    {doctors.map((doc) => {
                      const docId = doc.id || doc._id || '';
                      const spec = doc.specialization || doc.specialty || 'General Medicine';
                      const hosp = doc.hospital || 'MedAssist Medical Center';
                      return (
                        <option key={docId} value={docId}>
                          {doc.name} — {spec} ({hosp})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Doctor Summary Card */}
                {selectedDoctor && (
                  <div className="mt-2.5 p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 flex items-center justify-between text-xs text-teal-900 dark:text-teal-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {selectedDoctor.name}
                        </p>
                        <p className="text-[11px] text-teal-700 dark:text-teal-300">
                          {selectedDoctor.specialization || selectedDoctor.specialty || 'General Medicine'} • {selectedDoctor.hospital || 'MedAssist Medical Center'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-teal-200/60 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                      Available
                    </span>
                  </div>
                )}
              </div>

              {/* Appointment Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Appointment Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="Consultation">Clinical Consultation</option>
                  <option value="Follow-up">Follow-up Review</option>
                  <option value="Report Review">Diagnostic Report Review</option>
                  <option value="Emergency">Emergency Consultation</option>
                </select>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Time Slot
                  </label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                  </select>
                </div>
              </div>

              {/* Reason / Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Reason / Symptoms
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe your current symptoms or reason for visit..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
