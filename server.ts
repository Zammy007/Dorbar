import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { publicRouter } from './server/routes/publicRoutes.ts';
import { quizRouter } from './server/routes/quizRoutes.ts';
import { studentRouter } from './server/routes/studentRoutes.ts';
import { adminRouter } from './server/routes/adminRoutes.ts';
import { subjectUploadRouter } from './server/routes/subjectUploadRoutes.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'darbar-platform' });
  });

  app.use('/api', publicRouter);
  app.use('/api/quizzes', quizRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/subject-upload', subjectUploadRouter);

  // Express error handler (including Multer file size limits)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Uploaded file exceeds the 15 MB maximum limit.' });
    }
    console.error('Unhandled API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Darbar server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Darbar server:', err);
  process.exit(1);
});
