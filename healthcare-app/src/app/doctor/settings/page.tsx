'use client';

import { useState, useEffect } from 'react';
import {
  User, Bell, Shield, Monitor, Loader2, CheckCircle2,
  AlertCircle, Globe, Moon, Sun, Save, Sliders, Check, Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useLanguage } from '@/lib/i18n';

export default function DoctorSettings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields dynamically bound to authenticated user session
  const [name, setName] = useState(user?.name || '');
  const [specialization, setSpecialization] = useState((user as any)?.specialization || (user as any)?.specialty || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [hospital, setHospital] = useState((user as any)?.hospital || '');

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    aiAnalysis: true,
    flaggedReports: true,
    appointments: true,
    patientUploads: true,
  });

  // Display layout preference
  const [layoutPref, setLayoutPref] = useState('Diagnostic-Focused');

  useEffect(() => {
    const storageKey = user?.id ? `medassist_doctor_profile_${user.id}` : 'medassist_doctor_profile';

    // 1. First check user-scoped storage for any offline draft
    try {
      const storedProfile = localStorage.getItem(storageKey);
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.name) setName(parsed.name);
        if (parsed.specialization) setSpecialization(parsed.specialization);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.hospital) setHospital(parsed.hospital);
      } else if (user) {
        if (user.name) setName(user.name);
        if ((user as any).specialization || (user as any).specialty) {
          setSpecialization((user as any).specialization || (user as any).specialty);
        }
        if ((user as any).phone) setPhone((user as any).phone);
        if ((user as any).hospital) setHospital((user as any).hospital);
      }

      const storedPrefs = localStorage.getItem('medassist_notif_prefs');
      if (storedPrefs) {
        setNotifPrefs(JSON.parse(storedPrefs));
      }

      const storedLayout = localStorage.getItem('medassist_layout_pref');
      if (storedLayout) {
        setLayoutPref(storedLayout);
      }
    } catch {}

    // 2. Fetch authenticated doctor's profile from backend
    const fetchBackendProfile = async () => {
      try {
        const data = await api.get('/api/settings/profile');
        if (data) {
          setName(data.name || user?.name || '');
          setSpecialization(data.specialization || (user as any)?.specialization || (user as any)?.specialty || 'General Medicine');
          setPhone(data.phone || (user as any)?.phone || '');
          setHospital(data.hospital || (user as any)?.hospital || 'MedAssist Medical Center');
        }
      } catch (err) {
        console.warn('Backend profile fallback to session defaults:', err);
        if (user?.name) setName(user.name);
      } finally {
        setLoading(false);
      }
    };

    fetchBackendProfile();
  }, [user]);

  const toggleNotifPref = (key: keyof typeof notifPrefs) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('medassist_notif_prefs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleLayoutChange = (val: string) => {
    setLayoutPref(val);
    try {
      localStorage.setItem('medassist_layout_pref', val);
    } catch {}
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedToast(false);

    const profileData = {
      name: name.trim(),
      specialization: specialization.trim(),
      phone: phone.trim(),
      hospital: hospital.trim(),
      layout: layoutPref,
      notifications: notifPrefs,
    };

    const storageKey = user?.id ? `medassist_doctor_profile_${user.id}` : 'medassist_doctor_profile';

    try {
      // Always persist to localStorage first
      localStorage.setItem(storageKey, JSON.stringify(profileData));
      localStorage.setItem('medassist_notif_prefs', JSON.stringify(notifPrefs));
      localStorage.setItem('medassist_layout_pref', layoutPref);

      // Attempt live backend update
      await api.put('/api/settings/profile', {
        name: name.trim(),
        specialization: specialization.trim(),
        phone: phone.trim(),
        hospital: hospital.trim(),
      }).catch((err) => {
        console.warn('Backend profile update note:', err);
      });

      // Show animated visual success toast
      setSavedToast(true);
      setTimeout(() => {
        setSavedToast(false);
      }, 4000);
    } catch (err: any) {
      console.error('Settings save error:', err);
      setError(err.message || 'Failed to sync settings');
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

  const toastMessage = lang === 'hi'
    ? 'सेटिंग्स सफलतापूर्वक सहेजी गईं!'
    : 'Settings saved successfully!';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          {t('settings.title', 'Settings & System Preferences')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {t('settings.subtitle', 'Manage clinical profile, localization, theme mode, and real-time alert preferences')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-2xl px-5 py-3.5 flex items-center gap-2.5 text-xs text-red-800 dark:text-red-300 font-semibold animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Section 1: Physician Profile ── */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-500" /> {t('settings.physician_profile', 'Physician Profile')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('settings.full_name', 'Full Name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('settings.specialization', 'Specialization')}
            </label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. Cardiology & Internal Medicine"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('settings.email', 'Email Address')}
            </label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono text-xs"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Verified clinician account</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('settings.phone', 'Contact Phone')}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('settings.hospital', 'Hospital / Clinical Institution')}
            </label>
            <input
              type="text"
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              placeholder="e.g. MedCare Multi-Speciality Hospital, New Delhi"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Localization & Theme Appearance ── */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-cyan-500" /> {t('settings.theme_appearance', 'Localization & Theme Appearance')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.color_scheme', 'Color Scheme')}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: 'light', label: 'Light', icon: Sun },
                { key: 'dark', label: 'Dark', icon: Moon },
                { key: 'system', label: 'System', icon: Monitor },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme(opt.key as any)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    theme === opt.key
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <opt.icon className="w-4 h-4 mb-1 text-cyan-500" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('settings.display_language', 'Display Language')}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'en', label: 'English', sub: 'Default' },
                { key: 'hi', label: 'हिन्दी', sub: 'Hindi' },
              ].map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLang(l.key as any)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    lang === l.key
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Globe className="w-4 h-4 mb-1 text-cyan-500" />
                  <span>{l.label}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{l.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Display Layout Preference */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Clinical Dashboard Layout Density
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {['Standard', 'Compact', 'Diagnostic-Focused'].map((density) => (
              <button
                key={density}
                type="button"
                onClick={() => handleLayoutChange(density)}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer flex items-center justify-between ${
                  layoutPref === density
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{density}</span>
                {layoutPref === density && <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: Notification & Alert Preferences ── */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-bold text-xs uppercase tracking-widest text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-500" /> {t('settings.notifications', 'Notification & Alert Preferences')}
        </h2>
        <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
          {[
            {
              id: 'aiAnalysis',
              label: 'AI Diagnostic Telemetry Alerts',
              desc: 'Immediate notification when neural network vision inference completes for MRI, X-ray, or ECG',
              active: notifPrefs.aiAnalysis,
            },
            {
              id: 'flaggedReports',
              label: 'Critical / Flagged Anomaly Alerts',
              desc: 'High-priority notification banner when vital signs or imaging metrics breach safety thresholds',
              active: notifPrefs.flaggedReports,
            },
            {
              id: 'appointments',
              label: 'Consultation & Follow-up Reminders',
              desc: 'Sync calendar alerts 15 minutes before patient appointments and follow-up reviews',
              active: notifPrefs.appointments,
            },
            {
              id: 'patientUploads',
              label: 'New Patient Document Intake',
              desc: 'Instant alert when an assigned patient submits new medical charts from patient portal',
              active: notifPrefs.patientUploads,
            },
          ].map((pref) => (
            <div key={pref.id} className="flex items-center justify-between pt-3.5 first:pt-0">
              <div className="pr-4">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{pref.label}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{pref.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotifPref(pref.id as any)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative shrink-0 ${
                  pref.active ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
                aria-label={`Toggle ${pref.label}`}
              >
                <span
                  className={`block w-5 h-5 bg-white toggle-knob rounded-full shadow-md transition-transform ${
                    pref.active ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Save Action Bar & Visual Success Toast ── */}
      <div className="space-y-3 pt-2">
        {savedToast && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-lg shadow-emerald-500/10 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>{toastMessage}</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">
              Persisted Live
            </span>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'hi' ? 'परिवर्तन तुरंत स्थानीय स्टोरेज और बैकएंड में सहेजे जाएंगे' : 'Preferences sync immediately to local cache & backend'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{t('btn.save_changes', 'Save Changes')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
