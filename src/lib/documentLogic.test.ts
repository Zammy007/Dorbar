import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortDocuments,
  formatFileSize,
  isPreviewableFormat,
  sanitizeDownloadFilename,
  validateDocumentFile,
} from './documentLogic';

test('validateDocumentFile allows supported study document formats and rejects executables or oversized files', () => {
  const validPdf = validateDocumentFile({
    filename: 'Class12_Electrostatics.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 512_000,
  });
  assert.equal(validPdf.ok, true);

  const badExt = validateDocumentFile({
    filename: 'payload.exe',
    mimeType: 'application/octet-stream',
    sizeBytes: 1024,
  });
  assert.equal(badExt.ok, false);

  const oversized = validateDocumentFile({
    filename: 'huge.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 25 * 1024 * 1024,
  });
  assert.equal(oversized.ok, false);

  const mismatch = validateDocumentFile({
    filename: 'notes.pdf',
    mimeType: 'text/html',
    sizeBytes: 1024,
  });
  assert.equal(mismatch.ok, false);
});

test('formatFileSize and sanitizeDownloadFilename handle edge cases', () => {
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(3 * 1024 * 1024), '3.00 MB');
  assert.equal(sanitizeDownloadFilename('../../etc/passwd?.pdf'), '.._.._etc_passwd_.pdf');
  assert.equal(isPreviewableFormat('PDF'), true);
  assert.equal(isPreviewableFormat('DOCX'), false);
});

test('filterAndSortDocuments filters by query, subject, format, and sorts newest/oldest', () => {
  const docs = [
    {
      id: 1,
      title: 'Electrostatics Notes',
      chapterName: 'Chapter 1',
      description: 'Gauss law derivations',
      category: 'Notes',
      fileFormat: 'PDF',
      subjectSlug: 'physics',
      subjectName: 'Physics',
      createdAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 2,
      title: 'Organic Reactions Chart',
      chapterName: 'Aldehydes',
      description: 'Named reactions summary',
      category: 'Image',
      fileFormat: 'PNG',
      subjectSlug: 'chemistry',
      subjectName: 'Chemistry',
      createdAt: '2026-11-23T10:00:00Z',
    },
  ];

  const byQuery = filterAndSortDocuments(docs, { query: 'gauss' });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].id, 1);

  const sortedOldest = filterAndSortDocuments(docs, { sortBy: 'oldest' });
  assert.equal(sortedOldest[0].id, 1);

  const sortedNewest = filterAndSortDocuments(docs, { sortBy: 'newest' });
  assert.equal(sortedNewest[0].id, 2);
});
