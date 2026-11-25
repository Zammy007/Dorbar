import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const UPLOADS_DIR = path.resolve(STORAGE_ROOT, 'uploads');
export const THUMBNAILS_DIR = path.resolve(STORAGE_ROOT, 'thumbnails');

export function ensureStorageDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  }
}

export function resolveConfinedPath(baseDir: string, storedName: string): string {
  const cleanName = path.basename(storedName);
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, cleanName);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return resolvedTarget;
}

export function saveBufferToStorage(
  baseDir: string,
  buffer: Buffer,
  extension: string
): { storedName: string; sizeBytes: number } {
  ensureStorageDirs();
  const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const storedName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${safeExt}`;
  const fullPath = resolveConfinedPath(baseDir, storedName);
  fs.writeFileSync(fullPath, buffer);
  return { storedName, sizeBytes: buffer.length };
}

export function deleteFromStorage(baseDir: string, storedName: string | null | undefined) {
  if (!storedName) return;
  try {
    const fullPath = resolveConfinedPath(baseDir, storedName);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('Failed to remove file from storage:', err);
  }
}

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a valid, standards-compliant PDF 1.4 document buffer containing structured
 * Class 11/12 study content so seeded resources preview and download cleanly across all browsers.
 */
export function createStudyPdfBuffer(
  title: string,
  subtitle: string,
  lines: string[]
): Buffer {
  const streamLines: string[] = [
    'BT',
    '/F1 18 Tf',
    '54 745 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -22 Td',
    `(${escapePdfText(subtitle)}) Tj`,
    '0 -16 Td',
    '(Darbar Educational Resource Archive - Class 11 & 12) Tj',
    '0 -26 Td',
    '/F1 10.5 Tf',
  ];

  for (const line of lines.slice(0, 38)) {
    streamLines.push(`(${escapePdfText(line)}) Tj`);
    streamLines.push('0 -16 Td');
  }
  streamLines.push('ET');
  const streamContent = streamLines.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
