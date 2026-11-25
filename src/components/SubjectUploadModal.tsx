import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { apiRequest, apiUploadWithProgress } from '../lib/api';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  formatFileSize,
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentFile,
} from '../lib/documentLogic';
import { SubjectIcon } from './SubjectIcon';
import type { SubjectItem } from '../types/darbar';

interface SubjectUploadModalProps {
  subject: SubjectItem | null;
  onClose: () => void;
  onUploaded: (subject: SubjectItem) => void;
  onViewSubject: (slug: string) => void;
}

const DOC_CATEGORIES = [
  'Notes',
  'Question Paper',
  'Practice Set',
  'Important Document',
  'Image',
  'Reference',
];

export function SubjectUploadModal({
  subject,
  onClose,
  onUploaded,
  onViewSubject,
}: SubjectUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Notes');
  const [files, setFiles] = useState<File[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset modal state cleanly whenever a subject is opened or closed
  useEffect(() => {
    if (!subject) return;
    setPassword('');
    setVerifying(false);
    setUploadToken(null);
    setTitle('');
    setChapterName('');
    setDescription('');
    setCategory('Notes');
    setFiles([]);
    setThumbnail(null);
    setProgress(0);
    setUploading(false);
    setError(null);
    setSuccess(null);

    const focusTimer = window.setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [subject, onClose]);

  if (!subject) return null;

  const handleVerifyPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError('Please enter the upload password.');
      return;
    }

    setVerifying(true);
    try {
      const res = await apiRequest<{ ok: boolean; uploadToken: string }>(
        '/api/subject-upload/verify',
        {
          method: 'POST',
          body: { password: password.trim() },
        }
      );
      setUploadToken(res.uploadToken);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Incorrect upload password.');
    } finally {
      setVerifying(false);
    }
  };

  const addValidatedFiles = (incoming: FileList | File[]) => {
    setError(null);
    setSuccess(null);
    const next: File[] = [...files];
    for (const f of Array.from(incoming)) {
      const check = validateDocumentFile({
        filename: f.name,
        mimeType: f.type,
        sizeBytes: f.size,
      });
      if (!check.ok) {
        setError(`${f.name}: ${check.error}`);
        return;
      }
      if (next.length >= 8) {
        setError('You can upload up to 8 study files at a time.');
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (!title && next.length === 1) {
      setTitle(next[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addValidatedFiles(e.dataTransfer.files);
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadToken) {
      setError('Upload session locked. Please re-enter the password.');
      return;
    }
    if (files.length === 0) {
      setError('Please select or drop at least one study document file.');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);
    setProgress(8);

    const formData = new FormData();
    formData.append('subjectId', String(subject.id));
    formData.append('title', title.trim());
    formData.append('chapterName', chapterName.trim() || 'General');
    formData.append('description', description.trim());
    formData.append('category', category);
    for (const f of files) {
      formData.append('files', f);
    }
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    try {
      const res = await apiUploadWithProgress<{ message: string }>(
        '/api/subject-upload/documents',
        formData,
        uploadToken,
        'POST',
        (pct) => setProgress(pct)
      );
      setSuccess(res.message);
      setTitle('');
      setChapterName('');
      setDescription('');
      setFiles([]);
      setThumbnail(null);
      setProgress(100);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (thumbInputRef.current) thumbInputRef.current.value = '';
      onUploaded(subject);
    } catch (err: any) {
      const msg = err?.message || 'Upload failed.';
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('expired')) {
        setUploadToken(null);
      }
      setError(msg);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0F2447] dark:bg-teal-900/60 text-white dark:text-teal-300 flex items-center justify-center shrink-0">
              <SubjectIcon name={subject.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#0D9488] dark:text-teal-400">
                {uploadToken ? 'Upload Unlocked' : 'Password-Protected Upload'} · {subject.bengaliName}
              </p>
              <h2
                id="subject-upload-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                Upload to {subject.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload dialog"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!uploadToken ? (
            <form onSubmit={handleVerifyPassword} className="max-w-md mx-auto py-4 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-[#0F2447] dark:text-teal-300 flex items-center justify-center">
                  <Lock className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Enter Upload Password
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Uploading study materials to <strong>{subject.name}</strong> requires password
                  verification.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="subject-upload-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Upload Password
                </label>
                <input
                  ref={passwordInputRef}
                  id="subject-upload-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter upload password"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] dark:focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 disabled:opacity-60 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{verifying ? 'Verifying...' : 'Unlock Upload'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewSubject(subject.slug);
                    }}
                    className="inline-flex items-center gap-1.5 font-semibold underline shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View {subject.name}</span>
                  </button>
                </div>
              )}

              {/* Drag and Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragActive
                    ? 'border-[#1D4ED8] bg-blue-50/70 dark:border-teal-400 dark:bg-teal-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0B1120] hover:border-[#1D4ED8] dark:hover:border-teal-500'
                }`}
              >
                <UploadCloud className="w-8 h-8 mx-auto text-[#1D4ED8] dark:text-teal-400 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Drag &amp; drop study files here, or click to choose
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supported: {ALLOWED_DOCUMENT_EXTENSIONS.join(', ').toUpperCase()} · Up to{' '}
                  {Math.round(MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024))} MB per file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.txt"
                  onChange={(e) => {
                    if (e.target.files) addValidatedFiles(e.target.files);
                  }}
                  className="hidden"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[#0D9488] shrink-0" />
                        <span className="truncate font-medium text-slate-900 dark:text-white">
                          {f.name}
                        </span>
                        <span className="font-mono text-slate-500 shrink-0">
                          {formatFileSize(f.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label={`Remove ${f.name}`}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="su-title"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Document Title
                  </label>
                  <input
                    id="su-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g. ${subject.name} Chapter Notes`}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="su-category"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Material Category
                  </label>
                  <select
                    id="su-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  >
                    {DOC_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="su-chapter"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Chapter / Topic Name
                  </label>
                  <input
                    id="su-chapter"
                    type="text"
                    value={chapterName}
                    onChange={(e) => setChapterName(e.target.value)}
                    placeholder="e.g. Chapter 1 or Full Syllabus"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="su-thumb"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Optional Thumbnail Image
                  </label>
                  <input
                    ref={thumbInputRef}
                    id="su-thumb"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="su-desc"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Short Description
                </label>
                <textarea
                  id="su-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of topics, derivations, or board questions included..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Uploading to {subject.name}...</span>
                    <span className="font-mono tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#0D9488] transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setUploadToken(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Session</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || files.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0D9488] text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{uploading ? 'Uploading...' : `Upload to ${subject.name}`}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
