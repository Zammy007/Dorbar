import fs from 'node:fs';
import { Router } from 'express';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  announcements,
  contactMessages,
  documentDownloads,
  documents,
  platformSettings,
  quizzes,
  subjects,
  users,
} from '../../src/db/schema.ts';
import { DEFAULT_HOMEPAGE_SETTINGS, ensureSeeded } from '../seed.ts';
import { type DarbarRequest, optionalStudentAuth } from '../authMiddleware.ts';
import { hashIp } from '../crypto.ts';
import { resolveConfinedPath, THUMBNAILS_DIR, UPLOADS_DIR } from '../storage.ts';
import { sanitizeDownloadFilename } from '../../src/lib/documentLogic.ts';

export const publicRouter = Router();

publicRouter.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('Database initialization failed:', err);
    res.status(503).json({ error: 'Database is temporarily unavailable. Please try again.' });
  }
});

publicRouter.get('/bootstrap', async (_req, res) => {
  try {
    const [
      [{ totalDocuments }],
      [{ totalSubjects }],
      [{ totalQuizzes }],
      [{ totalStudents }],
      allSubjects,
      recentDocs,
      activeAnnouncements,
      settingsRows,
      docCountsBySubject,
    ] = await Promise.all([
      db.select({ totalDocuments: count() }).from(documents).where(eq(documents.status, 'published')),
      db.select({ totalSubjects: count() }).from(subjects),
      db.select({ totalQuizzes: count() }).from(quizzes).where(eq(quizzes.status, 'published')),
      db.select({ totalStudents: count() }).from(users),
      db.select().from(subjects).orderBy(subjects.displayOrder, subjects.id),
      db
        .select({
          id: documents.id,
          subjectId: documents.subjectId,
          subjectSlug: subjects.slug,
          subjectName: subjects.name,
          title: documents.title,
          chapterName: documents.chapterName,
          description: documents.description,
          category: documents.category,
          fileFormat: documents.fileFormat,
          fileSizeBytes: documents.fileSizeBytes,
          thumbnailPath: documents.thumbnailPath,
          downloadCount: documents.downloadCount,
          viewCount: documents.viewCount,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .innerJoin(subjects, eq(documents.subjectId, subjects.id))
        .where(eq(documents.status, 'published'))
        .orderBy(desc(documents.createdAt))
        .limit(8),
      db
        .select()
        .from(announcements)
        .where(eq(announcements.isActive, true))
        .orderBy(desc(announcements.createdAt))
        .limit(5),
      db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'homepage_content'))
        .limit(1),
      db
        .select({
          subjectId: documents.subjectId,
          docCount: count(),
        })
        .from(documents)
        .where(eq(documents.status, 'published'))
        .groupBy(documents.subjectId),
    ]);

    const countMap = new Map<number, number>();
    for (const row of docCountsBySubject) {
      countMap.set(row.subjectId, Number(row.docCount));
    }

    const homepage = {
      ...DEFAULT_HOMEPAGE_SETTINGS,
      ...(settingsRows[0]?.value ?? {}),
    };

    res.json({
      stats: {
        totalDocuments: Number(totalDocuments),
        totalSubjects: Number(totalSubjects),
        totalQuizzes: Number(totalQuizzes),
        totalStudents: Number(totalStudents),
      },
      subjects: allSubjects.map((s) => ({
        ...s,
        documentCount: countMap.get(s.id) ?? 0,
      })),
      recentDocuments: recentDocs,
      announcements: activeAnnouncements,
      homepage,
    });
  } catch (err) {
    console.error('Bootstrap query failed:', err);
    res.status(500).json({ error: 'Failed to load platform data.' });
  }
});

