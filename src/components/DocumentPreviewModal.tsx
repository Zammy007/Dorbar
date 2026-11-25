import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { formatFileSize, isPreviewableFormat } from '../lib/documentLogic';
import { apiRequest, triggerDocumentDownload } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { DocumentItem } from '../types/darbar';

interface DocumentPreviewModalProps {
  doc: DocumentItem | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  const { studentToken } = useAuth();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!doc) return;
    if (studentToken) {
      apiRequest(`/api/student/views/${doc.id}`, {
        method: 'POST',
        token: studentToken,
      }).catch(() => {});
    }

    if (doc.fileFormat.toUpperCase() === 'TXT') {
      setLoadingText(true);
      fetch(`/api/documents/${doc.id}/preview`)
        .then((r) => r.text())
        .then((t) => setTextContent(t))
        .catch(() => setTextContent('Unable to load text preview. Please download the file.'))
        .finally(() => setLoadingText(false));
    } else {
      setTextContent(null);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, studentToken, onClose]);

  if (!doc) return null;

  const fmt = doc.fileFormat.toUpperCase();
  const previewUrl = `/api/documents/${doc.id}/preview`;
  const isImage = ['JPG', 'JPEG', 'PNG', 'WEBP'].includes(fmt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium text-[#1D4ED8] dark:text-teal-400">{doc.subjectName}</span>
              <span aria-hidden="true">·</span>
              <span>{doc.chapterName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {fmt} ({formatFileSize(doc.fileSizeBytes)})
              </span>
            </div>
            <h2
              id="doc-preview-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white truncate"
            >
              {doc.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close document preview"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Stage */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0B1120] p-4 sm:p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
            {doc.description}
          </p>

          {fmt === 'PDF' ? (
            <div className="w-full h-[52vh] min-h-[340px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <object
                data={`${previewUrl}#view=FitH`}
                type="application/pdf"
                aria-label={`PDF Preview: ${doc.title}`}
                className="w-full h-full"
              >
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-400" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Inline PDF preview is not supported by this browser.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                    Tap “Open Fullscreen” or “Download PDF” below to read {doc.title} cleanly on your device.
                  </p>
                </div>
              </object>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <img
                src={previewUrl}
                alt={doc.title}
                referrerPolicy="no-referrer"
                className="max-h-[55vh] w-auto rounded-lg object-contain"
              />
            </div>
          ) : fmt === 'TXT' ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              {loadingText ? (
                <div className="h-32 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {textContent}
                </pre>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                In-browser preview is not supported for {fmt} files.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Download this study resource directly to open it with your device’s document viewer.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Category: <strong className="text-slate-700 dark:text-slate-200">{doc.category}</strong> ·{' '}
            {doc.downloadCount} downloads
          </div>
          <div className="flex items-center gap-3">
            {isPreviewableFormat(fmt) && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Fullscreen</span>
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                triggerDocumentDownload(
                  doc.id,
                  doc.originalFileName || `${doc.title}.${fmt.toLowerCase()}`,
                  studentToken
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {fmt}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
