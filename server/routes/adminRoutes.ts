import { Router } from 'express';
import multer from 'multer';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  adminActivityLogs,
  adminProfiles,
  announcements,
  authSessions,
  contactMessages,
  documentDownloads,
  documents,
  platformSettings,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
  subjects,
  users,
} from '../../src/db/schema.ts';
import { DEFAULT_HOMEPAGE_SETTINGS, ensureSeeded } from '../seed.ts';
import {
  createRateLimiter,
  generateSessionToken,
  hashSecret,
  hashToken,
  issueGateToken,
  timingSafeStringCompare,
  verifyGateToken,
  verifySecret,
} from '../crypto.ts';
import {
  type AuthenticatedAdmin,
  type DarbarRequest,
  requireAdminAuth,
  requireAdminPermission,
} from '../authMiddleware.ts';
import {
  deleteFromStorage,
  saveBufferToStorage,
  THUMBNAILS_DIR,
  UPLOADS_DIR,
} from '../storage.ts';
import {
  ALLOWED_THUMBNAIL_EXTENSIONS,
  extractExtension,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_THUMBNAIL_SIZE_BYTES,
  validateDocumentFile,
} from '../../src/lib/documentLogic.ts';
import { sanitizeViceAdminPermissions } from '../../src/lib/permissions.ts';
import { createPersistedAiQuiz } from './quizRoutes.ts';
import {
  normalizeQuestionHash,
  QUIZ_CATEGORIES,
  validateQuizQuestions,
} from '../../src/lib/quizLogic.ts';
import { isAiQuizConfigured } from '../quizAi.ts';

export const adminRouter = Router();

const gateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 10 });
const adminLoginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 12 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_SIZE_BYTES,
    files: 10,
  },
});

adminRouter.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('DB seed failed on admin route:', err);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});

async function logAdminActivity(
  admin: AuthenticatedAdmin,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details: string
) {
  await db.insert(adminActivityLogs).values({
    adminId: admin.id,
    adminRole: admin.role,
    adminName: admin.displayName,
    action,
    entityType,
    entityId: entityId !== null ? String(entityId) : null,
    details,
  });
}

async function getAdminAuthSetupState() {
  const [profiles, gateRows] = await Promise.all([
    db.select().from(adminProfiles),
    db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'admin_access_code_hash'))
      .limit(1),
  ]);

  const superAdmin = profiles.find((p) => p.role === 'SUPER_ADMIN');
  const viceAdmin = profiles.find((p) => p.role === 'VICE_ADMIN');
  const envAccessCode = (process.env.ADMIN_ACCESS_CODE || '').trim();
  const dbAccessHash =
    typeof gateRows[0]?.value?.hash === 'string' ? gateRows[0].value.hash : null;

  const hasGateConfigured = envAccessCode.length > 0 || Boolean(dbAccessHash);
  const hasPasswordsConfigured = Boolean(superAdmin?.passwordHash && viceAdmin?.passwordHash);

  return {
    needsSetup: !hasGateConfigured || !hasPasswordsConfigured,
    envGateActive: envAccessCode.length > 0,
    envAccessCode,
    dbAccessHash,
    profiles,
  };
}

adminRouter.get('/auth/status', async (_req, res) => {
  try {
    const state = await getAdminAuthSetupState();
    res.json({
      needsSetup: state.needsSetup,
      envGateActive: state.envGateActive,
    });
  } catch (err) {
    console.error('Admin auth status failed:', err);
    res.status(500).json({ error: 'Could not determine admin setup status.' });
  }
});

/**
 * First-run atomic administrator setup / claim route.
 * Permanently locks itself once credentials have been claimed in PostgreSQL.
 */
adminRouter.post('/auth/setup', async (req, res) => {
  try {
    const state = await getAdminAuthSetupState();
    if (!state.needsSetup) {
      return res.status(409).json({
        error: 'Administrator credentials are already configured. Please sign in normally.',
      });
    }

    const accessCode = String(req.body?.accessCode || '').trim();
    const superPassword = String(req.body?.superAdminPassword || '');
    const vicePassword = String(req.body?.viceAdminPassword || '');

    if (!state.envGateActive && accessCode.length < 4) {
      return res.status(400).json({ error: 'Access code must be at least 4 characters.' });
    }
    if (superPassword.length < 6 || vicePassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'Both Super Admin and Vice Admin passwords must be at least 6 characters.' });
    }
    if (superPassword === vicePassword) {
      return res.status(400).json({
        error: 'Super Admin and Vice Admin must have distinct personal passwords for reliable audit attribution.',
      });
    }

    const superProfile = state.profiles.find((p) => p.role === 'SUPER_ADMIN');
    const viceProfile = state.profiles.find((p) => p.role === 'VICE_ADMIN');
    if (!superProfile || !viceProfile) {
      return res.status(500).json({ error: 'Administrator profiles are not initialized.' });
    }

    if (!state.envGateActive) {
      await db
        .insert(platformSettings)
        .values({
          key: 'admin_access_code_hash',
          value: { hash: hashSecret(accessCode) },
          updatedByAdminId: superProfile.id,
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: { hash: hashSecret(accessCode) }, updatedAt: new Date() },
        });
    }

    await Promise.all([
      db
        .update(adminProfiles)
        .set({ passwordHash: hashSecret(superPassword) })
        .where(eq(adminProfiles.id, superProfile.id)),
      db
        .update(adminProfiles)
        .set({ passwordHash: hashSecret(vicePassword) })
        .where(eq(adminProfiles.id, viceProfile.id)),
    ]);

    await db.insert(adminActivityLogs).values({
      adminId: superProfile.id,
      adminRole: 'SUPER_ADMIN',
      adminName: superProfile.displayName,
      action: 'ADMIN_CREDENTIALS_CLAIMED',
      entityType: 'security',
      entityId: String(superProfile.id),
      details: 'Completed initial administrator security claim with hashed access gate and separate role passwords.',
    });

    res.status(201).json({
      ok: true,
      message: 'Administrator access credentials configured. You can now sign in with your access code and role password.',
    });
  } catch (err) {
    console.error('Admin first-run setup failed:', err);
    res.status(500).json({ error: 'Could not complete initial admin setup.' });
  }
});

