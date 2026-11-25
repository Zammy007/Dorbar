import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  authSessions,
  documentDownloads,
  documents,
  quizAttempts,
  quizzes,
  studentBookmarks,
  studentDocumentViews,
  subjects,
  users,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../seed.ts';
import {
  createRateLimiter,
  generateSessionToken,
  hashSecret,
  hashToken,
  verifySecret,
} from '../crypto.ts';
import { type DarbarRequest, requireStudentAuth } from '../authMiddleware.ts';

export const studentRouter = Router();
const studentAuthLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 20 });

studentRouter.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('DB seed failed on student route:', err);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});

async function createStudentSession(userId: number): Promise<string> {
  const { rawToken, tokenHash } = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({
    tokenHash,
    actorType: 'student',
    actorId: userId,
    role: 'STUDENT',
    expiresAt,
  });
  return rawToken;
}

studentRouter.post('/register', async (req, res) => {
  const limit = studentAuthLimiter(`register:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: `Too many requests. Please wait ${limit.retryAfterSec}s.` });
  }

  try {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const studentClass = String(req.body?.studentClass || 'Class 12').trim();

    if (fullName.length < 2) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!email.includes('@') || email.length < 5) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const uid = `local_${crypto.randomBytes(12).toString('hex')}`;
    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName.slice(0, 120),
        studentClass: ['Class 11', 'Class 12', 'Competitive Prep'].includes(studentClass)
          ? studentClass
          : 'Class 12',
        passwordHash: hashSecret(password),
        authProvider: 'password',
        lastLoginAt: new Date(),
      })
      .returning();

    const token = await createStudentSession(created.id);
    res.status(201).json({
      token,
      student: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        fullName: created.fullName,
        studentClass: created.studentClass,
        authProvider: created.authProvider,
        avatarUrl: created.avatarUrl,
      },
    });
  } catch (err) {
    console.error('Student registration failed:', err);
    res.status(500).json({ error: 'Could not register student account.' });
  }
});

studentRouter.post('/login', async (req, res) => {
  const limit = studentAuthLimiter(`login:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: `Too many login attempts. Try again in ${limit.retryAfterSec}s.` });
  }

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found.length === 0 || !verifySecret(password, found[0].passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const u = found[0];
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    const token = await createStudentSession(u.id);

    res.json({
      token,
      student: {
        id: u.id,
        uid: u.uid,
        email: u.email,
        fullName: u.fullName,
        studentClass: u.studentClass,
        authProvider: u.authProvider,
        avatarUrl: u.avatarUrl,
      },
    });
  } catch (err) {
    console.error('Student login failed:', err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

studentRouter.post('/firebase-sync', requireStudentAuth, async (req: DarbarRequest, res) => {
  res.json({ student: req.student });
});

studentRouter.post('/forgot-password', async (req, res) => {
  const limit = studentAuthLimiter(`forgot:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res.status(429).json({ error: `Too many requests. Wait ${limit.retryAfterSec}s.` });
  }

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid account email.' });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found.length === 0 || found[0].authProvider !== 'password') {
      return res.json({
        ok: true,
        message: 'If an email/password account exists for that address, a reset code has been prepared.',
      });
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db
      .update(users)
      .set({
        resetTokenHash: hashSecret(resetCode),
        resetTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, found[0].id));

    // Note: without an external SMTP server configured, confirm request cleanly and note SMTP configuration
    res.json({
      ok: true,
      message:
        'Password reset initiated. When SMTP email delivery is configured, a 6-digit recovery code is sent to your inbox (valid for 15 minutes).',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Could not process password reset request.' });
  }
});

studentRouter.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const resetCode = String(req.body?.resetCode || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !resetCode || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'Valid email, 6-digit reset code, and a 6+ character password are required.' });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (
      found.length === 0 ||
      !found[0].resetTokenExpiresAt ||
      found[0].resetTokenExpiresAt.getTime() < Date.now() ||
      !verifySecret(resetCode, found[0].resetTokenHash)
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashSecret(newPassword),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(users.id, found[0].id));

    res.json({ ok: true, message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

studentRouter.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.slice(7).trim();
    try {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(raw)));
    } catch {
      // ignore cleanup error
    }
  }
  res.json({ ok: true });
});

studentRouter.get('/me', requireStudentAuth, (req: DarbarRequest, res) => {
  res.json({ student: req.student });
});

studentRouter.patch('/me', requireStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const studentClass = String(req.body?.studentClass || '').trim();
    if (fullName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }

    const [updated] = await db
      .update(users)
      .set({
        fullName: fullName.slice(0, 120),
        studentClass: ['Class 11', 'Class 12', 'Competitive Prep'].includes(studentClass)
          ? studentClass
          : req.student!.studentClass,
      })
      .where(eq(users.id, req.student!.id))
      .returning();

    res.json({
      student: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        fullName: updated.fullName,
        studentClass: updated.studentClass,
        authProvider: updated.authProvider,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (err) {
    console.error('Profile update failed:', err);
    res.status(500).json({ error: 'Failed to update student profile.' });
  }
});

studentRouter.get('/dashboard', requireStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const userId = req.student!.id;

    const [bookmarks, recentViews, downloadHistory, quizHistory] = await Promise.all([
      db
        .select({
          bookmarkId: studentBookmarks.id,
          savedAt: studentBookmarks.createdAt,
          id: documents.id,
          title: documents.title,
          chapterName: documents.chapterName,
          category: documents.category,
          fileFormat: documents.fileFormat,
          fileSizeBytes: documents.fileSizeBytes,
          subjectSlug: subjects.slug,
          subjectName: subjects.name,
        })
        .from(studentBookmarks)
        .innerJoin(documents, eq(studentBookmarks.documentId, documents.id))
        .innerJoin(subjects, eq(documents.subjectId, subjects.id))
        .where(eq(studentBookmarks.userId, userId))
        .orderBy(desc(studentBookmarks.createdAt))
        .limit(20),
      db
        .select({
          viewId: studentDocumentViews.id,
          viewedAt: studentDocumentViews.viewedAt,
          id: documents.id,
          title: documents.title,
          chapterName: documents.chapterName,
          fileFormat: documents.fileFormat,
          subjectSlug: subjects.slug,
          subjectName: subjects.name,
        })
        .from(studentDocumentViews)
        .innerJoin(documents, eq(studentDocumentViews.documentId, documents.id))
        .innerJoin(subjects, eq(documents.subjectId, subjects.id))
        .where(eq(studentDocumentViews.userId, userId))
        .orderBy(desc(studentDocumentViews.viewedAt))
        .limit(12),
      db
        .select({
          downloadId: documentDownloads.id,
          downloadedAt: documentDownloads.downloadedAt,
          id: documents.id,
          title: documents.title,
          fileFormat: documents.fileFormat,
          fileSizeBytes: documents.fileSizeBytes,
          subjectSlug: subjects.slug,
          subjectName: subjects.name,
        })
        .from(documentDownloads)
        .innerJoin(documents, eq(documentDownloads.documentId, documents.id))
        .innerJoin(subjects, eq(documents.subjectId, subjects.id))
        .where(eq(documentDownloads.userId, userId))
        .orderBy(desc(documentDownloads.downloadedAt))
        .limit(20),
      db
        .select({
          attemptId: quizAttempts.id,
          quizId: quizAttempts.quizId,
          quizTitle: quizzes.title,
          category: quizzes.category,
          score: quizAttempts.score,
          totalQuestions: quizAttempts.totalQuestions,
          timeTakenSeconds: quizAttempts.timeTakenSeconds,
          completedAt: quizAttempts.completedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(eq(quizAttempts.userId, userId))
        .orderBy(desc(quizAttempts.completedAt))
        .limit(20),
    ]);

    res.json({
      student: req.student,
      savedDocuments: bookmarks,
      recentlyViewed: recentViews,
      downloadHistory,
      quizHistory,
    });
  } catch (err) {
    console.error('Student dashboard fetch failed:', err);
    res.status(500).json({ error: 'Could not load student dashboard.' });
  }
});

studentRouter.post('/bookmarks/:docId', requireStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const docId = Number(req.params.docId);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    await db
      .insert(studentBookmarks)
      .values({ userId: req.student!.id, documentId: docId })
      .onConflictDoNothing();
    res.json({ ok: true, saved: true });
  } catch (err) {
    console.error('Bookmark error:', err);
    res.status(500).json({ error: 'Could not save document.' });
  }
});

studentRouter.delete('/bookmarks/:docId', requireStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const docId = Number(req.params.docId);
    await db
      .delete(studentBookmarks)
      .where(
        and(
          eq(studentBookmarks.userId, req.student!.id),
          eq(studentBookmarks.documentId, docId)
        )
      );
    res.json({ ok: true, saved: false });
  } catch (err) {
    console.error('Remove bookmark error:', err);
    res.status(500).json({ error: 'Could not remove saved document.' });
  }
});

studentRouter.post('/views/:docId', requireStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const docId = Number(req.params.docId);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    await db.insert(studentDocumentViews).values({
      userId: req.student!.id,
      documentId: docId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Record view error:', err);
    res.status(500).json({ error: 'Could not record document view.' });
  }
});
