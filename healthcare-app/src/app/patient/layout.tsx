'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AICopilot from '@/components/ai-copilot/AICopilot';
import { useAuth } from '@/lib/auth';
import { useSidebar } from '@/lib/sidebar';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Notification } from '@/lib/types';
import {
  LayoutDashboard, FileText, Brain, History,
  Pill, Calendar, UserCircle, Loader2
} from 'lucide-react';

const patientNavItems = [
  { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
  { label: 'My Reports', href: '/patient/reports', icon: FileText },
  { label: 'AI Analysis', href: '/patient/analysis', icon: Brain },
  { label: 'Health History', href: '/patient/health-history', icon: History },
  { label: 'Prescriptions', href: '/patient/prescriptions', icon: Pill },
  { label: 'Appointments', href: '/patient/appointments', icon: Calendar },
  { label: 'Profile', href: '/patient/profile', icon: UserCircle },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isCollapsed } = useSidebar();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (!authLoading && user && user.role !== 'patient') {
      router.push('/doctor/dashboard');
      return;
    }
  }, [mounted, user, authLoading, router]);

  useEffect(() => {
    if (mounted && user && user.role === 'patient') {
      api.get('/api/ai-analysis/notifications')
        .then((data) => {
          if (Array.isArray(data)) {
            setNotifications(data.map((n: any, i: number) => ({
              id: n.id || String(i),
              title: n.title || '',
              message: n.message || '',
              time: n.time || '',
              read: n.read ?? true,
              type: n.type || 'info',
            })));
          }
        })
        .catch(() => { });
    }
  }, [mounted, user]);

  if (!mounted || authLoading || !user) {
    return (
      <div className="min-h-screen bg-medical-bg dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-medical-bg dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar items={patientNavItems} role="patient" />
      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "md:ml-20" : "md:ml-64"
        )}
      >
        <Header
          userName={user.name}
          userRole="Patient"
          notifications={notifications}
        />
        <main className="p-6 flex-1">
          {children}
        </main>
      </div>
      <AICopilot />
    </div>
  );
}

