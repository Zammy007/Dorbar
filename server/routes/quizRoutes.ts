import { Router } from 'express';
import { and, avg, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../seed.ts';
import { type DarbarRequest, optionalStudentAuth } from '../authMiddleware.ts';
import { createRateLimiter } from '../crypto.ts';
import { generateAiQuizQuestions, isAiQuizConfigured } from '../quizAi.ts';
import {
  gradeQuizSubmission,
  normalizeQuestionHash,
  QUIZ_CATEGORIES,
} from '../../src/lib/quizLogic.ts';

export const quizRouter = Router();
const aiQuizLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, maxAttempts: 8 });

quizRouter.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('DB seed failed on quiz route:', err);
    res.status(503).json({ error: 'Database unavailable.' });
  }
});

async function loadQuizForStudent(quizId: number) {
  const found = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.status, 'published')))
    .limit(1);
  if (found.length === 0) return null;

  const quiz = found[0];
  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.orderIndex, quizQuestions.id);

  const qIds = questions.map((q) => q.id);
  const options =
    qIds.length > 0
      ? await db
          .select({
            id: quizOptions.id,
            questionId: quizOptions.questionId,
            optionLabel: quizOptions.optionLabel,
            optionText: quizOptions.optionText,
          })
          .from(quizOptions)
          .where(inArray(quizOptions.questionId, qIds))
      : [];

  const optionsByQ = new Map<number, typeof options>();
  for (const opt of options) {
    const arr = optionsByQ.get(opt.questionId) ?? [];
    arr.push(opt);
    optionsByQ.set(opt.questionId, arr);
  }

  return {
    id: quiz.id,
    title: quiz.title,
    category: quiz.category,
    quizDate: quiz.quizDate,
    isDaily: quiz.isDaily,
    isAiGenerated: quiz.isAiGenerated,
    timeLimitSeconds: quiz.timeLimitSeconds,
    createdAt: quiz.createdAt,
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      orderIndex: q.orderIndex,
      options: (optionsByQ.get(q.id) ?? []).sort((a, b) =>
        a.optionLabel.localeCompare(b.optionLabel)
      ),
    })),
  };
}

export async function createPersistedAiQuiz(params: {
  category: string;
  count: number;
  isDaily: boolean;
  quizDate: string;
  status: 'published' | 'draft' | 'suggested';
  adminId?: number | null;
}) {
  const recentQs = await db
    .select({
      questionText: quizQuestions.questionText,
      questionHash: quizQuestions.questionHash,
    })
    .from(quizQuestions)
    .orderBy(desc(quizQuestions.id))
    .limit(60);

  const existingHashes = new Set(recentQs.map((q) => q.questionHash));
  const generated = await generateAiQuizQuestions({
    category: params.category,
    count: params.count,
    recentQuestionPrompts: recentQs.map((q) => q.questionText),
    existingHashes,
  });

  const [createdQuiz] = await db
    .insert(quizzes)
    .values({
      title: generated.title,
      category: params.category,
      quizDate: params.quizDate,
      isDaily: params.isDaily,
      isAiGenerated: true,
      status: params.status,
      timeLimitSeconds: generated.questions.length * 45,
      createdByAdminId: params.adminId ?? null,
    })
    .returning();

  for (let i = 0; i < generated.questions.length; i++) {
    const q = generated.questions[i];
    const [insertedQ] = await db
      .insert(quizQuestions)
      .values({
        quizId: createdQuiz.id,
        questionText: q.questionText,
        explanation: q.explanation,
        questionHash: normalizeQuestionHash(q.questionText),
        orderIndex: i,
      })
      .returning();

    await db.insert(quizOptions).values(
      q.options.map((opt) => ({
        questionId: insertedQ.id,
        optionLabel: opt.label,
        optionText: opt.text,
        isCorrect: opt.isCorrect,
      }))
    );
  }

  return { quiz: createdQuiz, rejectedCount: generated.rejectedCount };
}