adminRouter.post('/auth/verify-gate', async (req, res) => {
  const limit = gateLimiter(`gate:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Too many failed access code attempts. Try again in ${limit.retryAfterSec}s.`,
    });
  }

  try {
    const code = String(req.body?.accessCode || '').trim();
    if (!code) {
      return res.status(400).json({ error: 'Please enter the administrator access code.' });
    }

    const state = await getAdminAuthSetupState();
    if (state.needsSetup) {
      return res.status(409).json({
        error: 'Initial administrator security setup is required before signing in.',
        needsSetup: true,
      });
    }

    const valid = state.envGateActive
      ? timingSafeStringCompare(code, state.envAccessCode)
      : verifySecret(code, state.dbAccessHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid administrator access code.' });
    }

    const gateToken = issueGateToken();
    const roleOptions = state.profiles
      .sort((a, b) => (a.role === 'SUPER_ADMIN' ? -1 : b.role === 'SUPER_ADMIN' ? 1 : 0))
      .map((p) => ({
        role: p.role,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        isActive: p.isActive,
      }));

    res.json({ gateToken, profiles: roleOptions });
  } catch (err) {
    console.error('Admin gate verification error:', err);
    res.status(500).json({ error: 'Could not verify access code.' });
  }
});

adminRouter.post('/auth/login', async (req, res) => {
  const limit = adminLoginLimiter(`admin-login:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${limit.retryAfterSec}s.`,
    });
  }

  try {
    const gateToken = String(req.body?.gateToken || '');
    const role = String(req.body?.role || '').trim();
    const password = String(req.body?.password || '');

    if (!verifyGateToken(gateToken)) {
      return res.status(401).json({
        error: 'Access code verification expired. Please re-enter the admin access code.',
      });
    }
    if (role !== 'SUPER_ADMIN' && role !== 'VICE_ADMIN') {
      return res.status(400).json({ error: 'Please select a valid administrator profile.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Personal administrator password is required.' });
    }

    const found = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.role, role))
      .limit(1);

    if (found.length === 0) {
      return res.status(404).json({ error: 'Administrator profile not found.' });
    }

    const profile = found[0];
    if (!profile.isActive) {
      return res.status(403).json({
        error: 'This administrator account has been deactivated by the Super Admin.',
      });
    }

    if (!verifySecret(password, profile.passwordHash)) {
      return res.status(401).json({ error: 'Incorrect administrator password.' });
    }

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await Promise.all([
      db.insert(authSessions).values({
        tokenHash,
        actorType: 'admin',
        actorId: profile.id,
        role: profile.role,
        expiresAt,
      }),
      db
        .update(adminProfiles)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminProfiles.id, profile.id)),
      db.insert(adminActivityLogs).values({
        adminId: profile.id,
        adminRole: profile.role,
        adminName: profile.displayName,
        action: 'ADMIN_LOGIN',
        entityType: 'session',
        entityId: String(profile.id),
        details: `${profile.displayName} (${profile.role}) signed in.`,
      }),
    ]);

    res.json({
      token: rawToken,
      admin: {
        id: profile.id,
        role: profile.role,
        username: profile.username,
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        isActive: profile.isActive,
        permissions: profile.permissions,
        lastLoginAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Admin login failed:', err);
    res.status(500).json({ error: 'Administrator login failed.' });
  }
});

adminRouter.post('/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.slice(7).trim();
    try {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(raw)));
    } catch {
      // ignore
    }
  }
  res.json({ ok: true });
});

adminRouter.get('/me', requireAdminAuth, async (req: DarbarRequest, res) => {
  try {
    const recentActivities = await db
      .select()
      .from(adminActivityLogs)
      .where(eq(adminActivityLogs.adminId, req.admin!.id))
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(12);

    res.json({
      admin: req.admin,
      recentActivities,
    });
  } catch (err) {
    console.error('Admin /me error:', err);
    res.status(500).json({ error: 'Could not load administrator profile.' });
  }
});

