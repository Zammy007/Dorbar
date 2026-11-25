export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'txt',
] as const;

export const ALLOWED_THUMBNAIL_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_THUMBNAIL_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  doc: ['application/msword', 'application/octet-stream'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ],
  ppt: ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream',
  ],
  txt: ['text/plain'],
};

export function extractExtension(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const parts = base.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().trim();
}

export function validateDocumentFile(params: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): { ok: true; extension: string } | { ok: false; error: string } {
  const ext = extractExtension(params.filename);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
    return {
      ok: false,
      error: `Unsupported file format ".${ext || 'unknown'}". Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ').toUpperCase()}.`,
    };
  }

  if (params.sizeBytes <= 0) {
    return { ok: false, error: 'Uploaded file cannot be empty.' };
  }

  if (params.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false,
      error: `File exceeds the maximum allowed size of ${formatFileSize(MAX_DOCUMENT_SIZE_BYTES)}.`,
    };
  }

  const allowedMimes = MIME_BY_EXT[ext] ?? [];
  const cleanMime = (params.mimeType || '').split(';')[0].trim().toLowerCase();
  if (cleanMime && !allowedMimes.includes(cleanMime)) {
    return {
      ok: false,
      error: `File content type "${cleanMime}" does not match extension ".${ext}".`,
    };
  }

  return { ok: true, extension: ext.toUpperCase() };
}

export function sanitizeDownloadFilename(name: string): string {
  const stripped = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  return stripped.slice(0, 120) || 'darbar_document';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export function isPreviewableFormat(fileFormat: string): boolean {
  const fmt = fileFormat.toLowerCase();
  return fmt === 'pdf' || fmt === 'txt' || fmt === 'png' || fmt === 'jpg' || fmt === 'jpeg' || fmt === 'webp';
}

export interface FilterableDocument {
  id: number;
  title: string;
  chapterName: string;
  description: string;
  category: string;
  fileFormat: string;
  subjectSlug: string;
  subjectName: string;
  createdAt: string;
}

export function filterAndSortDocuments<T extends FilterableDocument>(
  docs: T[],
  options: {
    query?: string;
    subjectSlug?: string;
    fileFormat?: string;
    category?: string;
    dateWindow?: 'all' | '7d' | '30d' | '90d';
    sortBy?: 'newest' | 'oldest';
    nowMs?: number;
  }
): T[] {
  const q = (options.query ?? '').trim().toLowerCase();
  const now = options.nowMs ?? Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const filtered = docs.filter((doc) => {
    if (options.subjectSlug && options.subjectSlug !== 'all' && doc.subjectSlug !== options.subjectSlug) {
      return false;
    }
    if (options.fileFormat && options.fileFormat !== 'all' && doc.fileFormat.toLowerCase() !== options.fileFormat.toLowerCase()) {
      return false;
    }
    if (options.category && options.category !== 'all' && doc.category.toLowerCase() !== options.category.toLowerCase()) {
      return false;
    }
    if (options.dateWindow && options.dateWindow !== 'all') {
      const created = new Date(doc.createdAt).getTime();
      const days = options.dateWindow === '7d' ? 7 : options.dateWindow === '30d' ? 30 : 90;
      if (!Number.isFinite(created) || now - created > days * dayMs) {
        return false;
      }
    }
    if (q) {
      const haystack = `${doc.title} ${doc.chapterName} ${doc.description} ${doc.subjectName} ${doc.category} ${doc.fileFormat}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const direction = options.sortBy === 'oldest' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return diff * direction;
  });
}
