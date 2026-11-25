import { useState } from 'react';
import {
  Bookmark,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { formatFileSize, isPreviewableFormat } from '../lib/documentLogic';
import { triggerDocumentDownload } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { DocumentItem } from '../types/darbar';

interface DocumentCardProps {
  doc: DocumentItem;
  onPreview: (doc: DocumentItem) => void;
  onRequireStudentLogin?: () => void;
  onDownloadSuccess?: (docId: number) => void;
}

function formatDate(dateIso: string): string {
  try {
    return new Date(dateIso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function DocumentCard({
  doc,
  onPreview,
  onRequireStudentLogin,
  onDownloadSuccess,
}: DocumentCardProps) {
  const { student, studentToken, savedDocIds, toggleBookmark } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [localDownloads, setLocalDownloads] = useState(doc.downloadCount);

  const isSaved = savedDocIds.has(doc.id);
  const fmt = doc.fileFormat.toUpperCase();
  const isImage = ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(fmt);
  const isPresentation = ['PPT', 'PPTX'].includes(fmt);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await triggerDocumentDownload(
        doc.id,
        doc.originalFileName || `${doc.title}.${fmt.toLowerCase()}`,
        studentToken
      );
      setLocalDownloads((prev) => prev + 1);
      onDownloadSuccess?.(doc.id);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleBookmark = async () => {
    if (!student) {
      onRequireStudentLogin?.();
      return;
    }
    try {
      await toggleBookmark(doc.id);
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    }
  };

  return (
    <article className="group flex flex-col justify-between bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 transition-all duration-200 hover:border-blue-300 dark:hover:border-slate-600 hover:shadow-sm">
      <div>
        {/* Optional Thumbnail or Clean File Format Header */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {doc.thumbnailPath && !thumbError ? (
              <img
                src={`/api/thumbnails/${doc.thumbnailPath}`}
                alt={`Preview thumbnail for ${doc.title}`}
                referrerPolicy="no-referrer"
                onError={() => setThumbError(true)}
                className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[#0F2447] dark:text-teal-300 flex items-center justify-center shrink-0">
                {isImage ? (
                  <FileImage className="w-5 h-5" aria-hidden="true" />
                ) : isPresentation ? (
                  <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <FileText className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-[#1D4ED8] dark:text-teal-400">
                  {doc.subjectName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{doc.category}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {doc.chapterName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBookmark}
            aria-label={isSaved ? `Remove "${doc.title}" from saved` : `Save "${doc.title}"`}
            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border transition-colors shrink-0 ${
              isSaved
                ? 'border-teal-500/40 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2">
          {doc.title}
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 mb-4">
          {doc.description}
        </p>
      </div>

      <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        {/* Clean unboxed typographic metadata */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt}</span>
          <span aria-hidden="true">·</span>
          <span>{formatFileSize(doc.fileSizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(doc.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{localDownloads} downloads</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPreview(doc)}
            aria-label={`Preview ${doc.title}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isPreviewableFormat(fmt) ? 'Preview' : 'Details'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={`Download ${doc.title}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{downloading ? 'Saving...' : 'Download'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