adminRouter.get(
  '/overview',
  requireAdminAuth,
  requireAdminPermission('viewAnalytics'),
  async (req: DarbarRequest, res) => {
    try {
      const [
        [{ totalStudents }],
        [{ totalDocuments }],
        [{ totalDownloads }],
        [{ totalQuizzes }],
        [{ totalQuizAttempts }],
        [{ totalMessages }],
        recentLogs,
        recentDocs,
      ] = await Promise.all([
        db.select({ totalStudents: count() }).from(users),
        db.select({ totalDocuments: count() }).from(documents),
        db.select({ totalDownloads: count() }).from(documentDownloads),
        db.select({ totalQuizzes: count() }).from(quizzes),
        db.select({ totalQuizAttempts: count() }).from(quizAttempts),
        db.select({ totalMessages: count() }).from(contactMessages),
        req.admin!.role === 'SUPER_ADMIN'
          ? db.select().from(adminActivityLogs).orderBy(desc(adminActivityLogs.createdAt)).limit(15)
          : db
              .select()
              .from(adminActivityLogs)
              .where(eq(adminActivityLogs.adminId, req.admin!.id))
              .orderBy(desc(adminActivityLogs.createdAt))
              .limit(10),
        db
          .select({
            id: documents.id,
            title: documents.title,
            subjectName: subjects.name,
            fileFormat: documents.fileFormat,
            status: documents.status,
            downloadCount: documents.downloadCount,
            createdAt: documents.createdAt,
          })
          .from(documents)
          .innerJoin(subjects, eq(documents.subjectId, subjects.id))
          .orderBy(desc(documents.createdAt))
          .limit(6),
      ]);

      res.json({
        kpis: {
          totalStudents: Number(totalStudents),
          totalDocuments: Number(totalDocuments),
          totalDownloads: Number(totalDownloads),
          totalQuizzes: Number(totalQuizzes),
          totalQuizAttempts: Number(totalQuizAttempts),
          totalMessages: Number(totalMessages),
        },
        aiConfigured: isAiQuizConfigured(),
        recentLogs,
        recentDocuments: recentDocs,
      });
    } catch (err) {
      console.error('Admin overview failed:', err);
      res.status(500).json({ error: 'Failed to load dashboard overview.' });
    }
  }
);

// --- DOCUMENTS MANAGEMENT ---
adminRouter.get('/documents', requireAdminAuth, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: documents.id,
        subjectId: documents.subjectId,
        subjectName: subjects.name,
        subjectSlug: subjects.slug,
        title: documents.title,
        chapterName: documents.chapterName,
        description: documents.description,
        category: documents.category,
        fileFormat: documents.fileFormat,
        fileSizeBytes: documents.fileSizeBytes,
        originalFileName: documents.originalFileName,
        thumbnailPath: documents.thumbnailPath,
        status: documents.status,
        downloadCount: documents.downloadCount,
        viewCount: documents.viewCount,
        uploadedByAdminId: documents.uploadedByAdminId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .innerJoin(subjects, eq(documents.subjectId, subjects.id))
      .orderBy(desc(documents.createdAt));

    res.json({ documents: rows });
  } catch (err) {
    console.error('Admin fetch documents failed:', err);
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});

adminRouter.post(
  '/documents',
  requireAdminAuth,
  requireAdminPermission('uploadDocuments'),
  upload.fields([
    { name: 'files', maxCount: 8 },
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req: DarbarRequest, res) => {
    try {
      const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFiles = [
        ...(filesMap?.files ?? []),
        ...(filesMap?.file ?? []),
      ];
      const thumbnailFile = filesMap?.thumbnail?.[0];

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Please select at least one study file to upload.' });
      }

      const subjectId = Number(req.body?.subjectId);
      const baseTitle = String(req.body?.title || '').trim();
      const chapterName = String(req.body?.chapterName || 'General').trim();
      const description = String(req.body?.description || '').trim();
      const category = String(req.body?.category || 'Notes').trim();
      const status = req.body?.status === 'draft' ? 'draft' : 'published';

      if (!Number.isInteger(subjectId) || subjectId <= 0) {
        return res.status(400).json({ error: 'Please choose a valid subject.' });
      }
      if (baseTitle.length < 3 || description.length < 5) {
        return res.status(400).json({
          error: 'Document title (3+ chars) and short description (5+ chars) are required.',
        });
      }

      const subjectExists = await db
        .select()
        .from(subjects)
        .where(eq(subjects.id, subjectId))
        .limit(1);
      if (subjectExists.length === 0) {
        return res.status(404).json({ error: 'Selected subject does not exist.' });
      }

      let storedThumb: string | null = null;
      if (thumbnailFile) {
        const tExt = extractExtension(thumbnailFile.originalname);
        if (
          !ALLOWED_THUMBNAIL_EXTENSIONS.includes(
            tExt as (typeof ALLOWED_THUMBNAIL_EXTENSIONS)[number]
          ) ||
          thumbnailFile.size > MAX_THUMBNAIL_SIZE_BYTES
        ) {
          return res.status(400).json({
            error: 'Thumbnail must be JPG, PNG, or WEBP and under 3 MB.',
          });
        }
        storedThumb = saveBufferToStorage(THUMBNAILS_DIR, thumbnailFile.buffer, tExt).storedName;
      }

      const createdDocs = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const validation = validateDocumentFile({
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
        if (!validation.ok) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
        }

        const saved = saveBufferToStorage(UPLOADS_DIR, file.buffer, validation.extension);
        const docTitle =
          uploadedFiles.length > 1
            ? `${baseTitle} (${file.originalname.replace(/\.[^.]+$/, '')})`
            : baseTitle;

        const [doc] = await db
          .insert(documents)
          .values({
            subjectId,
            title: docTitle.slice(0, 180),
            chapterName: chapterName.slice(0, 120),
            description: description.slice(0, 1000),
            category: category.slice(0, 60),
            fileFormat: validation.extension,
            mimeType: file.mimetype || 'application/octet-stream',
            fileSizeBytes: saved.sizeBytes,
            storagePath: saved.storedName,
            originalFileName: file.originalname,
            thumbnailPath: storedThumb,
            status,
            uploadedByAdminId: req.admin!.id,
          })
          .returning();

        createdDocs.push(doc);

        await logAdminActivity(
          req.admin!,
          'DOCUMENT_UPLOADED',
          'document',
          doc.id,
          `Uploaded "${doc.title}" (${doc.fileFormat}, ${status}) to ${subjectExists[0].name}.`
        );
      }

      res.status(201).json({
        documents: createdDocs,
        message:
          createdDocs.length === 1
            ? `Uploaded "${createdDocs[0].title}" successfully.`
            : `Uploaded ${createdDocs.length} study documents successfully.`,
      });
    } catch (err) {
      console.error('Document upload failed:', err);
      res.status(500).json({ error: 'Failed to save uploaded document.' });
    }
  }
);

