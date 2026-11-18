'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  LucideIcon,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useSidebar } from '@/lib/sidebar';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  translationKey?: string;
}

interface SidebarProps {
  items: NavItem[];
  role: 'patient' | 'doctor';
}

export default function Sidebar({ items, role }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  // Helper to translate nav items
  const getNavLabel = (item: NavItem) => {
    const keyMap: Record<string, string> = {
      '/doctor/dashboard': 'nav.dashboard',
      '/doctor/analysis': 'nav.analysis',
      '/doctor/brief': 'nav.brief',
      '/doctor/evidence': 'nav.evidence',
      '/doctor/patients': 'nav.patients',
      '/doctor/reports': 'nav.reports',
      '/doctor/prescriptions': 'nav.prescriptions',
      '/doctor/appointments': 'nav.appointments',
      '/doctor/architecture': 'nav.architecture',
      '/doctor/settings': 'nav.settings',
      '/patient/dashboard': 'nav.dashboard',
      '/patient/reports': 'nav.my_reports',
      '/patient/analysis': 'nav.analysis',
      '/patient/health-history': 'nav.health_history',
      '/patient/prescriptions': 'nav.prescriptions',
      '/patient/appointments': 'nav.appointments',
      '/patient/profile': 'nav.profile',
    };
    const key = keyMap[item.href];
    return key ? t(key, item.label) : item.label;
  };

  const getGroupLabel = (group: string) => {
    const groupKeyMap: Record<string, string> = {
      'Clinical AI': 'nav.group.clinical_ai',
      'Patient Care': 'nav.group.patient_care',
      'Workflow': 'nav.group.workflow',
      'System': 'nav.group.system',
    };
    const key = groupKeyMap[group];
    return key ? t(key, group) : group;
  };

  // Group items
  const groups: { label: string; items: NavItem[] }[] = [];
  let currentGroup: { label: string; items: NavItem[] } | null = null;

  items.forEach((item) => {
    const group = item.group || '';
    if (!currentGroup || currentGroup.label !== group) {
      currentGroup = { label: group, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Chassis */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out',
          // Desktop collapsed vs expanded width
          isCollapsed ? 'md:w-20' : 'md:w-64',
          // Mobile drawer slide-in / slide-out
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0',
          !isMobileOpen && isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Identity & Collapse Toggle */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 min-h-[64px]">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-3 group min-w-0',
              isCollapsed && 'md:justify-center md:w-full'
            )}
            title="MedAssist AI Home"
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-105',
                role === 'doctor'
                  ? 'bg-gradient-to-tr from-accent-600 to-indigo-600 text-white'
                  : 'bg-gradient-to-tr from-primary-600 to-teal-500 text-white'
              )}
            >
              <Activity className="w-5 h-5 text-white" />
            </div>

            {/* Brand text (hidden when collapsed on desktop) */}
            <div className={cn('min-w-0', isCollapsed && 'md:hidden')}>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-tight truncate">
                  MedAssist AI
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold leading-tight mt-0.5 truncate">
                {role === 'doctor' ? t('sidebar.decision_support', 'Clinical Decision') : t('header.patient_role', 'Health Portal')}
              </p>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-1 overflow-x-hidden">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div
                  className={cn(
                    'px-3 pt-3.5 pb-1.5 transition-opacity duration-200',
                    isCollapsed ? 'md:hidden' : 'block'
                  )}
                >
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold truncate">
                    {getGroupLabel(group.label)}
                  </p>
                </div>
              )}
              {isCollapsed && gi > 0 && group.label && (
                <div className="hidden md:block my-2 border-t border-slate-100 dark:border-slate-800/80 mx-2" />
              )}
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/doctor/dashboard' &&
                    item.href !== '/patient/dashboard' &&
                    pathname.startsWith(item.href + '/'));
                const labelText = getNavLabel(item);

                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={isCollapsed ? labelText : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative group',
                      isCollapsed ? 'md:justify-center md:px-0 md:py-2.5' : '',
                      isActive
                        ? role === 'doctor'
                          ? 'bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 shadow-sm border border-accent-200/60 dark:border-accent-800/60'
                          : 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 shadow-sm border border-primary-200/60 dark:border-primary-800/60'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive
                          ? role === 'doctor'
                            ? 'text-accent-600 dark:text-accent-400'
                            : 'text-primary-600 dark:text-primary-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                      )}
                    />
                    <span
                      className={cn(
                        'truncate transition-all duration-200',
                        isCollapsed ? 'md:hidden' : 'block'
                      )}
                    >
                      {labelText}
                    </span>
                    {isActive && (
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isCollapsed ? 'md:absolute md:top-1.5 md:right-1.5' : 'ml-auto',
                          role === 'doctor' ? 'bg-accent-500' : 'bg-primary-500'
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Disclaimer */}
        <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800/80">
          <div
            className={cn(
              'rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all',
              isCollapsed ? 'md:p-2 md:flex md:items-center md:justify-center' : 'px-3 py-2.5'
            )}
            title={
              isCollapsed
                ? `${t('sidebar.footer_title', 'Clinical Decision Support')} — ${t('sidebar.footer_subtitle', 'Final decisions remain with physician')}`
                : undefined
            }
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-accent-500 shrink-0" />
              <p
                className={cn(
                  'text-[10px] text-slate-700 dark:text-slate-300 uppercase tracking-wider font-bold truncate',
                  isCollapsed ? 'md:hidden' : 'block'
                )}
              >
                {t('sidebar.footer_title', 'Clinical Decision Support')}
              </p>
            </div>
            <p
              className={cn(
                'text-[10px] text-slate-500 dark:text-slate-400 leading-tight',
                isCollapsed ? 'md:hidden' : 'block'
              )}
            >
              {t('sidebar.footer_subtitle', 'Final decisions remain with the physician')}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
