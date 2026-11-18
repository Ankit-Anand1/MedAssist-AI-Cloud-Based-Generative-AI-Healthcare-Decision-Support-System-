'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, X, Sparkles, BookOpen,
  AlertCircle, ChevronDown, Minimize2, Maximize2, Loader2, Bot,
  User, CheckCircle2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CopilotMessage } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';

const suggestedPrompts = [
  "Summarize this patient's reports.",
  "Explain the abnormal blood values.",
  "What findings require physician attention?",
  "Show relevant medical evidence.",
  "Summarize the patient's medical history.",
];

// ── Clinical Message Theme Analyzer ──
function getMessageCardTheme(text: string): { container: string; indicatorColor: string } {
  const t = text.toLowerCase();
  const alertKeywords = [
    'high', 'abnormal', 'elevated', 'hypertension', 'hba1c', '152/96',
    'deficit', 'impairment', 'allergies', 'allergy', 'critical', 'alert', 'warning', 'risk'
  ];
  const normalKeywords = ['normal', 'stable', 'sufficient', 'within typical', 'intact', 'healthy'];

  const hasAlert = alertKeywords.some(k => t.includes(k));
  if (hasAlert) {
    return {
      container: 'bg-gradient-to-br from-rose-50/90 via-amber-50/50 to-white dark:from-rose-950/40 dark:via-amber-950/20 dark:to-slate-900 border-l-4 border-l-amber-500 border border-amber-200/70 dark:border-amber-800/50',
      indicatorColor: 'text-amber-600 dark:text-amber-400',
    };
  }

  const hasNormal = normalKeywords.some(k => t.includes(k));
  if (hasNormal) {
    return {
      container: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900 border-l-4 border-l-emerald-500 border border-emerald-200/70 dark:border-emerald-800/50',
      indicatorColor: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  return {
    container: 'bg-gradient-to-br from-cyan-50/70 via-sky-50/40 to-white dark:from-cyan-950/30 dark:via-slate-900 dark:to-indigo-950/30 border-l-4 border-l-cyan-500 border border-slate-200/80 dark:border-slate-800',
    indicatorColor: 'text-cyan-600 dark:text-cyan-400',
  };
}

// ── Medical Entity Inline Highlighter ──
function highlightInlineClinicalTerms(text: string) {
  if (!text) return null;

  const termsMap: { [pattern: string]: 'allergy' | 'abnormal' | 'dosage' } = {
    // Allergies
    'Penicillin': 'allergy',
    'Sulfa drugs': 'allergy',
    'Sulfa drug': 'allergy',
    'Sulfa': 'allergy',

    // Abnormal / Key Metrics
    'HbA1c 8.2%': 'abnormal',
    'BP 152/96 mmHg': 'abnormal',
    '152/96 mmHg': 'abnormal',
    '152/96': 'abnormal',
    'MMSE score of 24/30': 'abnormal',
    'MMSE score 24/30': 'abnormal',
    'MMSE 24/30': 'abnormal',
    '24/30': 'abnormal',
    '156.0 mg/dL': 'abnormal',
    'HbA1c': 'abnormal',
    '8.2%': 'abnormal',

    // Dosages & Normal Percentages
    'Metformin 1000mg BID': 'dosage',
    'Amlodipine 5mg QD': 'dosage',
    'Atorvastatin 20mg QD': 'dosage',
    'Donepezil 5mg QD': 'dosage',
    '1000mg BID': 'dosage',
    '5mg QD': 'dosage',
    '20mg QD': 'dosage',
    '1000mg': 'dosage',
    '5mg': 'dosage',
    '20mg': 'dosage',
    '88.3%': 'dosage',
    '75.0%': 'dosage',
    '25.0%': 'dosage',
    '75%': 'dosage',
    '25%': 'dosage',
    '120/80 mmHg': 'dosage',
    '120/80': 'dosage',
  };

  const keys = Object.keys(termsMap).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  const parts = text.split(regex);

  return parts.map((part, index) => {
    const matchedKey = keys.find(k => k.toLowerCase() === part.toLowerCase());
    if (!matchedKey) {
      return <span key={index}>{part}</span>;
    }

    const type = termsMap[matchedKey];
    if (type === 'allergy') {
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200/60 dark:border-red-800/60 mx-0.5"
          title={`Allergy alert: ${part}`}
        >
          {part}
        </span>
      );
    }
    if (type === 'abnormal') {
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 mx-0.5"
          title={`Clinical parameter: ${part}`}
        >
          {part}
        </span>
      );
    }
    return (
      <span
        key={index}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60 mx-0.5"
        title={`Dosage/Telemetry: ${part}`}
      >
        {part}
      </span>
    );
  });
}

