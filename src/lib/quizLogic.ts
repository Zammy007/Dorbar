export interface QuizOptionInput {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  questionText: string;
  explanation: string;
  options: QuizOptionInput[];
}

export const QUIZ_CATEGORIES = [
  'General Knowledge',
  'Science',
  'History',
  'Geography',
  'Technology',
  'Current Affairs',
  'Sports',
  'Indian GK',
  'World GK',
] as const;

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

export function normalizeQuestionHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function validateQuizQuestions(
  rawQuestions: QuizQuestionInput[],
  existingHashes: Set<string> = new Set()
): { valid: QuizQuestionInput[]; rejectedCount: number } {
  const seen = new Set<string>(existingHashes);
  const valid: QuizQuestionInput[] = [];
  let rejectedCount = 0;

  for (const q of rawQuestions) {
    const prompt = (q.questionText ?? '').trim();
    const explanation = (q.explanation ?? '').trim();
    if (prompt.length < 10 || explanation.length < 5) {
      rejectedCount++;
      continue;
    }

    const hash = normalizeQuestionHash(prompt);
    if (!hash || seen.has(hash)) {
      rejectedCount++;
      continue;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      rejectedCount++;
      continue;
    }

    const cleanOptions = q.options.map((opt, idx) => ({
      label: (['A', 'B', 'C', 'D'][idx] as 'A' | 'B' | 'C' | 'D'),
      text: (opt.text ?? '').trim(),
      isCorrect: Boolean(opt.isCorrect),
    }));

    const optionTexts = new Set(cleanOptions.map((o) => o.text.toLowerCase()));
    const correctCount = cleanOptions.filter((o) => o.isCorrect).length;

    if (cleanOptions.some((o) => !o.text) || optionTexts.size !== 4 || correctCount !== 1) {
      rejectedCount++;
      continue;
    }

    seen.add(hash);
    valid.push({
      questionText: prompt,
      explanation,
      options: cleanOptions,
    });
  }

  return { valid, rejectedCount };
}

export interface SubmissionAnswer {
  questionId: number;
  selectedOptionId: number | null;
}

export interface GradedAnswer {
  questionId: number;
  selectedOptionId: number | null;
  correctOptionId: number;
  isCorrect: boolean;
}

export function gradeQuizSubmission(
  questions: Array<{ id: number; correctOptionId: number }>,
  answers: SubmissionAnswer[]
): {
  score: number;
  totalQuestions: number;
  percentage: number;
  graded: GradedAnswer[];
} {
  const answerMap = new Map<number, number | null>();
  for (const ans of answers) {
    answerMap.set(ans.questionId, ans.selectedOptionId);
  }

  let score = 0;
  const graded: GradedAnswer[] = questions.map((q) => {
    const selectedOptionId = answerMap.has(q.id) ? (answerMap.get(q.id) ?? null) : null;
    const isCorrect = selectedOptionId !== null && selectedOptionId === q.correctOptionId;
    if (isCorrect) score++;
    return {
      questionId: q.id,
      selectedOptionId,
      correctOptionId: q.correctOptionId,
      isCorrect,
    };
  });

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  return { score, totalQuestions, percentage, graded };
}

export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
