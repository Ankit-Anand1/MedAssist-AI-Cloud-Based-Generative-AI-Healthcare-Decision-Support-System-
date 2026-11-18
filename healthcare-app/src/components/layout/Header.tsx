'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, Search, LogOut, ChevronDown, X, Sun, Moon,
  Globe, Check, User, Settings, FileText, Users, Pill,
  Sparkles, CheckCheck, Menu
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Notification } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { useLanguage } from '@/lib/i18n';
import { useSidebar } from '@/lib/sidebar';
import { api } from '@/lib/api';

interface HeaderProps {
  userName: string;
  userRole: string;
  notifications: Notification[];
}

export default function Header({ userName, userRole, notifications: initialNotifications }: HeaderProps) {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { toggleMobileOpen } = useSidebar();

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    patients: any[];
    reports: any[];
  }>({ patients: [], reports: [] });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync initial notifications
  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearching(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live quick search handler
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ patients: [], reports: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [patientsData, reportsData] = await Promise.all([
          api.get('/api/patients').catch(() => []),
          api.get('/api/reports').catch(() => []),
        ]);

        const q = searchQuery.toLowerCase();
        const pts = (Array.isArray(patientsData) ? patientsData : []).filter((p: any) =>
          (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
        ).slice(0, 4);

        const reps = (Array.isArray(reportsData) ? reportsData : []).filter((r: any) =>
          (r.title || '').toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q)
        ).slice(0, 4);

        setSearchResults({ patients: pts, reports: reps });
        setIsSearching(true);
      } catch {
        setSearchResults({ patients: [], reports: [] });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/ai-analysis/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // Local optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await api.put(`/api/ai-analysis/notifications/${notification.id}/read`).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    } catch {}

    setShowNotifications(false);

    // Route based on role and notification content
    if (userRole.toLowerCase().includes('doc')) {
      if (notification.title.toLowerCase().includes('report') || notification.title.toLowerCase().includes('flagged')) {
        router.push('/doctor/reports');
      } else if (notification.title.toLowerCase().includes('appointment')) {
        router.push('/doctor/appointments');
      } else {
        router.push('/doctor/dashboard');
      }
    } else {
      if (notification.title.toLowerCase().includes('report')) {
        router.push('/patient/reports');
      } else {
        router.push('/patient/dashboard');
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200">
      <div className="flex items-center justify-between h-16 px-6 gap-3 sm:gap-4">
        {/* Mobile Navigation Drawer Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 md:hidden">
          <button
            type="button"
            onClick={toggleMobileOpen}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Toggle navigation menu"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Search with Live Dropdown */}
        <div ref={searchContainerRef} className="flex-1 max-w-md relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={t('header.search_placeholder', 'Search patients, reports, prescriptions...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.patients.length > 0 || searchResults.reports.length > 0) {
                  setIsSearching(true);
                }
              }}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 dark:focus:border-accent-400 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setIsSearching(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Live Search Results Popup */}
          {isSearching && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.patients.length === 0 && searchResults.reports.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching patients or clinical records found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <>
                  {searchResults.patients.length > 0 && (
                    <div className="py-2">
                      <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                        Patients
                      </p>
                      {searchResults.patients.map((p) => (
                        <Link
                          key={p.id}
                          href={`/doctor/patients/${p.id}`}
                          onClick={() => setIsSearching(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-xs font-bold">
                            {getInitials(p.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.age}y • {p.gender} • {p.email}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchResults.reports.length > 0 && (
                    <div className="py-2">
                      <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                        Reports &amp; Scans
                      </p>
                      {searchResults.reports.map((r) => (
                        <Link
                          key={r.id}
                          href="/doctor/reports"
                          onClick={() => setIsSearching(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-accent-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{r.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.type} • {r.status}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Language Switcher (EN / हिन्दी) */}
          <div className="relative">
            <button
              onClick={() => { setShowLangMenu(!showLangMenu); setShowNotifications(false); setShowProfile(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
              title="Change Language / भाषा बदलें"
            >
              <Globe className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" />
              <span>{lang === 'hi' ? 'हिन्दी' : 'English'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 animate-fade-in p-1">
                  <button
                    onClick={() => { setLang('en'); setShowLangMenu(false); }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                      lang === 'en'
                        ? 'bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <span>English</span>
                    {lang === 'en' && <Check className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" />}
                  </button>
                  <button
                    onClick={() => { setLang('hi'); setShowLangMenu(false); }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                      lang === 'hi'
                        ? 'bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <span>हिन्दी</span>
                    {lang === 'hi' && <Check className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 transition-all cursor-pointer relative"
            title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); setShowLangMenu(false); }}
              className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 transition-colors cursor-pointer"
              title={t('header.notifications', 'Notifications')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-84 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 animate-fade-in overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        {t('header.notifications', 'Notifications')}
                      </h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-accent-600 dark:text-accent-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        {t('header.mark_all_read', 'Mark all read')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer',
                          !n.read && 'bg-accent-50/40 dark:bg-accent-950/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-2 h-2 mt-1.5 rounded-full shrink-0',
                            n.type === 'alert' ? 'bg-rose-500' :
                              n.type === 'warning' ? 'bg-amber-500' :
                                n.type === 'success' ? 'bg-emerald-500' : 'bg-accent-500'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">{n.title}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        {t('header.no_notifications', 'No new notifications')}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); setShowLangMenu(false); }}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-600 to-indigo-500 text-white flex items-center justify-center text-xs font-black shadow-sm ring-2 ring-white dark:ring-slate-800">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{userName}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{userRole}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 animate-fade-in p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
                    <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 font-semibold">
                      {userRole}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href={userRole.toLowerCase().includes('doc') ? '/doctor/settings' : '/patient/profile'}
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      {t('header.settings', 'Settings & Preferences')}
                    </Link>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        localStorage.removeItem('medassist_token');
                        localStorage.removeItem('medassist_user');
                        window.location.href = '/';
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors w-full text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('header.logout', 'Logout')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
