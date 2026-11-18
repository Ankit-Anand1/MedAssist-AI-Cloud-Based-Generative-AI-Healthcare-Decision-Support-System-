'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, Filter, ChevronRight, Users, Loader2, UserPlus, X,
  CheckCircle2, AlertCircle, Phone, Mail, MapPin, Heart
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getStatusColor, getInitials } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function DoctorPatients() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Add Patient Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: 'Male',
    blood_group: 'O+',
    phone: '',
    address: '',
    emergency_contact: '',
    conditions: '',
    allergies: '',
  });

  const fetchPatients = async () => {
    try {
      const data = await api.get('/api/patients');
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPatients();
  }, [user]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setSubmitError('Name and email are required');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        age: parseInt(formData.age, 10) || 0,
        gender: formData.gender,
        blood_group: formData.blood_group,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        emergency_contact: formData.emergency_contact.trim(),
        conditions: formData.conditions ? formData.conditions.split(',').map(c => c.trim()).filter(Boolean) : [],
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
      };

      const newPatient = await api.post('/api/patients', payload);
      setPatients(prev => [newPatient, ...prev]);
      setSubmitSuccess(true);
      setTimeout(() => {
        setShowAddModal(false);
        setSubmitSuccess(false);
        setFormData({
          name: '',
          email: '',
          age: '',
          gender: 'Male',
          blood_group: 'O+',
          phone: '',
          address: '',
          emergency_contact: '',
          conditions: '',
          allergies: '',
        });
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  const filtered = patients.filter(p => {
    const name = p.name || '';
    const id = p.id || '';
    const status = p.status || 'Active';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('nav.patients', 'Patient Roster')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {patients.length === 1 ? '1 active patient under your care panel' : `${patients.length} active patients under your care panel`}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-accent-600/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {t('btn.add_patient', 'Add Patient')}
        </button>
      </div>

      {/* Search & Filter */}
      {patients.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search patients by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {['All', 'Active', 'Follow-up Due', 'Stable'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === status
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Patient Table */}
      <div className="medical-glass-card overflow-hidden shadow-2xl">
        {patients.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No patients under your care yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Onboard a patient to your care panel to start uploading records and utilizing AI decision support.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-accent-600 text-white text-xs font-bold rounded-xl hover:bg-accent-700 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Onboard First Patient
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="px-6 py-3.5">Patient</th>
                  <th className="px-6 py-3.5">Age / Gender</th>
                  <th className="px-6 py-3.5">Conditions</th>
                  <th className="px-6 py-3.5">Last Visit</th>
                  <th className="px-6 py-3.5">Next Appointment</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((patient) => {
                  const conditions = patient.conditions || [];
                  const lastVisit = patient.last_visit || patient.lastVisit;
                  const nextApt = patient.next_appointment || patient.nextAppointment;

                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/doctor/patients/${patient.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 bg-accent-100 dark:bg-accent-950/60 rounded-full flex items-center justify-center text-xs font-bold text-accent-700 dark:text-accent-300 shrink-0">
                            {getInitials(patient.name)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                              {patient.name}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{patient.email || patient.id}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
                        {patient.age > 0 ? `${patient.age}y` : '—'} / {patient.gender || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {conditions.slice(0, 2).map((c: string) => (
                            <span key={c} className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 font-semibold">{c}</span>
                          ))}
                          {conditions.length > 2 && (
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">+{conditions.length - 2}</span>
                          )}
                          {conditions.length === 0 && <span className="text-xs text-slate-400 italic">None recorded</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatDate(lastVisit)}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatDate(nextApt)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusColor(patient.status || 'Active')}`}>
                          {patient.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/doctor/patients/${patient.id}`} className="text-accent-600 dark:text-accent-400 hover:underline font-bold text-xs inline-flex items-center gap-1">
                          View Record <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-950/60 text-accent-600 dark:text-accent-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Onboard New Patient</h3>
                  <p className="text-xs text-slate-400">Add a patient profile to your care panel</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Patient Onboarded!</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">The patient has been assigned to your care panel.</p>
              </div>
            ) : (
              <form onSubmit={handleCreatePatient} className="mt-4 space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Verma"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="patient@example.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age</label>
                    <input
                      type="number"
                      placeholder="42"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    >
                      <option className="dark:bg-slate-900">Male</option>
                      <option className="dark:bg-slate-900">Female</option>
                      <option className="dark:bg-slate-900">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                    <select
                      value={formData.blood_group}
                      onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    >
                      <option className="dark:bg-slate-900">A+</option>
                      <option className="dark:bg-slate-900">A-</option>
                      <option className="dark:bg-slate-900">B+</option>
                      <option className="dark:bg-slate-900">B-</option>
                      <option className="dark:bg-slate-900">O+</option>
                      <option className="dark:bg-slate-900">O-</option>
                      <option className="dark:bg-slate-900">AB+</option>
                      <option className="dark:bg-slate-900">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      placeholder="Name / Relationship / Phone"
                      value={formData.emergency_contact}
                      onChange={e => setFormData({ ...formData, emergency_contact: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Active Conditions (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension, Type 2 Diabetes"
                    value={formData.conditions}
                    onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Known Allergies (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Aspirin"
                    value={formData.allergies}
                    onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-accent-600 hover:bg-accent-700 rounded-xl transition-all shadow-md shadow-accent-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {submitting ? 'Onboarding...' : 'Onboard Patient'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
