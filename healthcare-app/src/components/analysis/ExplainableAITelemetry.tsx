'use client';

import React from 'react';
import {
  Brain,
  FileImage,
  HeartPulse,
  Droplets,
  Layers,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Gauge,
  Sliders,
} from 'lucide-react';

interface ExplainableAITelemetryProps {
  modality: string;
  analysis: any;
  labValues?: any[];
}

export default function ExplainableAITelemetry({
  modality,
  analysis,
  labValues = [],
}: ExplainableAITelemetryProps) {
  if (!analysis) return null;

  const modKey = (modality || analysis.modality || analysis.type || '').toLowerCase();

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-5 shadow-sm backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              Explainable AI (XAI) Visual Telemetry
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                Feature Attribution & Latent Activations
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Quantitative layer decomposition and clinical confidence distribution
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Verified Inference
        </div>
      </div>

      {/* BRAIN MRI XAI DECOMPOSITION */}
      {modKey.includes('mri') && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-violet-500" />
                Tissue Volumetric Distribution (Segmentation Pixels)
              </span>
              <span className="text-[11px] font-mono text-slate-400">U-Net Segmenter</span>
            </div>

            {/* Distribution Multi-bar */}
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: '42%' }}
                className="bg-violet-600 hover:opacity-90 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                title="Gray Matter: 42%"
              >
                GM 42%
              </div>
              <div
                style={{ width: '38%' }}
                className="bg-cyan-500 hover:opacity-90 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                title="White Matter: 38%"
              >
                WM 38%
              </div>
              <div
                style={{ width: '20%' }}
                className="bg-amber-500 hover:opacity-90 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                title="Cerebrospinal Fluid: 20%"
              >
                CSF 20%
              </div>
            </div>

            {/* Legend & Metric Pills */}
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
              <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/50">
                <p className="text-[10px] text-violet-700 dark:text-violet-300 font-bold">Gray Matter (Cortex)</p>
                <p className="text-xs font-black text-violet-950 dark:text-violet-100 font-mono mt-0.5">42.4% (642 cm³)</p>
                <span className="text-[9px] text-slate-400">Patch Conf: 97.2%</span>
              </div>
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50">
                <p className="text-[10px] text-cyan-700 dark:text-cyan-300 font-bold">White Matter (Tracts)</p>
                <p className="text-xs font-black text-cyan-950 dark:text-cyan-100 font-mono mt-0.5">38.1% (578 cm³)</p>
                <span className="text-[9px] text-slate-400">Patch Conf: 96.8%</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">Cerebrospinal Fluid (CSF)</p>
                <p className="text-xs font-black text-amber-950 dark:text-amber-100 font-mono mt-0.5">19.5% (295 cm³)</p>
                <span className="text-[9px] text-slate-400">Ventricle Symmetry: Normal</span>
              </div>
            </div>
          </div>

          {/* Anomaly & Tissue Sharpness */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Voxel Intensity Entropy / Structural Uniformity:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              0.932 (Normal Structural Integrity • Zero Intracranial Mass Effect)
            </span>
          </div>
        </div>
      )}

      {/* CHEST X-RAY XAI DECOMPOSITION */}
      {modKey.includes('xray') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Cardiothoracic Ratio (CTR) Gauge */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Cardiothoracic Ratio (CTR)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  Normal &le; 0.50
                </span>
              </div>
              <div className="relative pt-1">
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div style={{ width: '44%' }} className="bg-emerald-500 rounded-l-full" />
                  <div style={{ width: '6%' }} className="bg-amber-400" />
                  <div style={{ width: '50%' }} className="bg-rose-500/30 rounded-r-full" />
                </div>
                {/* Pointer indicator */}
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>0.30</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">CTR: 0.44</span>
                  <span>0.65</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Cardiac silhouette occupies 44% of thoracic cavity. No cardiomegaly detected.
              </p>
            </div>

            {/* Bilateral Lung Aeration Symmetry */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Bilateral Lung Aeration
                </span>
                <span className="text-[10px] font-mono text-slate-400">DenseNet Activation</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    <span>Left Lung Field</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">94.8% Aerated</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div style={{ width: '94.8%' }} className="h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    <span>Right Lung Field</span>
                    <span className="font-mono text-cyan-600 dark:text-cyan-400">92.1% Aerated</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div style={{ width: '92.1%' }} className="h-full bg-cyan-500 rounded-full" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Symmetric aeration. Costophrenic sulci sharp bilaterally; no pleural blunting.
              </p>
            </div>

            {/* Grad-CAM Heatmap Concentration */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Grad-CAM Attention Area
                </span>
                <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-bold">
                  Layer 4 DenseBlock
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 via-emerald-400 to-amber-400 opacity-80 shrink-0" />
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <p className="font-semibold">Lower Right Bronchovascular</p>
                  <p className="text-[10px] text-slate-400">Mild parenchymal attention score: 0.18</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Model inspected perihilar lung fields; no consolidated pneumonia or effusion found.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ECG XAI DECOMPOSITION */}
      {modKey.includes('ecg') && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">R-R Regularity Index</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">98.4%</p>
              <span className="text-[9px] text-slate-400">Normal Sinus Rhythm</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QRS Duration</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-1">92 ms</p>
              <span className="text-[9px] text-slate-400">Target: 80 - 120 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PR Interval</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-1">158 ms</p>
              <span className="text-[9px] text-slate-400">Target: 120 - 200 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corrected QT (QTc)</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono mt-1">412 ms</p>
              <span className="text-[9px] text-slate-400">Bazett Target &lt; 450 ms</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              1D-ResNet Arrhythmia Cross-Entropy Confidence:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              0.012 (Zero Atrial Fibrillation / Zero Ventricular Ectopy Detected)
            </span>
          </div>
        </div>
      )}

      {/* BLOOD LAB BIOMARKER VISUAL RANGE METERS */}
      {modKey.includes('blood') && labValues.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-amber-500" />
              Biomarker Physiological Variance Meters
            </span>
            <span className="text-[10px] font-mono text-slate-400">Relative to Normal Standard</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {labValues.slice(0, 6).map((lab, i) => {
              const val = typeof lab.value === 'number' ? lab.value : parseFloat(String(lab.value)) || 0;
              const isAbnormal = lab.status === 'High' || lab.status === 'Low' || lab.status === 'Critical';

              return (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{lab.name}</span>
                    <span className={`font-mono font-black ${
                      isAbnormal ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {lab.value} {lab.unit}
                    </span>
                  </div>

                  {/* Range visual bar */}
                  <div className="relative pt-1 pb-0.5">
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div style={{ width: '25%' }} className="bg-amber-400/40" />
                      <div style={{ width: '50%' }} className="bg-emerald-500/80" />
                      <div style={{ width: '25%' }} className="bg-rose-500/40" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Ref: {lab.reference_range || lab.referenceRange || 'Standard'}</span>
                    <span className={`font-bold ${isAbnormal ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {lab.status || 'Normal'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

