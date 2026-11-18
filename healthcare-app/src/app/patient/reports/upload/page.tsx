'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Upload, Brain, FileImage, HeartPulse, FileText, Stethoscope,
  CheckCircle2, Clock, Loader2, ChevronRight, X, AlertCircle, Sparkles, ArrowLeft
} from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

type ReportType = 'Brain MRI' | 'X-ray' | 'ECG' | 'Blood Test' | 'Medical Report';

interface UploadItem {
  id: string;
  name: string;
  type: ReportType;
  size: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'analyzing' | 'error';
  errorMessage?: string;
}

const reportTypes: { type: ReportType; icon: React.ElementType; description: string; formats: string }[] = [
  { type: 'Brain MRI', icon: Brain, description: 'DICOM, NIfTI, or JPEG/PNG MRI slices', formats: '.jpg, .png, .pdf' },
  { type: 'X-ray', icon: FileImage, description: 'Chest, limb, or abdominal radiographs', formats: '.jpg, .png, .pdf' },
  { type: 'ECG', icon: HeartPulse, description: '12-lead electrocardiogram traces', formats: '.pdf, .jpg, .png' },
  { type: 'Blood Test', icon: Stethoscope, description: 'CBC, metabolic panels, lipid profiles', formats: '.pdf, .jpg, .png' },
  { type: 'Medical Report', icon: FileText, description: 'Discharge summaries, clinical charts', formats: '.pdf, .docx, .png' },
];

export default function ReportUpload() {
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState<ReportType | null>('Brain MRI');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!selectedType) return;

    const uploadId = Date.now().toString();
    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    const newUpload: UploadItem = {
      id: uploadId,
      name: file.name,
      type: selectedType,
      size: sizeStr,
      progress: 35,
      status: 'uploading',
    };
    setUploads(prev => [newUpload, ...prev]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('report_type', selectedType);
      formData.append('title', `${selectedType} - ${file.name.replace(/\.[^/.]+$/, '')}`);

      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 75, status: 'processing' } : u));

      await api.upload('/api/reports/upload', formData);

      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100, status: 'analyzing' } : u));

      setTimeout(() => {
        setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'complete' } : u));
      }, 1500);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploads(prev => prev.map(u => u.id === uploadId ? {
        ...u,
        status: 'error',
        errorMessage: err.message || 'Upload failed'
      } : u));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/patient/reports"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t('uploadReport')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Submit medical scans, waveforms, or lab panels for AI ingestion & clinical evaluation
          </p>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {/* Report Type Selection */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">{t('modality')} Selection</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {reportTypes.map((rt) => (
            <button
              key={rt.type}
              onClick={() => setSelectedType(rt.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                selectedType === rt.type
                  ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
              }`}
            >
              <rt.icon className={`w-6 h-6 mb-2.5 ${selectedType === rt.type ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <p className={`text-sm font-bold ${selectedType === rt.type ? 'text-cyan-900 dark:text-cyan-200' : 'text-slate-800 dark:text-slate-200'}`}>
                {rt.type}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{rt.formats}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Drop Zone */}
      {selectedType && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm animate-fade-in">
          <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">Ingest {selectedType} Document</h2>
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
              dragOver
                ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/40'
                : 'border-slate-300 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 bg-slate-50/50 dark:bg-slate-950/40'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-cyan-600 dark:text-cyan-400">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Drag and drop diagnostic scan or lab file here</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Direct upload to clinical ingestion pipeline</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              Browse Local Files
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
              Accepted: {reportTypes.find(r => r.type === selectedType)?.formats} • Max file size: 50 MB
            </p>
          </div>
        </div>
      )}

      {/* Upload Tracking List */}
      {uploads.length > 0 && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">Upload Status & AI Pipeline</h2>
          <div className="space-y-4">
            {uploads.map((upload) => (
              <div key={upload.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {upload.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : upload.status === 'analyzing' ? (
                      <Sparkles className="w-5 h-5 text-cyan-500 animate-pulse" />
                    ) : upload.status === 'processing' ? (
                      <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                    ) : upload.status === 'error' ? (
                      <X className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{upload.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{upload.type} • {upload.size}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    upload.status === 'complete' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                    upload.status === 'analyzing' ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800' :
                    upload.status === 'processing' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800' :
                    upload.status === 'error' ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {upload.status === 'complete' ? 'AI Analysis Complete' :
                      upload.status === 'analyzing' ? 'Running Model Inference...' :
                      upload.status === 'processing' ? 'Saving to Cloud...' :
                      upload.status === 'error' ? (upload.errorMessage || 'Error') :
                      `Uploading ${Math.round(upload.progress)}%`}
                  </span>
                </div>

                {upload.status === 'complete' && (
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <AlertCircle className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Ready for physician evaluation</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href="/patient/analysis" className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1">
                        View Analysis <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link href="/patient/reports" className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium">
                        View In Reports
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
