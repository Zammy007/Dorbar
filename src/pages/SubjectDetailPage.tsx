import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { filterAndSortDocuments } from '../lib/documentLogic';
import { SubjectIcon } from '../components/SubjectIcon';
import { DocumentCard } from '../components/DocumentCard';
import type { AppRoute, DocumentItem, SubjectItem } from '../types/darbar';

interface SubjectDetailPageProps {
  slug: string;
  subjects: SubjectItem[];
  onNavigate: (route: AppRoute, param?: string) => void;
  onPreviewDocument: (doc: DocumentItem) => void;
}

const RESOURCE_TABS = [
  'all',
  'Notes',
  'Question Paper',
  'Practice Set',
  'Important Document',
  'Image',
  'Reference',
];

export function SubjectDetailPage({
  slug,
  subjects,
  onNavigate,
  onPreviewDocument,
}: SubjectDetailPageProps) {
  const [subject, setSubject] = useState<SubjectItem | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [categoryTab, setCategoryTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCategoryTab('all');
    setQuery('');
    apiRequest<{ subject: SubjectItem; documents: DocumentItem[] }>(`/api/subjects/${slug}`)
      .then((res) => {
        setSubject(res.subject);
        setDocuments(res.documents);
      })
      .catch((err: any) => {
        setError(err?.message || 'Could not load subject archive.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const filteredDocs = useMemo(
    () =>
      filterAndSortDocuments(documents, {
        query,
        category: categoryTab,
        sortBy,
      }),
    [documents, query, categoryTab, sortBy]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-36 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Subject Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {error || 'We could not locate this subject archive.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('materials')}
          className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#0F2447] text-white"
        >
          Back to Study Materials
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <button
        type="button"
        onClick={() => onNavigate('materials')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#0F2447] dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        <span>All Study Materials</span>
      </button>

      {/* Subject Banner */}
      <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="w-14 h-14 rounded-xl bg-[#0F2447] dark:bg-teal-900/60 text-white dark:text-teal-300 flex items-center justify-center shrink-0">
            <SubjectIcon name={subject.icon} className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{subject.bengaliName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{documents.length} uploaded resources</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2447] dark:text-white">
              {subject.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {subject.description}
            </p>
          </div>
        </div>

        {/* Switch Subject Dropdown */}
        <div className="shrink-0">
          <label
            htmlFor="switch-subject"
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            Switch Subject
          </label>
          <select
            id="switch-subject"
            value={subject.slug}
            onChange={(e) => onNavigate('subject', e.target.value)}
            className="px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Category Filter Tabs + Local Search + Sort */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {RESOURCE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategoryTab(tab)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                categoryTab === tab
                  ? 'bg-[#0F2447] dark:bg-blue-600 text-white'
                  : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'all' ? 'All Resources' : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="subject-doc-search" className="sr-only">
              Search within {subject.name}
            </label>
            <input
              id="subject-doc-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search in ${subject.name}...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-white"
            />
          </div>
          <select
            aria-label="Sort subject documents"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {/* Document Grid */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2">
          <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No documents match this filter in {subject.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select "All Resources" or clear your search term to view available files.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onPreview={onPreviewDocument}
              onRequireStudentLogin={() => onNavigate('student')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