adminRouter.patch(
  '/documents/:id',
  requireAdminAuth,
  requireAdminPermission('editDocuments'),
  upload.single('file'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid document ID.' });
      }
      const existing = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const current = existing[0];
      const updates: Partial<typeof documents.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (typeof req.body?.title === 'string' && req.body.title.trim().length >= 3) {
        updates.title = req.body.title.trim().slice(0, 180);
      }
      if (typeof req.body?.chapterName === 'string' && req.body.chapterName.trim()) {
        updates.chapterName = req.body.chapterName.trim().slice(0, 120);
      }
      if (typeof req.body?.description === 'string' && req.body.description.trim()) {
        updates.description = req.body.description.trim().slice(0, 1000);
      }
      if (typeof req.body?.category === 'string' && req.body.category.trim()) {
        updates.category = req.body.category.trim().slice(0, 60);
      }
      if (req.body?.subjectId && Number.isInteger(Number(req.body.subjectId))) {
        updates.subjectId = Number(req.body.subjectId);
      }
      if (req.body?.status === 'published' || req.body?.status === 'draft') {
        updates.status = req.body.status;
      }

      if (req.file) {
        const validation = validateDocumentFile({
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        });
        if (!validation.ok) {
          return res.status(400).json({ error: validation.error });
        }
        const saved = saveBufferToStorage(UPLOADS_DIR, req.file.buffer, validation.extension);
        deleteFromStorage(UPLOADS_DIR, current.storagePath);
        updates.storagePath = saved.storedName;
        updates.originalFileName = req.file.originalname;
        updates.fileFormat = validation.extension;
        updates.mimeType = req.file.mimetype || 'application/octet-stream';
        updates.fileSizeBytes = saved.sizeBytes;
      }

      const [updated] = await db
        .update(documents)
        .set(updates)
        .where(eq(documents.id, id))
        .returning();

      await logAdminActivity(
        req.admin!,
        req.file ? 'DOCUMENT_REPLACED' : 'DOCUMENT_EDITED',
        'document',
        updated.id,
        `Updated "${updated.title}" (status: ${updated.status}).`
      );

      res.json({ document: updated });
    } catch (err) {
      console.error('Document edit failed:', err);
      res.status(500).json({ error: 'Failed to update document.' });
    }
  }
);

adminRouter.delete(
  '/documents/:id',
  requireAdminAuth,
  requireAdminPermission('deleteDocuments'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid document ID.' });
      }
      const existing = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      const doc = existing[0];
      await db.delete(documents).where(eq(documents.id, id));
      deleteFromStorage(UPLOADS_DIR, doc.storagePath);
      deleteFromStorage(THUMBNAILS_DIR, doc.thumbnailPath);

      await logAdminActivity(
        req.admin!,
        'DOCUMENT_DELETED',
        'document',
        id,
        `Deleted document "${doc.title}".`
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Document delete failed:', err);
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  }
);

