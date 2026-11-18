import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string): string {
  if (!date) return '—';
  try {
    const clean = String(date).split(' at ')[0].trim();
    const parsed = new Date(clean);
    if (isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Normal: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    Abnormal: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    Critical: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
    Borderline: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/80',
    Low: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80',
    High: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
    Active: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    Completed: 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    Pending: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
    'AI Processing': 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/80 shadow-[0_0_14px_rgba(6,182,212,0.2)] animate-pulse',
    'AI Analyzed': 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/80 shadow-[0_0_12px_rgba(6,182,212,0.18)]',
    'AI Analysis Failed': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
    'Unsupported File': 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
    Reviewed: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 shadow-[0_0_14px_rgba(16,185,129,0.2)]',
    Validated: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80 shadow-[0_0_14px_rgba(20,184,166,0.2)]',
    Flagged: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80 shadow-[0_0_14px_rgba(244,63,94,0.2)]',
    Draft: 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    Scheduled: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/80 shadow-[0_0_12px_rgba(14,165,233,0.15)]',
    Cancelled: 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    'In Progress': 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
    Stable: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    'Follow-up Due': 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    'Not determined': 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    Error: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
    Processing: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/80 animate-pulse',
  };
  return colors[status] || 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
}

export function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    Normal: 'text-emerald-600 dark:text-emerald-400',
    Moderate: 'text-amber-600 dark:text-amber-400',
    High: 'text-orange-600 dark:text-orange-400',
    Critical: 'text-rose-600 dark:text-rose-400 font-bold animate-pulse',
  };
  return colors[urgency] || 'text-slate-600 dark:text-slate-400';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-emerald-600 dark:text-emerald-400 font-bold';
  if (confidence >= 75) return 'text-cyan-600 dark:text-cyan-400 font-bold';
  return 'text-amber-600 dark:text-amber-400 font-bold';
}

export function getConfidenceBadge(confidence: number): string {
  if (confidence >= 90) {
    return 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
  }
  if (confidence >= 75) {
    return 'bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-blue-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]';
  }
  return 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
}
