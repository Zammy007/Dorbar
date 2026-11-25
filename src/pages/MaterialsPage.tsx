import { useCallback, useEffect, useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { DocumentCard } from '../components/DocumentCard';
import type { AppRoute, DocumentItem, SubjectItem } from '../types/darbar';

interface MaterialsPageProps {
  subjects: SubjectItem[];
  initialQuery?: string;
  onNavigate: (route: AppRoute, param?: string) => void;
  onPreviewDocument: (doc: DocumentItem) => void;
}

const FORMATS = ['all', 'PDF', 'TXT', 'PNG', 'JPG', 'WEBP', 'DOC', 'DOCX', 'PPT', 'PPTX'];
const CATEGORIES = [
  'all',
  'Notes',
  'Question Paper',
  'Practice Set',
  'Important Document',
  'Image',
  'Reference',
];

export function MaterialsPage({
  subjects,
  initialQuery = '',
  onNavigate,
  onPreviewDocument,
}: MaterialsPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [subject, setSubject] = useState('all');
  const [format, setFormat] = useState('all');
  const [category, setCategory] = useState('all');
  const [dateWindow, setDateWindow] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        subject,
        format,
        category,
        date: dateWindow,
        sort,
        page: String(page),
        limit: '12',
      });
      const res = await apiRequest<{
        documents: DocumentItem[];
        pagination: { page: number; total: number; totalPages: number };
      }>(`/api/documents?${params.toString()}`);
      setDocs(res.documents);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load study materials.');
    } finally {
      setLoading(false);
    }
  }, [query, subject, format, category, dateWindow, sort, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const resetFilters = () => {
    setQuery('');
    setSubject('all');
    setFormat('all');
    setCategory('all');
    setDateWindow('all');
    setSort('newest');
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2447] dark:text-white">
          Study Materials Library
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
          Search across all Class 11 &amp; 12 subjects by title, chapter, keywords, format, or
          upload date. Preview online or download directly to your device.
        </p>
      </div>

      {/* Subject Quick Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setSubject('all');
            setPage(1);
          }}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            subject === 'all'
              ? 'bg-[#0F2447] dark:bg-blue-600 text-white'
              : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Subjects
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSubject(s.slug);
              setPage(1);
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
              subject === s.slug
                ? 'bg-[#0F2447] dark:bg-blue-600 text-white'
                : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="materials-search" className="sr-only">
              Search documents
            </label>
            <input
              id="materials-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by document title, chapter name, subject, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/40"
            />
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div>
            <label
              htmlFor="filter-format"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              File Type
            </label>
            <select
              id="filter-format"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f === 'all' ? 'All Formats' : f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Resource Category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-date"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Upload Date
            </label>
            <select
              id="filter-date"
              value={dateWindow}
              onChange={(e) => {
                setDateWindow(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200"
            >
              <option value="all">Any time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-sort"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Sort Order
            </label>
            <select
              id="filter-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'newest' | 'oldest');
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-800 dark:text-slate-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="tabular-nums">
            Showing {docs.length} of {total} study resources
          </span>
        </div>
        {subject !== 'all' && (
          <button
            type="button"
            onClick={() => onNavigate('subject', subject)}
            className="font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline"
          >
            Open dedicated subject page
          </button>
        )}
      </div>

      {/* Results Grid / States */}
      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-60 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Search className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            No matching study materials found
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Try clearing your search term or relaxing one of the subject, format, or date filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] transition-colors"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {docs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onPreview={onPreviewDocument}
                onRequireStudentLogin={() => onNavigate('student')}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