// --- SUBJECTS ---
adminRouter.post(
  '/subjects',
  requireAdminAuth,
  requireAdminPermission('manageSubjects'),
  async (req: DarbarRequest, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const bengaliName = String(req.body?.bengaliName || name).trim();
      const description = String(req.body?.description || '').trim();
      const icon = String(req.body?.icon || 'BookOpen').trim();
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (!slug || name.length < 2 || description.length < 10) {
        return res
          .status(400)
          .json({ error: 'Subject name and a description (10+ characters) are required.' });
      }

      const [created] = await db
        .insert(subjects)
        .values({
          slug,
          name: name.slice(0, 80),
          bengaliName: bengaliName.slice(0, 80),
          icon: icon.slice(0, 40),
          description: description.slice(0, 500),
          accentColor: '#1D4ED8',
          displayOrder: 20,
        })
        .returning();

      await logAdminActivity(
        req.admin!,
        'SUBJECT_CREATED',
        'subject',
        created.id,
        `Created subject category "${created.name}".`
      );

      res.status(201).json({ subject: created });
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({ error: 'A subject with that name/slug already exists.' });
      }
      console.error('Create subject failed:', err);
      res.status(500).json({ error: 'Failed to create subject.' });
    }
  }
);

// --- QUIZZES MANAGEMENT ---
adminRouter.get(
  '/quizzes',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (_req, res) => {
    try {
      const allQuizzes = await db
        .select()
        .from(quizzes)
        .orderBy(desc(quizzes.createdAt))
        .limit(40);

      const qIds = allQuizzes.map((q) => q.id);
      const questions =
        qIds.length > 0
          ? await db
              .select()
              .from(quizQuestions)
              .where(inArray(quizQuestions.quizId, qIds))
              .orderBy(quizQuestions.orderIndex)
          : [];
      const attempts =
        qIds.length > 0
          ? await db
              .select({ quizId: quizAttempts.quizId, count: count() })
              .from(quizAttempts)
              .where(inArray(quizAttempts.quizId, qIds))
              .groupBy(quizAttempts.quizId)
          : [];

      const questionsByQuiz = new Map<number, typeof questions>();
      for (const q of questions) {
        const arr = questionsByQuiz.get(q.quizId) ?? [];
        arr.push(q);
        questionsByQuiz.set(q.quizId, arr);
      }
      const attemptMap = new Map(attempts.map((a) => [a.quizId, Number(a.count)]));

      res.json({
        quizzes: allQuizzes.map((q) => ({
          ...q,
          questions: questionsByQuiz.get(q.id) ?? [],
          attemptCount: attemptMap.get(q.id) ?? 0,
        })),
        categories: QUIZ_CATEGORIES,
        aiConfigured: isAiQuizConfigured(),
      });
    } catch (err) {
      console.error('Admin fetch quizzes failed:', err);
      res.status(500).json({ error: 'Failed to load quizzes.' });
    }
  }
);

adminRouter.post(
  '/quizzes/generate-ai',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (req: DarbarRequest, res) => {
    try {
      const category = String(req.body?.category || 'General Knowledge').trim();
      const countNum = Math.min(10, Math.max(4, Number(req.body?.count) || 5));
      const wantDaily = Boolean(req.body?.isDaily);
      const canPublishDaily =
        req.admin!.role === 'SUPER_ADMIN' || req.admin!.permissions.publishDailyQuiz;

      const status: 'published' | 'suggested' =
        wantDaily && !canPublishDaily ? 'suggested' : 'published';

      const today = new Date().toISOString().slice(0, 10);
      const created = await createPersistedAiQuiz({
        category,
        count: countNum,
        isDaily: wantDaily && canPublishDaily,
        quizDate: today,
        status,
        adminId: req.admin!.id,
      });

      await logAdminActivity(
        req.admin!,
        'QUIZ_AI_GENERATED',
        'quiz',
        created.quiz.id,
        `Generated AI quiz "${created.quiz.title}" (${category}, status: ${status}).`
      );

      res.status(201).json({
        quiz: created.quiz,
        rejectedCount: created.rejectedCount,
        message:
          status === 'suggested'
            ? 'AI quiz generated and submitted for Super Admin daily publication approval.'
            : `AI quiz "${created.quiz.title}" published successfully.`,
      });
    } catch (err: any) {
      console.error('Admin AI quiz generation failed:', err);
      res.status(503).json({
        error: err?.message || 'AI quiz generation failed. Ensure GEMINI_API_KEY is configured.',
      });
    }
  }
);

