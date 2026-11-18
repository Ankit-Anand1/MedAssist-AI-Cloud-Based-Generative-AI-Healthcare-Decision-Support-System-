'use client';

import { useState, useEffect } from 'react';
import { Search, BookOpen, ExternalLink, Filter, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

export default function EvidenceAndKnowledge() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournal, setSelectedJournal] = useState('All');

  useEffect(() => {
    if (!user) return;
    const fetchEvidence = async () => {
      try {
        const data = await api.get('/api/ai-analysis/research-evidence');
        setEvidenceList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load research evidence:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvidence();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-accent-600 animate-spin" />
      </div>
    );
  }

  const journals = ['All', ...Array.from(new Set(evidenceList.map(e => e.journal).filter(Boolean)))];

  const filtered = evidenceList.filter(e => {
    const matchesQuery =
      (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.relevance || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.journal || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJournal = selectedJournal === 'All' || e.journal === selectedJournal;
    return matchesQuery && matchesJournal;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('nav.evidence', 'Evidence & Knowledge Base')}
          </h1>
          <span className="text-[10px] px-2.5 py-1 bg-accent-50 dark:bg-accent-950/60 text-accent-700 dark:text-accent-300 border border-accent-200 dark:border-accent-800 rounded-full font-bold uppercase tracking-wider">
            RAG Pipeline Vector Knowledge
          </span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Peer-reviewed medical research papers and clinical guidelines indexed by the Retrieval-Augmented Generation (RAG) system to ground AI recommendations in verified clinical evidence
        </p>
      </div>

      {/* RAG Context Banner */}
      <div className="bg-accent-50/70 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-900/50 rounded-2xl px-5 py-4 flex items-start gap-3 backdrop-blur-md">
        <BookOpen className="w-5 h-5 text-accent-600 dark:text-accent-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-accent-900 dark:text-accent-200">RAG-Grounded Evidence</p>
          <p className="text-xs text-accent-700 dark:text-accent-400 mt-0.5 leading-relaxed">
            These curated evidence sources are embedded in the vector store and dynamically retrieved whenever AI Patient Briefs or AI Copilot answers are synthesized. High relevance scores ensure transparency and prevent clinical hallucination.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search evidence by title, journal, author, or clinical relevance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 shadow-sm"
          />
        </div>

        {/* Journal Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {journals.map((j) => (
            <button
              key={j}
              onClick={() => setSelectedJournal(j)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                selectedJournal === j
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              {j}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Cards */}
      <div className="space-y-4">
        {filtered.map((evidence) => {
          const doiUrl = evidence.doi
            ? (evidence.doi.startsWith('http') ? evidence.doi : `https://doi.org/${evidence.doi}`)
            : null;

          return (
            <div
              key={evidence.id}
              className="medical-glass-card p-6 shadow-xl hover:border-cyan-500/40 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-950/60 rounded-xl flex items-center justify-center shrink-0 border border-cyan-200 dark:border-cyan-800/80 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                      <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                        {evidence.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{evidence.authors}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{evidence.journal}</span> ({evidence.year})
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 ml-13 space-y-3">
                    <div className="bg-cyan-50/60 dark:bg-cyan-950/30 rounded-xl p-3.5 border border-cyan-200/80 dark:border-cyan-800/50 shadow-[0_0_10px_rgba(6,182,212,0.08)]">
                      <p className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-cyan-500" />
                        Clinical Relevance
                      </p>
                      <p className="text-xs text-cyan-950 dark:text-cyan-200 leading-relaxed font-medium">
                        {evidence.relevance}
                      </p>
                    </div>

                    <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-1">
                        Abstract &amp; Study Synthesis
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {evidence.summary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {doiUrl && (
                <div className="mt-4 ml-13 flex items-center gap-1.5 text-xs">
                  <a
                    href={doiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent-600 dark:text-accent-400 hover:underline font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    DOI: {evidence.doi}
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white/90 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-400">
            No research evidence matching your search criteria
          </div>
        )}
      </div>
    </div>
  );
}
