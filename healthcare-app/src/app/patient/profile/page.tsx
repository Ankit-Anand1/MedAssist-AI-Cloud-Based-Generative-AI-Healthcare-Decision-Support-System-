'use client';

import { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, AlertTriangle, Heart, Shield, Loader2, Edit3, Save, X, CheckCircle2, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function PatientProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Edit fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [drugAllergiesText, setDrugAllergiesText] = useState('');

  const fetchPatient = async () => {
    try {
      const data = await api.get('/api/patients/me');
      setPatient(data);
      if (data) {
        setName(data.name || user?.name || '');
        setAge(data.age ? String(data.age) : '');
        setGender(data.gender || 'Male');
        setBloodGroup(data.blood_group || data.bloodGroup || 'O+');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setEmergencyContact(data.emergency_contact || data.emergencyContact || '');

        const allg = data.allergies || [];
        setAllergiesText(Array.isArray(allg) ? allg.join(', ') : String(allg));

        const drugAllg = data.drug_allergies || [];
        setDrugAllergiesText(Array.isArray(drugAllg) ? drugAllg.join(', ') : String(drugAllg));
      }
    } catch (err) {
      console.error('Failed to load patient profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPatient();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        age: age ? parseInt(age, 10) || age : undefined,
        gender,
        blood_group: bloodGroup,
        phone: phone.trim(),
        address: address.trim(),
        emergency_contact: emergencyContact.trim(),
        allergies: allergiesText ? allergiesText.split(',').map(s => s.trim()).filter(Boolean) : [],
        drug_allergies: drugAllergiesText ? drugAllergiesText.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      // Try /api/patients/me first, fallback to /api/patients/{id}
      let updatedData;
      try {
        updatedData = await api.put('/api/patients/me', payload);
      } catch (meErr) {
        if (patient?.id) {
          updatedData = await api.put(`/api/patients/${patient.id}`, payload);
        } else {
          throw meErr;
        }
      }

      if (updatedData) {
        setPatient(updatedData);
      }

      // Update name in local storage if present
      if (payload.name && typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.name = payload.name;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch (e) {}
      }

      setSavedSuccess(true);
      setEditing(false);
      setTimeout(() => setSavedSuccess(false), 3500);
      fetchPatient();
    } catch (err: any) {
      console.error('Failed to update patient profile:', err);
      alert(err.message || 'Failed to update demographics');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const p = patient || {
    name: user?.name || 'Patient',
    id: user?.id || '—',
    age: '—',
    gender: '—',
    bloodGroup: '—',
    phone: '—',
    email: user?.email || '—',
    address: '—',
    emergencyContact: '—',
    allergies: [],
    conditions: [],
  };

  const displayBloodGroup = p.blood_group || p.bloodGroup || bloodGroup || 'O+';
  const allergies = p.allergies || [];
  const drugAllergies = p.drug_allergies || [];
  const conditions = p.conditions || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('profile')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Verified electronic health identifier and personal demographics
          </p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer w-fit"
        >
          {editing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4 text-cyan-500" />}
          {editing ? 'Cancel Editing' : 'Edit Demographics & Profile'}
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl px-5 py-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">Profile demographics and emergency contact information successfully saved!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 text-center shadow-sm backdrop-blur-sm">
          <div className="w-20 h-20 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-600 dark:text-cyan-400">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{p.name}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {p.id}</p>

          {/* Attending Physician Status */}
          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 text-xs font-semibold text-teal-800 dark:text-teal-300">
            <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Currently under the care of {p.assigned_doctor_name || p.doctor_name || p.doctorName || 'Unassigned — Book a Consultation'}</span>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.age || '—'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Age</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.gender || '—'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Gender</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{displayBloodGroup}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Blood</p>
            </div>
          </div>
        </div>

        {/* Contact Details or Edit Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 text-sm">
            {editing ? 'Update Demographics & Contact Information' : 'Contact & Demographics Information'}
          </h3>

          {editing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 52"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. Sunita Kumar (+91 98765 43211)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="42 Park Avenue, Indiranagar, Bengaluru"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>

                {/* Drug / Medicine Allergies */}
                <div className="md:col-span-2 p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 space-y-1">
                  <label className="block text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Drug & Medication Allergies (Critical Clinical Safety)
                  </label>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Comma-separated list (e.g. Penicillin, Sulfa drugs, Ibuprofen, Aspirin). Automatically triggers real-time physician safety warnings before any prescription is issued.
                  </p>
                  <input
                    type="text"
                    value={drugAllergiesText}
                    onChange={(e) => setDrugAllergiesText(e.target.value)}
                    placeholder="e.g. Penicillin, Amoxicillin, Sulfa"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Environmental & Food Allergies */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Environmental & Food Allergies
                  </label>
                  <input
                    type="text"
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    placeholder="e.g. Dust mites, Pollen, Peanuts, Latex"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('save')} Profile
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Phone, label: 'Phone', value: p.phone || phone },
                { icon: Mail, label: 'Email Address', value: p.email || user?.email },
                { icon: MapPin, label: 'Residential Address', value: p.address || address },
                { icon: Shield, label: 'Emergency Contact', value: p.emergency_contact || p.emergencyContact || emergencyContact },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                  <div className="w-9 h-9 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-800">
                    <item.icon className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">{item.value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medical Info & Allergies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Drug & Medication Allergies */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Drug Allergies</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
              Safety Protected
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Directly cross-checked against doctor prescriptions to prevent adverse reactions.
          </p>
          <div className="flex flex-wrap gap-2">
            {drugAllergies.map((da: string) => (
              <span key={da} className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 text-xs rounded-xl font-bold flex items-center gap-1">
                <span>⚠️</span> {da}
              </span>
            ))}
            {drugAllergies.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No drug allergies on file (NKDA)</p>
            )}
          </div>
        </div>

        {/* Environmental Allergies */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Environmental & Food</h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Non-pharmaceutical allergens (e.g. dust, pollen, peanuts, latex).
          </p>
          <div className="flex flex-wrap gap-2">
            {allergies.map((allergy: string) => (
              <span key={allergy} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs rounded-xl font-semibold">
                {allergy}
              </span>
            ))}
            {allergies.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No environmental allergies logged</p>
            )}
          </div>
        </div>

        {/* Diagnosed Clinical Conditions */}
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-cyan-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Clinical Conditions</h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Chronic diagnoses under active physician management.
          </p>
          <div className="flex flex-wrap gap-2">
            {conditions.map((condition: string) => (
              <span key={condition} className="px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs rounded-xl font-semibold">
                {condition}
              </span>
            ))}
            {conditions.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No chronic medical conditions recorded</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