adminRouter.post(
  '/quizzes/manual',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (req: DarbarRequest, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const category = String(req.body?.category || 'General Knowledge').trim();
      const isDaily = Boolean(req.body?.isDaily);
      const rawQuestions = Array.isArray(req.body?.questions) ? req.body.questions : [];

      if (title.length < 4) {
        return res.status(400).json({ error: 'Quiz title must be at least 4 characters.' });
      }

      const { valid } = validateQuizQuestions(rawQuestions);
      if (valid.length === 0) {
        return res.status(400).json({
          error:
            'Add at least one valid question with 4 distinct options, exactly 1 correct answer, and an explanation.',
        });
      }

      const canPublishDaily =
        req.admin!.role === 'SUPER_ADMIN' || req.admin!.permissions.publishDailyQuiz;
      const status = isDaily && !canPublishDaily ? 'suggested' : 'published';
      const today = new Date().toISOString().slice(0, 10);

      const [quiz] = await db
        .insert(quizzes)
        .values({
          title: title.slice(0, 160),
          category: QUIZ_CATEGORIES.includes(category as (typeof QUIZ_CATEGORIES)[number])
            ? category
            : 'General Knowledge',
          quizDate: today,
          isDaily: isDaily && canPublishDaily,
          isAiGenerated: false,
          status,
          timeLimitSeconds: valid.length * 60,
          createdByAdminId: req.admin!.id,
        })
        .returning();

      for (let i = 0; i < valid.length; i++) {
        const q = valid[i];
        const [insertedQ] = await db
          .insert(quizQuestions)
          .values({
            quizId: quiz.id,
            questionText: q.questionText,
            explanation: q.explanation,
            questionHash: normalizeQuestionHash(q.questionText),
            orderIndex: i,
          })
          .returning();

        await db.insert(quizOptions).values(
          q.options.map((o) => ({
            questionId: insertedQ.id,
            optionLabel: o.label,
            optionText: o.text,
            isCorrect: o.isCorrect,
          }))
        );
      }

      await logAdminActivity(
        req.admin!,
        'QUIZ_CREATED',
        'quiz',
        quiz.id,
        `Created manual quiz "${quiz.title}" with ${valid.length} question(s) (${status}).`
      );

      res.status(201).json({ quiz });
    } catch (err) {
      console.error('Manual quiz create failed:', err);
      res.status(500).json({ error: 'Failed to create quiz.' });
    }
  }
);

adminRouter.patch(
  '/quizzes/:id',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }
      const updates: Partial<typeof quizzes.$inferInsert> = {};
      if (req.body?.status === 'published' || req.body?.status === 'draft') {
        if (
          req.body.status === 'published' &&
          req.body.isDaily &&
          req.admin!.role !== 'SUPER_ADMIN' &&
          !req.admin!.permissions.publishDailyQuiz
        ) {
          return res.status(403).json({ error: 'You do not have permission to publish daily quizzes.' });
        }
        updates.status = req.body.status;
      }
      if (typeof req.body?.isDaily === 'boolean') {
        if (
          req.body.isDaily &&
          req.admin!.role !== 'SUPER_ADMIN' &&
          !req.admin!.permissions.publishDailyQuiz
        ) {
          return res.status(403).json({ error: 'Only authorized admins can promote a daily quiz.' });
        }
        updates.isDaily = req.body.isDaily;
      }

      const [updated] = await db
        .update(quizzes)
        .set(updates)
        .where(eq(quizzes.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: 'Quiz not found.' });
      }

      await logAdminActivity(
        req.admin!,
        'QUIZ_UPDATED',
        'quiz',
        updated.id,
        `Updated quiz "${updated.title}" (status: ${updated.status}, daily: ${updated.isDaily}).`
      );

      res.json({ quiz: updated });
    } catch (err) {
      console.error('Quiz update failed:', err);
      res.status(500).json({ error: 'Failed to update quiz.' });
    }
  }
);

adminRouter.delete(
  '/quizzes/:id',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Quiz not found.' });
      }
      await db.delete(quizzes).where(eq(quizzes.id, id));
      await logAdminActivity(
        req.admin!,
        'QUIZ_DELETED',
        'quiz',
        id,
        `Deleted quiz "${existing[0].title}".`
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Quiz delete failed:', err);
      res.status(500).json({ error: 'Failed to delete quiz.' });
    }
  }
);

adminRouter.delete(
  '/quizzes/questions/:questionId',
  requireAdminAuth,
  requireAdminPermission('manageQuizzes'),
  async (req: DarbarRequest, res) => {
    try {
      const questionId = Number(req.params.questionId);
      const existing = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.id, questionId))
        .limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Question not found.' });
      }
      await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
      await logAdminActivity(
        req.admin!,
        'QUIZ_QUESTION_DELETED',
        'quiz_question',
        questionId,
        `Removed question "${existing[0].questionText.slice(0, 70)}..."`
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete question failed:', err);
      res.status(500).json({ error: 'Failed to delete question.' });
    }
  }
);

// --- ANNOUNCEMENTS ---
adminRouter.get(
  '/announcements',
  requireAdminAuth,
  requireAdminPermission('manageAnnouncements'),
  async (_req, res) => {
    try {
      const list = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
      res.json({ announcements: list });
    } catch (err) {
      console.error('Fetch announcements failed:', err);
      res.status(500).json({ error: 'Failed to load announcements.' });
    }
  }
);

adminRouter.post(
  '/announcements',
  requireAdminAuth,
  requireAdminPermission('manageAnnouncements'),
  async (req: DarbarRequest, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      const type = ['info', 'exam', 'update'].includes(req.body?.type) ? req.body.type : 'info';
      if (title.length < 3 || content.length < 8) {
        return res.status(400).json({ error: 'Announcement title and content are required.' });
      }

      const [created] = await db
        .insert(announcements)
        .values({
          title: title.slice(0, 140),
          content: content.slice(0, 800),
          type,
          isActive: true,
          createdByAdminId: req.admin!.id,
        })
        .returning();

      await logAdminActivity(
        req.admin!,
        'ANNOUNCEMENT_CREATED',
        'announcement',
        created.id,
        `Published announcement "${created.title}".`
      );

      res.status(201).json({ announcement: created });
    } catch (err) {
      console.error('Create announcement failed:', err);
      res.status(500).json({ error: 'Failed to publish announcement.' });
    }
  }
);