// ── Rich Clinical Message Parser ──
function renderFormattedClinicalMessage(text: string) {
  if (!text) return null;

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
      {rawLines.map((line, idx) => {
        // 1. Section Header: e.g. **Key Clinical Observations:**, **Key Findings:**, ### Recommendations
        const isHeader =
          (line.startsWith('**') && (line.endsWith('**') || line.endsWith(':**') || line.endsWith('**:'))) ||
          line.startsWith('###') ||
          line.startsWith('##') ||
          (line.endsWith(':') && line.length < 50 && !line.startsWith('*') && !line.startsWith('-'));

        if (isHeader) {
          const cleanHeader = line.replace(/[*#]/g, '').trim().replace(/:$/, '');
          return (
            <div key={idx} className="pt-2 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/20 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3 h-3 text-teal-500 shrink-0" />
                {cleanHeader}
              </span>
            </div>
          );
        }

        // 2. Bullet item with category: * **Category:** Details or - **Category:** Details
        const bulletMatch = line.match(/^[\*\-•]\s+(?:\*\*)?([A-Za-z0-9\s—\-&/]+)(?:\*\*)?:\s*(.+)$/) ||
                            line.match(/^\d+\.\s+(?:\*\*)?([A-Za-z0-9\s—\-&/]+)(?:\*\*)?:\s*(.+)$/);

        if (bulletMatch) {
          const category = bulletMatch[1].replace(/[*_]/g, '').trim();
          const details = bulletMatch[2].replace(/\*\*/g, '').replace(/\*/g, '').trim();

          const catLower = category.toLowerCase();
          let badgeStyle = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800';

          if (catLower.includes('cognitive') || catLower.includes('mri') || catLower.includes('brain') || catLower.includes('neuro')) {
            badgeStyle = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800';
          } else if (catLower.includes('medication') || catLower.includes('prescription') || catLower.includes('therapy') || catLower.includes('drug')) {
            badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
          } else if (catLower.includes('history') || catLower.includes('vital') || catLower.includes('blood') || catLower.includes('lab') || catLower.includes('condition') || catLower.includes('allerg')) {
            badgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border-rose-200 dark:border-rose-800';
          }

          return (
            <div
              key={idx}
              className="p-3 my-1.5 rounded-xl bg-white/85 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-cyan-500/40 transition-all duration-200 backdrop-blur-xs"
            >
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeStyle}`}>
                  {category}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {highlightInlineClinicalTerms(details)}
              </p>
            </div>
          );
        }

        // 3. Regular bullet point without category
        if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
          const cleanText = line.replace(/^[\*\-•]\s+/, '').replace(/\*\*/g, '').trim();
          return (
            <div
              key={idx}
              className="p-2.5 my-1 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {highlightInlineClinicalTerms(cleanText)}
              </p>
            </div>
          );
        }

        // 4. Regular paragraph text (strip any remaining markdown symbols)
        const cleanParagraph = line.replace(/\*\*/g, '').replace(/###/g, '').trim();
        return (
          <p key={idx} className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
            {highlightInlineClinicalTerms(cleanParagraph)}
          </p>
        );
      })}
    </div>
  );
}

interface AICopilotProps {
  patientId?: string;
}

export default function AICopilot({ patientId: propPatientId }: AICopilotProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [internalPatientId, setInternalPatientId] = useState<string>(propPatientId || '');
  const [currentPatientName, setCurrentPatientName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (propPatientId) {
      setInternalPatientId(propPatientId);
    }
  }, [propPatientId]);

  // Load patient context based on role
  useEffect(() => {
    if (!user) return;

    if (user.role === 'patient') {
      api.get('/api/patients/me')
        .then((p) => {
          if (p?.id) {
            setInternalPatientId(p.id);
            setCurrentPatientName(p.name || user.name || 'Your Records');
          }
        })
        .catch((err) => console.error('Copilot patient fetch error:', err));
    } else if (user.role === 'doctor') {
      api.get('/api/patients')
        .then((pts) => {
          if (Array.isArray(pts) && pts.length > 0) {
            setPatientsList(pts);
            // If no patient currently chosen or invalid, default to the first assigned patient
            setInternalPatientId((prev) => {
              if (prev && pts.some((p: any) => p.id === prev)) {
                return prev;
              }
              return pts[0].id;
            });
          }
        })
        .catch((err) => console.error('Copilot doctor patients fetch error:', err));
    }
  }, [user]);

  // Update current patient name when internalPatientId or patientsList changes
  useEffect(() => {
    if (user?.role === 'doctor' && patientsList.length > 0 && internalPatientId) {
      const found = patientsList.find((p) => p.id === internalPatientId);
      if (found) {
        setCurrentPatientName(found.name);
      }
    }
  }, [internalPatientId, patientsList, user]);

  // Listen for custom select-patient event from pages
  useEffect(() => {
    const handlePatientSelected = (e: any) => {
      if (e?.detail?.patientId) {
        setInternalPatientId(e.detail.patientId);
        if (e.detail.name) {
          setCurrentPatientName(e.detail.name);
        }
      }
    };
    window.addEventListener('select-patient', handlePatientSelected);
    return () => window.removeEventListener('select-patient', handlePatientSelected);
  }, []);

  // Reset messages when patient changes
  useEffect(() => {
    const activeId = internalPatientId || propPatientId;
    const nameStr = currentPatientName ? ` for ${currentPatientName}` : '';
    setMessages([{
      id: '1',
      role: 'assistant',
      content: activeId
        ? `Hello. I'm your Multimodal AI Clinical Copilot${nameStr}. I have access to diagnostic scans, laboratory telemetry, and RAG medical literature. How can I assist your clinical review?`
        : "Hello. I'm your Multimodal AI Clinical Copilot. Select a patient to inspect diagnostic scans, laboratory telemetry, and RAG medical literature.",
      timestamp: new Date().toISOString(),
    }]);
  }, [internalPatientId, propPatientId, currentPatientName]);

  // Listen for open-ai-copilot custom event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener('open-ai-copilot', handleOpen);
    return () => window.removeEventListener('open-ai-copilot', handleOpen);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const activePatientId = internalPatientId || propPatientId;

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isThinking) return;

    const userMsg: CopilotMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      if (!activePatientId) {
        throw new Error('No patient selected');
      }

      // Call the copilot API for the active patient
      const result = await api.post(`/api/ai/copilot/${activePatientId}`, {
        message: messageText,
      });

      const sources = (result.sources || []).map((s: any, i: number) => ({
        id: `src-${Date.now()}-${i}`,
        title: s.source_title || s.title || 'Medical Knowledge Base',
        authors: '',
        journal: s.document_type || 'Curated Reference',
        year: 0,
        doi: '',
        relevance: s.content_snippet || '',
        summary: s.content_snippet || '',
      }));

      const aiMsg: CopilotMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response || 'AI summary could not be generated.',
        sources: sources.length > 0 ? sources : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Copilot query failed:', err);
      const errorMsg: CopilotMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: activePatientId
          ? 'Clinical summary could not be generated at this time. Please retry.'
          : 'Please select a patient from the patient roster to query medical charts.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 bg-gradient-to-tr from-cyan-600 to-teal-500 text-white rounded-full shadow-xl shadow-cyan-600/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-400/40"
        aria-label="Open AI Copilot"
        title="AI Clinical Copilot"
      >
        <Sparkles className="w-6 h-6 animate-pulse" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200/90 dark:border-cyan-500/30 flex flex-col transition-all overflow-hidden ${
      isMinimized ? 'w-80 h-14' : 'w-[440px] sm:w-[480px] h-[640px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-700 to-teal-600 text-white select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Healthcare AI Copilot</h3>
            {!isMinimized && <p className="text-[10px] text-cyan-100 font-medium">Multimodal GenAI + RAG Synthesis</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-cyan-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-cyan-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Patient Context Bar & Selector */}
          <div className="px-3.5 py-2 bg-cyan-50/80 dark:bg-cyan-950/60 border-b border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between text-xs gap-2">
            {user?.role === 'doctor' && patientsList.length > 0 ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wider shrink-0">
                  Patient:
                </span>
                <div className="relative flex-1 min-w-0">
                  <select
                    value={internalPatientId}
                    onChange={(e) => setInternalPatientId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-cyan-200 dark:border-cyan-800 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer truncate"
                  >
                    {patientsList.map((p) => (
                      <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {p.name} ({p.age}y • {p.gender})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="text-xs font-semibold text-cyan-900 dark:text-cyan-200 truncate">
                  {currentPatientName || user?.name || 'Active Patient Chart'}
                </p>
              </div>
            )}
            <span className="text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/80 px-1.5 py-0.5 rounded shrink-0">
              Live EHR
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => {
              const cardTheme = msg.role === 'assistant' ? getMessageCardTheme(msg.content) : null;
              return (
                <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3.5 transition-all duration-300 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-none shadow-md shadow-cyan-600/15'
                      : `${cardTheme?.container || 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'} rounded-bl-none shadow-sm backdrop-blur-sm`
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-xs whitespace-pre-line leading-relaxed font-medium">{msg.content}</p>
                    ) : (
                      <div>
                        {renderFormattedClinicalMessage(msg.content)}
                      </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 font-bold">
                          <BookOpen className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Grounded Evidence Citations
                        </p>
                        <div className="space-y-1">
                          {msg.sources.map((source, i) => (
                            <div key={source.id || i} className="text-[11px] p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50">
                              <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{source.title}</p>
                              {source.summary && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-2 mt-0.5">
                                  &quot;{source.summary.slice(0, 120)}...&quot;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
                  <span>Synthesizing multimodal clinical data...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {suggestedPrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="flex-shrink-0 px-2.5 py-1 bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 text-[10px] font-semibold rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/50 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about this patient or medical findings..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
              <button
                onClick={() => sendMessage()}
                disabled={isThinking}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-cyan-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
