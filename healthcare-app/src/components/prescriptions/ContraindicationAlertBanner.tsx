'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, CheckSquare, Square, Info } from 'lucide-react';
import { AllergyConflict } from '@/lib/allergyChecker';

interface ContraindicationAlertBannerProps {
  conflicts: AllergyConflict[];
  overrideChecked: boolean;
  onOverrideChange: (checked: boolean) => void;
  overrideReason: string;
  onOverrideReasonChange: (reason: string) => void;
}

export default function ContraindicationAlertBanner({
  conflicts,
  overrideChecked,
  onOverrideChange,
  overrideReason,
  onOverrideReasonChange,
}: ContraindicationAlertBannerProps) {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-red-500 bg-red-50/90 dark:bg-red-950/50 p-5 shadow-xl shadow-red-500/10 animate-fade-in space-y-4">
      {/* Alert Header */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/30 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
              Critical Contraindication Alert
            </span>
            <span className="text-xs font-bold text-red-900 dark:text-red-200">
              {conflicts.length} Drug-Allergy Conflict{conflicts.length > 1 ? 's' : ''} Detected
            </span>
          </div>
          <p className="text-xs text-red-800 dark:text-red-300 mt-1 font-medium leading-relaxed">
            One or more prescribed medications conflict with the patient&apos;s verified clinical allergy record. Prescribing without documented clinical override is prohibited by clinical safety policy.
          </p>
        </div>
      </div>

      {/* Individual Conflicts */}
      <div className="space-y-3 pt-1">
        {conflicts.map((conflict, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-red-300 dark:border-red-800/80 bg-white/80 dark:bg-slate-900/80 p-4 space-y-2"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm font-bold text-red-950 dark:text-red-100">
                  {conflict.medicineName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">↔</span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900">
                  Allergy: {conflict.matchedAllergy}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Class: {conflict.drugClass}
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {conflict.warningMessage}
            </p>
            <div className="flex items-start gap-1.5 text-[11px] text-red-800 dark:text-red-300/90 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200/60 dark:border-red-900/40">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span><strong>Pathophysiology:</strong> {conflict.clinicalMechanism}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Physician Override Section */}
      <div className="pt-2 border-t border-red-200 dark:border-red-900/60 space-y-3">
        <label
          onClick={() => onOverrideChange(!overrideChecked)}
          className="flex items-start gap-3 cursor-pointer group select-none"
        >
          <div className="mt-0.5 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
            {overrideChecked ? (
              <CheckSquare className="w-5 h-5 text-red-600 dark:text-red-400" />
            ) : (
              <Square className="w-5 h-5 text-red-400 dark:text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-red-950 dark:text-red-200 group-hover:underline">
              Override with Clinical Justification (Mandatory Physician Attestation)
            </span>
            <p className="text-[11px] text-red-800 dark:text-red-300/80 mt-0.5 leading-normal">
              I certify that I have evaluated the contraindication, determined that clinical benefits outweigh severe hypersensitivity risks, and verified that required clinical monitoring and emergency countermeasures are available.
            </p>
          </div>
        </label>

        {overrideChecked && (
          <div className="animate-fade-in pl-8 space-y-1.5">
            <label className="block text-[11px] font-bold text-red-900 dark:text-red-200 uppercase tracking-wider">
              Clinical Override Justification Notes *
            </label>
            <input
              type="text"
              required
              value={overrideReason}
              onChange={(e) => onOverrideReasonChange(e.target.value)}
              placeholder="e.g. Patient previously tolerated with antihistamine pre-medication; no alternative antimicrobial indicated."
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