adminRouter.patch(
  '/announcements/:id',
  requireAdminAuth,
  requireAdminPermission('manageAnnouncements'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      const isActive = Boolean(req.body?.isActive);
      const [updated] = await db
        .update(announcements)
        .set({ isActive })
        .where(eq(announcements.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Announcement not found.' });
      await logAdminActivity(
        req.admin!,
        'ANNOUNCEMENT_UPDATED',
        'announcement',
        id,
        `Set announcement "${updated.title}" active=${isActive}.`
      );
      res.json({ announcement: updated });
    } catch (err) {
      console.error('Toggle announcement failed:', err);
      res.status(500).json({ error: 'Failed to update announcement.' });
    }
  }
);

adminRouter.delete(
  '/announcements/:id',
  requireAdminAuth,
  requireAdminPermission('manageAnnouncements'),
  async (req: DarbarRequest, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(announcements).where(eq(announcements.id, id));
      await logAdminActivity(
        req.admin!,
        'ANNOUNCEMENT_DELETED',
        'announcement',
        id,
        `Deleted announcement #${id}.`
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete announcement failed:', err);
      res.status(500).json({ error: 'Failed to delete announcement.' });
    }
  }
);

// --- SUPER ADMIN EXCLUSIVE ROUTES ---
adminRouter.get(
  '/vice-admin',
  requireAdminAuth,
  requireAdminPermission('manageViceAdmin'),
  async (_req, res) => {
    try {
      const found = await db
        .select()
        .from(adminProfiles)
        .where(eq(adminProfiles.role, 'VICE_ADMIN'))
        .limit(1);
      if (found.length === 0) {
        return res.status(404).json({ error: 'Vice Admin profile not found.' });
      }
      const vice = found[0];
      const activities = await db
        .select()
        .from(adminActivityLogs)
        .where(eq(adminActivityLogs.adminId, vice.id))
        .orderBy(desc(adminActivityLogs.createdAt))
        .limit(20);

      res.json({
        viceAdmin: {
          id: vice.id,
          role: vice.role,
          username: vice.username,
          displayName: vice.displayName,
          email: vice.email,
          avatarUrl: vice.avatarUrl,
          isActive: vice.isActive,
          permissions: vice.permissions,
          lastLoginAt: vice.lastLoginAt,
        },
        activities,
      });
    } catch (err) {
      console.error('Fetch vice admin failed:', err);
      res.status(500).json({ error: 'Failed to load Vice Admin profile.' });
    }
  }
);

adminRouter.patch(
  '/vice-admin',
  requireAdminAuth,
  requireAdminPermission('manageViceAdmin'),
  async (req: DarbarRequest, res) => {
    try {
      const found = await db
        .select()
        .from(adminProfiles)
        .where(eq(adminProfiles.role, 'VICE_ADMIN'))
        .limit(1);
      if (found.length === 0) {
        return res.status(404).json({ error: 'Vice Admin not found.' });
      }
      const vice = found[0];
      const updates: Partial<typeof adminProfiles.$inferInsert> = {};

      if (typeof req.body?.isActive === 'boolean') {
        updates.isActive = req.body.isActive;
      }
      if (req.body?.permissions && typeof req.body.permissions === 'object') {
        updates.permissions = sanitizeViceAdminPermissions(req.body.permissions);
      }
      if (typeof req.body?.displayName === 'string' && req.body.displayName.trim().length >= 2) {
        updates.displayName = req.body.displayName.trim().slice(0, 80);
      }
      if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
        updates.passwordHash = hashSecret(req.body.newPassword);
      }

      const [updated] = await db
        .update(adminProfiles)
        .set(updates)
        .where(eq(adminProfiles.id, vice.id))
        .returning();

      if (updates.isActive === false) {
        await db.delete(authSessions).where(eq(authSessions.actorId, vice.id));
      }

      await logAdminActivity(
        req.admin!,
        'VICE_ADMIN_UPDATED',
        'admin_profile',
        vice.id,
        `Updated Vice Admin status (active=${updated.isActive}) and permissions.`
      );

      res.json({
        viceAdmin: {
          id: updated.id,
          role: updated.role,
          username: updated.username,
          displayName: updated.displayName,
          email: updated.email,
          avatarUrl: updated.avatarUrl,
          isActive: updated.isActive,
          permissions: updated.permissions,
          lastLoginAt: updated.lastLoginAt,
        },
      });
    } catch (err) {
      console.error('Update vice admin failed:', err);
      res.status(500).json({ error: 'Failed to update Vice Admin settings.' });
    }
  }
);

adminRouter.get(
  '/audit-logs',
  requireAdminAuth,
  requireAdminPermission('viewAuditLogs'),
  async (_req, res) => {
    try {
      const [logs, messages] = await Promise.all([
        db.select().from(adminActivityLogs).orderBy(desc(adminActivityLogs.createdAt)).limit(60),
        db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(25),
      ]);
      res.json({ logs, contactMessages: messages });
    } catch (err) {
      console.error('Audit logs failed:', err);
      res.status(500).json({ error: 'Failed to load audit logs.' });
    }
  }
);

