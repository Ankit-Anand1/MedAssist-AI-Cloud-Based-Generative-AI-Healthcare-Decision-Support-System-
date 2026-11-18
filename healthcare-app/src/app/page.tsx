'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Stethoscope, User, Mail, Lock, UserPlus,
  ArrowRight, Sun, Moon, AlertCircle, Loader2, Brain,
  HeartPulse, FlaskConical, FileText, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, register } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [activePortal, setActivePortal] = useState<'doctor' | 'patient'>('doctor');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('General Medicine');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const mounted = useMounted();

  // Patient Intake Registration State
  const [doctorsList, setDoctorsList] = useState<Array<{ id: string; name: string; specialization?: string }>>([
    { id: 'dr_priya', name: 'Dr. Priya Sharma', specialization: 'Cardiology & Internal Medicine' },
    { id: 'dr_amit', name: 'Dr. Amit Kumar', specialization: 'General Medicine' },
    { id: 'dr_anita', name: 'Dr. Anita Desai', specialization: 'Neurology' },
  ]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Other');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [allergies, setAllergies] = useState('');

  // Fetch registered doctors list
  useEffect(() => {
    api.get<Array<{ id: string; name: string; specialization?: string }>>('/api/doctors')
      .then((docs) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setDoctorsList(docs);
          if (!selectedDoctorId) {
            setSelectedDoctorId(docs[0].id);
          }
        }
      })
      .catch(() => {});
  }, [selectedDoctorId]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'doctor') router.push('/doctor/dashboard');
      else router.push('/patient/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    const trimmedName = name.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter your email and password.');
      return;
    }

    if (isRegisterMode) {
      if (!trimmedName || trimmedName.length < 2) {
        setError('Please enter your full legal name.');
        return;
      }
      if (trimmedPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        let extraPayload: Record<string, unknown> = {};
        if (activePortal === 'doctor') {
          extraPayload = {
            specialty: specialty.trim() || 'General Medicine',
            specialization: specialty.trim() || 'General Medicine',
            qualification: 'MBBS, MD',
            hospital: 'MedAssist Medical Center',
          };
        } else {
          const selectedDoc = doctorsList.find(d => d.id === selectedDoctorId) || doctorsList[0];
          extraPayload = {
            age: age ? parseInt(age, 10) : 0,
            gender: gender || 'Other',
            blood_group: bloodGroup.trim(),
            phone: phone.trim(),
            allergies: allergies.trim(),
            assigned_doctor_id: selectedDoc ? selectedDoc.id : '',
            assigned_doctor_name: selectedDoc ? selectedDoc.name : '',
          };
        }

        const authUser = await register(trimmedName, trimmedEmail, trimmedPassword, activePortal, extraPayload);
        if (authUser?.role === 'doctor') {
          router.push('/doctor/dashboard');
        } else {
          router.push('/patient/dashboard');
        }
      } else {
        const authUser = await login(trimmedEmail, trimmedPassword);
        // Direct automatic role-based routing
        if (authUser?.role === 'doctor') {
          router.push('/doctor/dashboard');
        } else {
          router.push('/patient/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorObj = err as {
        detail?: string | Array<{ msg?: string }>;
        response?: { detail?: string | Array<{ msg?: string }> };
        message?: string;
      };
      const detail = errorObj?.detail || errorObj?.response?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail
            .map((d) => (typeof d === 'object' && d !== null && 'msg' in d ? String(d.msg) : String(d)))
            .join(', ')
        : (typeof detail === 'string'
            ? detail
            : (errorObj?.message && errorObj.message !== '[object Object]'
                ? errorObj.message
                : 'Authentication failed. Please verify your credentials.'));
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Connecting to clinical portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* ── Brand Header ── */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                MedAssist
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Clinical Decision Support System
            </p>
          </div>
        </div>

        {mounted && (
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        )}
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 lg:py-14 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

          {/* Left Column (7 cols): Minimal Overview */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Supervised Clinical Workspace</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Clinical Decision Support &amp; Care Portal
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Unified clinical platform for physicians and patients to review diagnostic imaging, track laboratory biomarkers, and manage care plans.
              </p>
            </div>

            {/* 4 Feature Cards in 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                  <Brain className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Diagnostic Imaging
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Brain MRI segmentation, Chest X-Ray lung analysis, and 12-lead ECG rhythm classification.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Laboratory Biomarkers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automated blood panel parsing, biomarker extraction, and clinical out-of-range flags.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Clinical Briefs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Evidence-grounded patient summaries and PubMed clinical reference search.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Care &amp; Prescriptions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Longitudinal vitals monitoring, appointment booking, and allergy contraindication checks.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Streamlined Sign In / Register Card */}
          <div className="lg:col-span-5 w-full">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 sm:p-7">
              <div className="mb-4 space-y-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                  {isRegisterMode ? 'Create Account' : 'Portal Sign In'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRegisterMode
                    ? (activePortal === 'doctor' ? 'Register physician profile' : 'Register patient health account')
                    : 'Sign in to access your authorized dashboard.'}
                </p>
              </div>

              {/* Role Selector Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg mb-4 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    setActivePortal('doctor');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activePortal === 'doctor'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  Doctor Workspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePortal('patient');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activePortal === 'patient'
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Patient Portal
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Name (Register Mode Only) */}
                {isRegisterMode && (
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Full Legal Name
                    </label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={activePortal === 'doctor' ? 'Dr. Priya Sharma' : 'Rajesh Kumar'}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Specialty (Register Mode as Doctor Only) */}
                {isRegisterMode && activePortal === 'doctor' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Medical Specialty
                    </label>
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="General Medicine, Cardiology"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Patient Intake Fields (Register Mode as Patient Only) */}
                {isRegisterMode && activePortal === 'patient' && (
                  <>
                    {/* Attending Doctor Selection */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Attending Physician
                      </label>
                      <div className="relative">
                        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all cursor-pointer"
                        >
                          {doctorsList.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Age & Gender Side-by-Side */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Age
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          placeholder="e.g. 45"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Gender
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Blood Group & Contact Phone Side-by-Side */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Blood Group
                        </label>
                        <select
                          value={bloodGroup}
                          onChange={(e) => setBloodGroup(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all cursor-pointer"
                        >
                          <option value="">Select (Optional)</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                        />
                      </div>
                    </div>

                    {/* Known Allergies / Conditions (Optional) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Known Allergies / Pre-existing Conditions (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Penicillin, Peanuts, Hypertension"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                      />
                    </div>
                  </>
                )}

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder={activePortal === 'doctor' ? 'dr.priya@medcare.in' : 'rajesh.kumar@email.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-3 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{isRegisterMode ? 'Register Account' : 'Sign In to Portal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Toggle Register / Sign In */}
                <div className="text-center pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      setError('');
                    }}
                    className="text-xs text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300 transition-colors cursor-pointer"
                  >
                    {isRegisterMode
                      ? 'Already have credentials? Sign in'
                      : 'Need an account? Register new account'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800">
        <span>MedAssist AI • Clinical Decision Support Platform</span>
        <span>Authorized Personnel Only</span>
      </footer>
    </div>
  );
}
