'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AICopilot from '@/components/ai-copilot/AICopilot';
import { useAuth } from '@/lib/auth';
import { useSidebar } from '@/lib/sidebar';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Notification } from '@/lib/types';
import {
  LayoutDashboard, Users, FileText, Brain, ClipboardList,
  Pill, Calendar, BookOpen, Settings, Network, Loader2,
  Sparkles, MessageSquare, Edit3
} from 'lucide-react';

const doctorNavItems = [
  // AI & Clinical Decision Support (Primary)
  { label: 'AI Clinical Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard, group: 'Clinical AI' },
  { label: 'AI Analysis', href: '/doctor/analysis', icon: Brain, group: 'Clinical AI' },
  { label: 'AI Patient Brief', href: '/doctor/brief', icon: ClipboardList, group: 'Clinical AI' },
  { label: 'Evidence & Knowledge', href: '/doctor/evidence', icon: BookOpen, group: 'Clinical AI' },
  // Patient Management (Secondary)
  { label: 'Patients', href: '/doctor/patients', icon: Users, group: 'Patient Care' },
  { label: 'Reports', href: '/doctor/reports', icon: FileText, group: 'Patient Care' },
  // Workflow (Tertiary)
  { label: 'Prescriptions', href: '/doctor/prescriptions', icon: Pill, group: 'Workflow' },
  { label: 'Appointments', href: '/doctor/appointments', icon: Calendar, group: 'Workflow' },
  // System
  { label: 'System Architecture', href: '/doctor/architecture', icon: Network, group: 'System' },
  { label: 'Settings', href: '/doctor/settings', icon: Settings, group: 'System' },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isCollapsed } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract patient ID from URL when viewing /doctor/patients/[id]
  const patientIdMatch = pathname?.match(/\/doctor\/patients\/([a-f0-9]{24})/i);
  const currentPatientId = patientIdMatch ? patientIdMatch[1] : undefined;

  useEffect(() => {
    if (!mounted) return;
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (!authLoading && user && user.role !== 'doctor') {
      router.push('/patient/dashboard');
      return;
    }
  }, [mounted, user, authLoading, router]);

  useEffect(() => {
    if (mounted && user && user.role === 'doctor') {
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
        <Loader2 className="w-8 h-8 text-accent-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-medical-bg dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar items={doctorNavItems} role="doctor" />
      <div className={cn(
        'min-h-screen flex flex-col transition-all duration-300 ease-in-out',
        isCollapsed ? 'md:ml-20' : 'md:ml-64'
      )}>
        <Header
          userName={user.name}
          userRole="Doctor"
          notifications={notifications}
        />
        <main className="p-6 flex-1">
          {children}
        </main>
      </div>
      <AICopilot patientId={currentPatientId} />
    </div>
  );
}

