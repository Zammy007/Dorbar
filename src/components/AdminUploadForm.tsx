import { DragEvent, FormEvent, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  UploadCloud,
  X,
} from 'lucide-react';
import { apiUploadWithProgress } from '../lib/api';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  formatFileSize,
  MAX_DOCUMENT_SIZE_BYTES,
  validateDocumentFile,
} from '../lib/documentLogic';
import type { SubjectItem } from '../types/darbar';

interface AdminUploadFormProps {
  token: string;
  subjects: SubjectItem[];
  onUploaded: () => void;
}

const DOC_CATEGORIES = [
  'Notes',
  'Question Paper',
  'Practice Set',
  'Important Document',
  'Image',
  'Reference',
];

export function AdminUploadForm({ token, subjects, onUploaded }: AdminUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string>(String(subjects[0]?.id ?? ''));
  const [chapterName, setChapterName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Notes');
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  const [files, setFiles] = useState<File[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError('You can upload up to 8 documents in a single batch.');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (files.length === 0) {
      setError('Please drop or select at least one document file.');
      return;
    }
    const chosenSubjectId = subjectId || String(subjects[0]?.id ?? '');
    if (!chosenSubjectId) {
      setError('Please select a subject.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('subjectId', chosenSubjectId);
    formData.append('chapterName', chapterName.trim() || 'General');
    formData.append('description', description.trim());
    formData.append('category', category);
    formData.append('status', status);
    for (const f of files) {
      formData.append('files', f);
    }
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    setUploading(true);
    setProgress(5);
    try {
      const res = await apiUploadWithProgress<{ message: string }>(
        '/api/admin/documents',
        formData,
        token,
        'POST',
        (pct) => setProgress(pct)
      );
      setSuccess(res.message);
      setTitle('');
      setChapterName('');
      setDescription('');
      setFiles([]);
      setThumbnail(null);
      setShowPreview(false);
      setProgress(0);
      onUploaded();
    } catch (err: any) {
      setError(err?.message || 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const selectedSubject = subjects.find((s) => String(s.id) === (subjectId || String(subjects[0]?.id)));

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
            Upload Study Materials
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Supports {ALLOWED_DOCUMENT_EXTENSIONS.join(', ').toUpperCase()} up to{' '}
            {formatFileSize(MAX_DOCUMENT_SIZE_BYTES)} per file. Multiple files allowed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{showPreview ? 'Hide Preview' : 'Preview Before Publishing'}</span>
        </button>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragActive
            ? 'border-[#0D9488] bg-teal-50/50 dark:bg-teal-950/20'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0B1120]'
        }`}
      >
        <UploadCloud className="w-8 h-8 mx-auto text-[#1D4ED8] dark:text-teal-400 mb-2" />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Drag &amp; drop PDFs, images, or notes here
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          or select files from your computer (max 8 files at once)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.txt"
          onChange={(e) => {
            if (e.target.files) addValidatedFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
          id="admin-file-upload-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666]"
        >
          Browse Files
        </button>
      </div>

      {/* Queued Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-[#0D9488] shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {f.name}
                </span>
                <span className="font-mono text-slate-500 tabular-nums shrink-0">
                  {formatFileSize(f.size)}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form Metadata Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="upload-title"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Document Title *
          </label>
          <input
            id="upload-title"
            type="text"
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Class 12 Alternating Current Derivations"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="upload-subject"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Subject *
          </label>
          <select
            id="upload-subject"
            value={subjectId || String(subjects[0]?.id ?? '')}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="upload-chapter"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Chapter Name
          </label>
          <input
            id="upload-chapter"
            type="text"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder="e.g. Chapter 7: Alternating Current"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="upload-category"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Document Category
          </label>
          <select
            id="upload-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="upload-description"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Short Description *
        </label>
        <textarea
          id="upload-description"
          rows={3}
          required
          minLength={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Summarize key topics, formulas, or exam chapters included in this file..."
          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
        />
      </div>

      {/* Optional Thumbnail & Publish Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label
            htmlFor="upload-thumbnail"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Optional Thumbnail (JPG, PNG, WEBP · max 3 MB)
          </label>
          <input
            ref={thumbInputRef}
            id="upload-thumbnail"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Publication Mode
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120]">
            <button
              type="button"
              onClick={() => setStatus('published')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                status === 'published'
                  ? 'bg-white dark:bg-slate-800 text-[#0F2447] dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Publish Now
            </button>
            <button
              type="button"
              onClick={() => setStatus('draft')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                status === 'draft'
                  ? 'bg-white dark:bg-slate-800 text-[#0F2447] dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Save as Draft
            </button>
          </div>
        </div>
      </div>

      {/* Preview Card before Publishing */}
      {showPreview && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] p-4 space-y-2">
          <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
            Student Card Preview ({status === 'published' ? 'Will appear publicly' : 'Draft only'})
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedSubject?.name || 'Subject'} · {category} · {chapterName || 'General'}
          </p>
          <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {title || 'Untitled Study Resource'}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {description || 'Document description will appear here.'}
          </p>
        </div>
      )}

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            <span>Uploading to Darbar storage...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-[#0D9488] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading}
          className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white disabled:opacity-60 transition-colors"
        >
          {uploading
            ? 'Uploading...'
            : status === 'published'
              ? 'Upload & Publish'
              : 'Upload as Draft'}
        </button>
      </div>
    </form>
  );
}