adminRouter.patch(
  '/website-settings',
  requireAdminAuth,
  requireAdminPermission('manageWebsiteSettings'),
  async (req: DarbarRequest, res) => {
    try {
      const currentRows = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'homepage_content'))
        .limit(1);

      const merged = {
        ...DEFAULT_HOMEPAGE_SETTINGS,
        ...(currentRows[0]?.value ?? {}),
        ...(typeof req.body?.heroTitle === 'string' && req.body.heroTitle.trim()
          ? { heroTitle: req.body.heroTitle.trim().slice(0, 140) }
          : {}),
        ...(typeof req.body?.heroSubtitle === 'string' && req.body.heroSubtitle.trim()
          ? { heroSubtitle: req.body.heroSubtitle.trim().slice(0, 240) }
          : {}),
        ...(typeof req.body?.welcomeHeading === 'string' && req.body.welcomeHeading.trim()
          ? { welcomeHeading: req.body.welcomeHeading.trim().slice(0, 120) }
          : {}),
        ...(typeof req.body?.welcomeBody === 'string' && req.body.welcomeBody.trim()
          ? { welcomeBody: req.body.welcomeBody.trim().slice(0, 1000) }
          : {}),
        ...(typeof req.body?.contactEmail === 'string' && req.body.contactEmail.trim()
          ? { contactEmail: req.body.contactEmail.trim().slice(0, 120) }
          : {}),
        ...(typeof req.body?.contactPhone === 'string' && req.body.contactPhone.trim()
          ? { contactPhone: req.body.contactPhone.trim().slice(0, 40) }
          : {}),
        ...(typeof req.body?.contactAddress === 'string' && req.body.contactAddress.trim()
          ? { contactAddress: req.body.contactAddress.trim().slice(0, 200) }
          : {}),
      };

      await db
        .insert(platformSettings)
        .values({
          key: 'homepage_content',
          value: merged,
          updatedByAdminId: req.admin!.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: merged, updatedByAdminId: req.admin!.id, updatedAt: new Date() },
        });

      await logAdminActivity(
        req.admin!,
        'WEBSITE_SETTINGS_UPDATED',
        'settings',
        'homepage_content',
        'Updated Darbar homepage copy and contact settings.'
      );

      res.json({ homepage: merged });
    } catch (err) {
      console.error('Website settings update failed:', err);
      res.status(500).json({ error: 'Failed to update website settings.' });
    }
  }
);

adminRouter.patch(
  '/security/credentials',
  requireAdminAuth,
  requireAdminPermission('manageSecuritySettings'),
  async (req: DarbarRequest, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword || '');
      const newAccessCode = String(req.body?.newAccessCode || '').trim();
      const newSuperPassword = String(req.body?.newSuperPassword || '');

      const found = await db
        .select()
        .from(adminProfiles)
        .where(eq(adminProfiles.id, req.admin!.id))
        .limit(1);

      if (found.length === 0 || !verifySecret(currentPassword, found[0].passwordHash)) {
        return res
          .status(401)
          .json({ error: 'Current Super Admin password verification failed.' });
      }

      const actions: string[] = [];

      if (newAccessCode) {
        if (newAccessCode.length < 4) {
          return res.status(400).json({ error: 'New access code must be at least 4 characters.' });
        }
        await db
          .insert(platformSettings)
          .values({
            key: 'admin_access_code_hash',
            value: { hash: hashSecret(newAccessCode) },
            updatedByAdminId: req.admin!.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: {
              value: { hash: hashSecret(newAccessCode) },
              updatedByAdminId: req.admin!.id,
              updatedAt: new Date(),
            },
          });
        actions.push('rotated shared access code');
      }

      if (newSuperPassword) {
        if (newSuperPassword.length < 6) {
          return res
            .status(400)
            .json({ error: 'New Super Admin password must be at least 6 characters.' });
        }
        await db
          .update(adminProfiles)
          .set({ passwordHash: hashSecret(newSuperPassword) })
          .where(eq(adminProfiles.id, req.admin!.id));
        actions.push('updated Super Admin password');
      }

      if (actions.length === 0) {
        return res.status(400).json({ error: 'Provide a new access code or a new password to update.' });
      }

      await logAdminActivity(
        req.admin!,
        'SECURITY_CREDENTIALS_ROTATED',
        'security',
        req.admin!.id,
        `Super Admin ${actions.join(' and ')}.`
      );

      const envOverrideNote = process.env.ADMIN_ACCESS_CODE
        ? ' Note: ADMIN_ACCESS_CODE environment variable overrides the database access code until updated in Settings > Secrets.'
        : '';

      res.json({
        ok: true,
        message: `Security credentials updated (${actions.join(', ')}).${envOverrideNote}`,
      });
    } catch (err) {
      console.error('Security credential update failed:', err);
      res.status(500).json({ error: 'Failed to update security credentials.' });
    }
  }
);
