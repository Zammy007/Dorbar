import { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  adminActivityLogs,
  adminProfiles,
  documents,
  platformSettings,
  subjects,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../seed.ts';
import {
  createRateLimiter,
  issueSubjectUploadToken,
  timingSafeStringCompare,
  verifySecret,
  verifySubjectUploadToken,
} from '../crypto.ts';
import { saveBufferToStorage, THUMBNAILS_DIR, UPLOADS_DIR } from '../storage.ts';
import {
  ALLOWED_THUMBNAIL_EXTENSIONS,
  extractExtension,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_THUMBNAIL_SIZE_BYTES,
  validateDocumentFile,
} from '../../src/lib/documentLogic.ts';

export const subjectUploadRouter = Router();

const uploadPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 15,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_SIZE_BYTES,
    files: 10,
  },
});

subjectUploadRouter.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('DB seed failed on subject-upload route:', err);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});

/**
 * POST /api/subject-upload/verify
 * Validates the subject upload password strictly on the backend and issues a scoped upload token.
 */
subjectUploadRouter.post('/verify', async (req, res) => {
  try {
    const ipKey = req.ip || 'unknown';
    const limit = uploadPasswordLimiter(`subject-upload:${ipKey}`);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many password attempts. Please try again in ${limit.retryAfterSec} seconds.`,
      });
    }

    const password = String(req.body?.password || '').trim();
    if (!password) {
      return res.status(400).json({ error: 'Please enter the upload password.' });
    }

    const envPassword = (process.env.SUBJECT_UPLOAD_PASSWORD || '').trim();
    let valid = false;

    if (envPassword.length > 0) {
      valid = timingSafeStringCompare(password, envPassword);
    } else {
      const rows = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'subject_upload_password_hash'))
        .limit(1);
      const storedHash =
        typeof rows[0]?.value?.hash === 'string' ? rows[0].value.hash : null;
      valid = verifySecret(password, storedHash);
    }

    if (!valid) {
      return res.status(401).json({ error: 'Incorrect upload password.' });
    }

    const uploadToken = issueSubjectUploadToken(30 * 60 * 1000);
    return res.json({ ok: true, uploadToken });
  } catch (err) {
    console.error('Subject upload password verification failed:', err);
    return res.status(500).json({ error: 'Could not verify upload password.' });
  }
});

/**
 * POST /api/subject-upload/documents
 * Requires a verified subject-upload Bearer token and saves uploaded study materials for the target subject.
 */
subjectUploadRouter.post(
  '/documents',
  upload.fields([
    { name: 'files', maxCount: 8 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!verifySubjectUploadToken(token)) {
        return res.status(401).json({
          error: 'Upload session expired or unauthorized. Please re-enter the upload password.',
        });
      }

      const filesObj = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const uploadedFiles = filesObj.files || [];
      const thumbnailFile = filesObj.thumbnail?.[0] || null;

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Please attach at least one study document file.' });
      }

      const subjectId = Number(req.body?.subjectId);
      const baseTitle = String(req.body?.title || '').trim();
      const chapterName = String(req.body?.chapterName || 'General').trim() || 'General';
      const description = String(req.body?.description || '').trim();
      const category = String(req.body?.category || 'Notes').trim() || 'Notes';

      if (!Number.isInteger(subjectId) || subjectId <= 0) {
        return res.status(400).json({ error: 'Please select a valid subject.' });
      }

      const subjectRows = await db
        .select()
        .from(subjects)
        .where(eq(subjects.id, subjectId))
        .limit(1);
      if (subjectRows.length === 0) {
        return res.status(404).json({ error: 'Selected subject was not found.' });
      }

      // Optional thumbnail validation & storage
      let savedThumbnailName: string | null = null;
      if (thumbnailFile) {
        const thumbExt = extractExtension(thumbnailFile.originalname);
        if (!(ALLOWED_THUMBNAIL_EXTENSIONS as readonly string[]).includes(thumbExt)) {
          return res.status(400).json({
            error: 'Thumbnail must be a JPG, JPEG, PNG, or WEBP image.',
          });
        }
        if (thumbnailFile.size > MAX_THUMBNAIL_SIZE_BYTES) {
          return res.status(400).json({
            error: 'Thumbnail image must be 4 MB or smaller.',
          });
        }
        const savedThumb = saveBufferToStorage(
          THUMBNAILS_DIR,
          thumbnailFile.buffer,
          thumbExt
        );
        savedThumbnailName = savedThumb.storedName;
      }

      // Validate all study files before writing
      for (const file of uploadedFiles) {
        const check = validateDocumentFile({
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
        if (!check.ok) {
          return res.status(400).json({ error: `${file.originalname}: ${check.error}` });
        }
      }

      const superAdmins = await db
        .select()
        .from(adminProfiles)
        .where(eq(adminProfiles.role, 'SUPER_ADMIN'))
        .limit(1);
      const uploaderAdminId = superAdmins[0]?.id ?? null;

      const createdDocs = [];
      for (const file of uploadedFiles) {
        const check = validateDocumentFile({
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
        if (!check.ok) continue;

        const saved = saveBufferToStorage(UPLOADS_DIR, file.buffer, check.extension);
        const fallbackTitle = file.originalname
          .replace(/\.[^.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim();
        const docTitle =
          uploadedFiles.length === 1 && baseTitle
            ? baseTitle
            : baseTitle
              ? `${baseTitle} — ${fallbackTitle}`
              : fallbackTitle || 'Untitled Study Material';

        const [inserted] = await db
          .insert(documents)
          .values({
            subjectId,
            title: docTitle,
            chapterName,
            description:
              description ||
              `${subjectRows[0].name} ${category.toLowerCase()} uploaded to Darbar.`,
            category,
            fileFormat: check.extension.toUpperCase(),
            mimeType: file.mimetype || 'application/octet-stream',
            fileSizeBytes: saved.sizeBytes,
            storagePath: saved.storedName,
            originalFileName: file.originalname,
            thumbnailPath: savedThumbnailName,
            status: 'published',
            downloadCount: 0,
            viewCount: 0,
            uploadedByAdminId: uploaderAdminId,
          })
          .returning();

        createdDocs.push(inserted);
      }

      if (uploaderAdminId && createdDocs.length > 0) {
        await db.insert(adminActivityLogs).values({
          adminId: uploaderAdminId,
          adminRole: 'SUPER_ADMIN',
          adminName: 'Subject Quick Upload',
          action: 'SUBJECT_UPLOAD_DOCUMENT',
          entityType: 'document',
          entityId: String(createdDocs[0].id),
          details: `Uploaded ${createdDocs.length} study file(s) to ${subjectRows[0].name} via password-protected subject upload.`,
        });
      }

      return res.status(201).json({
        documents: createdDocs,
        message:
          createdDocs.length === 1
            ? `Uploaded "${createdDocs[0].title}" to ${subjectRows[0].name}.`
            : `Uploaded ${createdDocs.length} files to ${subjectRows[0].name}.`,
      });
    } catch (err) {
      console.error('Subject upload failed:', err);
      return res.status(500).json({ error: 'Could not upload study material.' });
    }
  }
);