quizRouter.get('/daily', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const category = String(req.query.category || 'General Knowledge').trim();

    let existingDaily = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.isDaily, true),
          eq(quizzes.quizDate, today),
          eq(quizzes.status, 'published')
        )
      )
      .orderBy(desc(quizzes.createdAt))
      .limit(1);

    let fallbackArchive = false;

    if (existingDaily.length === 0) {
      if (isAiQuizConfigured()) {
        try {
          const created = await createPersistedAiQuiz({
            category: QUIZ_CATEGORIES.includes(category as (typeof QUIZ_CATEGORIES)[number])
              ? category
              : 'General Knowledge',
            count: 5,
            isDaily: true,
            quizDate: today,
            status: 'published',
          });
          existingDaily = [created.quiz];
        } catch (aiErr) {
          console.error('Daily AI quiz generation failed, falling back to archive:', aiErr);
          fallbackArchive = true;
        }
      } else {
        fallbackArchive = true;
      }
    }

    if (existingDaily.length === 0) {
      existingDaily = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.status, 'published'))
        .orderBy(desc(quizzes.isDaily), desc(quizzes.createdAt))
        .limit(1);
    }

    if (existingDaily.length === 0) {
      return res.status(404).json({ error: 'No published quizzes available yet.' });
    }

    const fullQuiz = await loadQuizForStudent(existingDaily[0].id);
    res.json({
      quiz: fullQuiz,
      fallbackArchive,
      aiConfigured: isAiQuizConfigured(),
      categories: QUIZ_CATEGORIES,
    });
  } catch (err) {
    console.error('Failed to load daily quiz:', err);
    res.status(500).json({ error: 'Could not load the daily quiz.' });
  }
});

quizRouter.get('/', async (req, res) => {
  try {
    const category = String(req.query.category || 'all').trim();
    const conditions = [eq(quizzes.status, 'published')];
    if (category && category !== 'all') {
      conditions.push(eq(quizzes.category, category));
    }

    const list = await db
      .select()
      .from(quizzes)
      .where(and(...conditions))
      .orderBy(desc(quizzes.quizDate), desc(quizzes.createdAt))
      .limit(30);

    const quizIds = list.map((q) => q.id);
    const [qCounts, attemptCounts] =
      quizIds.length > 0
        ? await Promise.all([
            db
              .select({ quizId: quizQuestions.quizId, count: count() })
              .from(quizQuestions)
              .where(inArray(quizQuestions.quizId, quizIds))
              .groupBy(quizQuestions.quizId),
            db
              .select({ quizId: quizAttempts.quizId, count: count() })
              .from(quizAttempts)
              .where(inArray(quizAttempts.quizId, quizIds))
              .groupBy(quizAttempts.quizId),
          ])
        : [[], []];

    const qCountMap = new Map(qCounts.map((r) => [r.quizId, Number(r.count)]));
    const aCountMap = new Map(attemptCounts.map((r) => [r.quizId, Number(r.count)]));

    res.json({
      quizzes: list.map((q) => ({
        ...q,
        questionCount: qCountMap.get(q.id) ?? 0,
        attemptCount: aCountMap.get(q.id) ?? 0,
      })),
      categories: QUIZ_CATEGORIES,
      aiConfigured: isAiQuizConfigured(),
    });
  } catch (err) {
    console.error('Failed to list quizzes:', err);
    res.status(500).json({ error: 'Failed to load quiz archive.' });
  }
});

quizRouter.get('/stats/summary', optionalStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const [[totals], [avgRow], recentAttempts] = await Promise.all([
      db.select({ totalAttempts: count() }).from(quizAttempts),
      db
        .select({
          avgScore: avg(quizAttempts.score),
          avgTotal: avg(quizAttempts.totalQuestions),
        })
        .from(quizAttempts),
      req.student
        ? db
            .select({
              id: quizAttempts.id,
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
            .where(eq(quizAttempts.userId, req.student.id))
            .orderBy(desc(quizAttempts.completedAt))
            .limit(10)
        : db
            .select({
              id: quizAttempts.id,
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
            .orderBy(desc(quizAttempts.completedAt))
            .limit(8),
    ]);

    const avgScoreNum = Number(avgRow?.avgScore ?? 0);
    const avgTotalNum = Number(avgRow?.avgTotal ?? 0);
    const averageAccuracy =
      avgTotalNum > 0 ? Math.round((avgScoreNum / avgTotalNum) * 100) : 0;

    res.json({
      totalAttempts: Number(totals?.totalAttempts ?? 0),
      averageAccuracy,
      recentAttempts,
    });
  } catch (err) {
    console.error('Failed to load quiz stats:', err);
    res.status(500).json({ error: 'Failed to load quiz statistics.' });
  }
});

quizRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }
    const quiz = await loadQuizForStudent(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }
    res.json({ quiz });
  } catch (err) {
    console.error('Failed to fetch quiz:', err);
    res.status(500).json({ error: 'Could not load quiz.' });
  }
});