publicRouter.get('/subjects', async (_req, res) => {
  try {
    const [allSubjects, docCounts] = await Promise.all([
      db.select().from(subjects).orderBy(subjects.displayOrder, subjects.id),
      db
        .select({ subjectId: documents.subjectId, docCount: count() })
        .from(documents)
        .where(eq(documents.status, 'published'))
        .groupBy(documents.subjectId),
    ]);

    const countMap = new Map(docCounts.map((r) => [r.subjectId, Number(r.docCount)]));
    res.json({
      subjects: allSubjects.map((s) => ({
        ...s,
        documentCount: countMap.get(s.id) ?? 0,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch subjects:', err);
    res.status(500).json({ error: 'Failed to load subjects.' });
  }
});

publicRouter.get('/subjects/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const found = await db.select().from(subjects).where(eq(subjects.slug, slug)).limit(1);
    if (found.length === 0) {
      return res.status(404).json({ error: 'Subject not found.' });
    }
    const subject = found[0];
    const docs = await db
      .select({
        id: documents.id,
        subjectId: documents.subjectId,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
        title: documents.title,
        chapterName: documents.chapterName,
        description: documents.description,
        category: documents.category,
        fileFormat: documents.fileFormat,
        mimeType: documents.mimeType,
        fileSizeBytes: documents.fileSizeBytes,
        originalFileName: documents.originalFileName,
        thumbnailPath: documents.thumbnailPath,
        downloadCount: documents.downloadCount,
        viewCount: documents.viewCount,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .innerJoin(subjects, eq(documents.subjectId, subjects.id))
      .where(and(eq(documents.subjectId, subject.id), eq(documents.status, 'published')))
      .orderBy(desc(documents.createdAt));

    res.json({ subject, documents: docs });
  } catch (err) {
    console.error('Failed to load subject page:', err);
    res.status(500).json({ error: 'Failed to load subject materials.' });
  }
});

publicRouter.get('/documents', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const subjectSlug = String(req.query.subject || 'all').trim().toLowerCase();
    const fileFormat = String(req.query.format || 'all').trim().toUpperCase();
    const category = String(req.query.category || 'all').trim();
    const dateWindow = String(req.query.date || 'all').trim();
    const sort = String(req.query.sort || 'newest').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(6, Number(req.query.limit) || 12));

    const conditions = [eq(documents.status, 'published')];

    if (subjectSlug && subjectSlug !== 'all') {
      conditions.push(eq(subjects.slug, subjectSlug));
    }
    if (fileFormat && fileFormat !== 'ALL') {
      conditions.push(eq(documents.fileFormat, fileFormat));
    }
    if (category && category !== 'all') {
      conditions.push(eq(documents.category, category));
    }
    if (dateWindow === '7d' || dateWindow === '30d' || dateWindow === '90d') {
      const days = dateWindow === '7d' ? 7 : dateWindow === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      conditions.push(sql`${documents.createdAt} >= ${since}`);
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(documents.title, pattern),
          ilike(documents.chapterName, pattern),
          ilike(documents.description, pattern),
          ilike(documents.category, pattern),
          ilike(subjects.name, pattern),
          ilike(subjects.bengaliName, pattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(documents)
      .innerJoin(subjects, eq(documents.subjectId, subjects.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: documents.id,
        subjectId: documents.subjectId,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
        title: documents.title,
        chapterName: documents.chapterName,
        description: documents.description,
        category: documents.category,
        fileFormat: documents.fileFormat,
        mimeType: documents.mimeType,
        fileSizeBytes: documents.fileSizeBytes,
        originalFileName: documents.originalFileName,
        thumbnailPath: documents.thumbnailPath,
        downloadCount: documents.downloadCount,
        viewCount: documents.viewCount,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .innerJoin(subjects, eq(documents.subjectId, subjects.id))
      .where(whereClause)
      .orderBy(sort === 'oldest' ? documents.createdAt : desc(documents.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      documents: rows,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
      },
    });
  } catch (err) {
    console.error('Document search failed:', err);
    res.status(500).json({ error: 'Failed to search study documents.' });
  }
});

publicRouter.get('/thumbnails/:file', (req, res) => {
  try {
    const file = String(req.params.file || '');
    const fullPath = resolveConfinedPath(THUMBNAILS_DIR, file);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(fullPath);
  } catch {
    res.status(400).end();
  }
});

publicRouter.get('/documents/:id/preview', async (req, res) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    const found = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.status, 'published')))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const doc = found[0];
    const fullPath = resolveConfinedPath(UPLOADS_DIR, doc.storagePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Document file is missing from storage.' });
    }

    await db
      .update(documents)
      .set({ viewCount: sql`${documents.viewCount} + 1` })
      .where(eq(documents.id, doc.id));

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeDownloadFilename(doc.originalFileName)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Preview failed:', err);
    res.status(500).json({ error: 'Could not preview document.' });
  }
});

publicRouter.get('/documents/:id/download', optionalStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    const found = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.status, 'published')))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = found[0];
    const fullPath = resolveConfinedPath(UPLOADS_DIR, doc.storagePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Document file is missing from storage.' });
    }

    await Promise.all([
      db
        .update(documents)
        .set({ downloadCount: sql`${documents.downloadCount} + 1` })
        .where(eq(documents.id, doc.id)),
      db.insert(documentDownloads).values({
        documentId: doc.id,
        userId: req.student?.id ?? null,
        ipHash: hashIp(req.ip || 'unknown'),
      }),
    ]);

    const safeName = sanitizeDownloadFilename(doc.originalFileName);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Download failed:', err);
    res.status(500).json({ error: 'Failed to download document.' });
  }
});

publicRouter.post('/contact', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();

    if (name.length < 2 || !email.includes('@') || subject.length < 3 || message.length < 10) {
      return res.status(400).json({
        error: 'Please provide your name, a valid email, a subject, and a message of at least 10 characters.',
      });
    }

    await db.insert(contactMessages).values({
      name: name.slice(0, 120),
      email: email.slice(0, 180),
      subject: subject.slice(0, 160),
      message: message.slice(0, 2000),
    });

    res.status(201).json({ ok: true, message: 'Your inquiry has been received by the Darbar academic desk.' });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ error: 'Could not submit your message. Please try again.' });
  }
});