quizRouter.post('/generate', async (req, res) => {
  const limit = aiQuizLimiter(`quiz-gen:${req.ip || 'unknown'}`);
  if (!limit.allowed) {
    return res
      .status(429)
      .json({ error: `Too many AI quiz requests. Try again in ${limit.retryAfterSec}s.` });
  }

  const category = String(req.body?.category || 'General Knowledge').trim();
  const countNum = Math.min(8, Math.max(4, Number(req.body?.count) || 5));

  try {
    const today = new Date().toISOString().slice(0, 10);
    const created = await createPersistedAiQuiz({
      category: QUIZ_CATEGORIES.includes(category as (typeof QUIZ_CATEGORIES)[number])
        ? category
        : 'General Knowledge',
      count: countNum,
      isDaily: false,
      quizDate: today,
      status: 'published',
    });

    const fullQuiz = await loadQuizForStudent(created.quiz.id);
    res.status(201).json({
      quiz: fullQuiz,
      fallbackArchive: false,
      message: `Generated a fresh ${category} quiz using AI.`,
    });
  } catch (err: any) {
    console.error('AI quiz generation failed:', err);
    // Graceful fallback: return an existing published quiz from the requested category or any category
    const fallbackRows = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.status, 'published'), eq(quizzes.category, category)))
      .orderBy(desc(quizzes.createdAt))
      .limit(1);

    const backup =
      fallbackRows.length > 0
        ? fallbackRows[0]
        : (
            await db
              .select()
              .from(quizzes)
              .where(eq(quizzes.status, 'published'))
              .orderBy(desc(quizzes.createdAt))
              .limit(1)
          )[0];

    if (backup) {
      const fullBackup = await loadQuizForStudent(backup.id);
      return res.status(200).json({
        quiz: fullBackup,
        fallbackArchive: true,
        notice:
          err?.message ||
          'Live AI quiz generation is temporarily unavailable. Loaded a verified quiz from the archive.',
      });
    }

    res.status(503).json({
      error: err?.message || 'AI quiz generation is currently unavailable.',
    });
  }
});

quizRouter.post('/:id/submit', optionalStudentAuth, async (req: DarbarRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }

    const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const timeTakenSeconds = Math.max(0, Math.min(3600, Math.floor(Number(req.body?.timeTakenSeconds) || 0)));
    const guestName = req.student ? null : String(req.body?.guestName || 'Guest Student').trim().slice(0, 80);

    const quizRows = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.status, 'published')))
      .limit(1);
    if (quizRows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex, quizQuestions.id);

    const qIds = questions.map((q) => q.id);
    const allOptions =
      qIds.length > 0
        ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, qIds))
        : [];

    const correctOptionByQ = new Map<number, number>();
    const optionsByQ = new Map<number, typeof allOptions>();
    for (const opt of allOptions) {
      if (opt.isCorrect) correctOptionByQ.set(opt.questionId, opt.id);
      const arr = optionsByQ.get(opt.questionId) ?? [];
      arr.push(opt);
      optionsByQ.set(opt.questionId, arr);
    }

    const gradeInput = questions.map((q) => ({
      id: q.id,
      correctOptionId: correctOptionByQ.get(q.id) ?? -1,
    }));

    const parsedAnswers = rawAnswers.map((a: any) => ({
      questionId: Number(a?.questionId),
      selectedOptionId: a?.selectedOptionId ? Number(a.selectedOptionId) : null,
    }));

    const result = gradeQuizSubmission(gradeInput, parsedAnswers);

    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        quizId,
        userId: req.student?.id ?? null,
        guestName,
        score: result.score,
        totalQuestions: result.totalQuestions,
        timeTakenSeconds,
      })
      .returning();

    if (result.graded.length > 0) {
      await db.insert(quizAnswers).values(
        result.graded.map((g) => ({
          attemptId: attempt.id,
          questionId: g.questionId,
          selectedOptionId: g.selectedOptionId,
          isCorrect: g.isCorrect,
        }))
      );
    }

    const review = questions.map((q) => {
      const gradedItem = result.graded.find((g) => g.questionId === q.id);
      const opts = (optionsByQ.get(q.id) ?? []).sort((a, b) =>
        a.optionLabel.localeCompare(b.optionLabel)
      );
      return {
        questionId: q.id,
        questionText: q.questionText,
        explanation: q.explanation,
        selectedOptionId: gradedItem?.selectedOptionId ?? null,
        correctOptionId: gradedItem?.correctOptionId ?? -1,
        isCorrect: gradedItem?.isCorrect ?? false,
        options: opts.map((o) => ({
          id: o.id,
          optionLabel: o.optionLabel,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        })),
      };
    });

    res.status(201).json({
      attemptId: attempt.id,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage,
      timeTakenSeconds,
      review,
    });
  } catch (err) {
    console.error('Quiz submission failed:', err);
    res.status(500).json({ error: 'Could not submit quiz answers.' });
  }
});
