import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatCountdown, QUIZ_CATEGORIES } from '../lib/quizLogic';
import { useAuth } from '../context/AuthContext';
import type { QuizDetail, QuizSubmitResult, QuizSummaryItem } from '../types/darbar';

interface QuizStatsSummary {
  totalAttempts: number;
  averageAccuracy: number;
  recentAttempts: Array<{
    id: number;
    quizId: number;
    quizTitle: string;
    category: string;
    score: number;
    totalQuestions: number;
    timeTakenSeconds: number;
    completedAt: string;
  }>;
}

export function DailyQuizPage() {
  const { student, studentToken } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('General Knowledge');
  const [dailyQuiz, setDailyQuiz] = useState<QuizDetail | null>(null);
  const [archive, setArchive] = useState<QuizSummaryItem[]>([]);
  const [stats, setStats] = useState<QuizStatsSummary | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Quiz Runner State
  const [activeQuiz, setActiveQuiz] = useState<QuizDetail | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [guestName, setGuestName] = useState('');

  const submittedRef = useRef(false);

  const loadQuizHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyRes, listRes, statsRes] = await Promise.all([
        apiRequest<{
          quiz: QuizDetail;
          fallbackArchive: boolean;
          aiConfigured: boolean;
        }>('/api/quizzes/daily'),
        apiRequest<{ quizzes: QuizSummaryItem[]; aiConfigured: boolean }>('/api/quizzes'),
        apiRequest<QuizStatsSummary>('/api/quizzes/stats/summary', {
          token: studentToken,
        }),
      ]);
      setDailyQuiz(dailyRes.quiz);
      setArchive(listRes.quizzes);
      setStats(statsRes);
      setAiConfigured(dailyRes.aiConfigured);
      if (dailyRes.fallbackArchive) {
        setNotice(
          'Showing the latest curated daily quiz from the Darbar archive while live AI generation is offline or unconfigured.'
        );
      } else {
        setNotice(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load Darbar Daily Quiz.');
    } finally {
      setLoading(false);
    }
  }, [studentToken]);

  useEffect(() => {
    void loadQuizHub();
  }, [loadQuizHub]);

  const startQuiz = (quiz: QuizDetail) => {
    submittedRef.current = false;
    setActiveQuiz(quiz);
    setCurrentIdx(0);
    setAnswers({});
    setSecondsLeft(quiz.timeLimitSeconds || quiz.questions.length * 45);
    setResult(null);
    setError(null);
  };

  const handleOpenArchivedQuiz = async (quizId: number) => {
    setError(null);
    try {
      const res = await apiRequest<{ quiz: QuizDetail }>(`/api/quizzes/${quizId}`);
      startQuiz(res.quiz);
    } catch (err: any) {
      setError(err?.message || 'Could not load selected quiz.');
    }
  };

  const handleGenerateAiQuiz = async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{
        quiz: QuizDetail;
        fallbackArchive?: boolean;
        notice?: string;
        message?: string;
      }>('/api/quizzes/generate', {
        method: 'POST',
        body: { category: selectedCategory, count: 5 },
      });
      if (res.notice) {
        setNotice(res.notice);
      }
      startQuiz(res.quiz);
      void loadQuizHub();
    } catch (err: any) {
      setError(err?.message || 'Could not generate quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitQuiz = useCallback(async () => {
    if (!activeQuiz || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);

    const totalLimit = activeQuiz.timeLimitSeconds || activeQuiz.questions.length * 45;
    const timeTakenSeconds = Math.max(1, totalLimit - secondsLeft);

    try {
      const payload = {
        timeTakenSeconds,
        guestName: student ? undefined : guestName.trim() || 'Student Learner',
        answers: activeQuiz.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id] ?? null,
        })),
      };
      const res = await apiRequest<QuizSubmitResult>(
        `/api/quizzes/${activeQuiz.id}/submit`,
        {
          method: 'POST',
          body: payload,
          token: studentToken,
        }
      );
      setResult(res);
      const updatedStats = await apiRequest<QuizStatsSummary>('/api/quizzes/stats/summary', {
        token: studentToken,
      });
      setStats(updatedStats);
    } catch (err: any) {
      submittedRef.current = false;
      setError(err?.message || 'Failed to submit quiz answers.');
    } finally {
      setSubmitting(false);
    }
  }, [activeQuiz, answers, secondsLeft, student, guestName, studentToken]);

  // Countdown timer tick
  useEffect(() => {
    if (!activeQuiz || result) return;
    if (secondsLeft <= 0) {
      void handleSubmitQuiz();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeQuiz, result, secondsLeft, handleSubmitQuiz]);

  // --- ACTIVE QUIZ VIEW ---
  if (activeQuiz && !result) {
    const q = activeQuiz.questions[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const progressPct = Math.round(((currentIdx + 1) / activeQuiz.questions.length) * 100);
    const lowTime = secondsLeft <= 30;

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeQuiz.category} · {activeQuiz.quizDate}
            </p>
            <h1 className="font-display text-lg sm:text-xl font-bold text-[#0F2447] dark:text-white mt-0.5">
              {activeQuiz.title}
            </h1>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-semibold tabular-nums border ${
              lowTime
                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-[#0F2447] dark:text-white'
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span aria-live="polite">{formatCountdown(secondsLeft)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              Question <strong>{currentIdx + 1}</strong> of {activeQuiz.questions.length}
            </span>
            <span>
              {answeredCount} of {activeQuiz.questions.length} answered
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-[#0D9488] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white leading-snug">
            {currentIdx + 1}. {q.questionText}
          </h2>

          <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
            {q.options.map((opt) => {
              const selected = answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: opt.id,
                    }))
                  }
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 ${
                    selected
                      ? 'border-[#1D4ED8] dark:border-teal-400 bg-blue-50/70 dark:bg-teal-950/30 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-[#1D4ED8] dark:bg-teal-500 text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.optionLabel}
                  </span>
                  <span className="text-sm sm:text-base leading-relaxed pt-0.5">
                    {opt.optionText}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Question Stepper Controls */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="px-3 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Exit Quiz
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {currentIdx < activeQuiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIdx((i) => Math.min(activeQuiz.questions.length - 1, i + 1))
                  }
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 transition-colors"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmitQuiz()}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white disabled:opacity-60 transition-colors"
                >
                  <span>{submitting ? 'Calculating Score...' : 'Submit Quiz'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RESULTS & EXPLANATIONS VIEW ---
  if (activeQuiz && result) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="bg-[#0F2447] text-white rounded-2xl p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-300">
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>Quiz Complete · {activeQuiz.category}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              {activeQuiz.title}
            </h1>
            <p className="text-sm text-slate-300">
              Completed in{' '}
              <span className="font-mono tabular-nums">
                {formatCountdown(result.timeTakenSeconds)}
              </span>{' '}
              · Score saved to quiz history
            </p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl px-6 py-4 text-center shrink-0">
            <p className="text-xs text-slate-300">Final Score</p>
            <p className="font-display text-4xl font-bold tabular-nums mt-1">
              {result.score}/{result.totalQuestions}
            </p>
            <p className="font-mono text-xs text-teal-300 tabular-nums mt-1">
              {result.percentage}% accuracy
            </p>
          </div>
        </section>

        {/* Detailed Answer Review with Explanations */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#0F2447] dark:text-white">
              Answer Key &amp; Explanations
            </h2>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => startQuiz(activeQuiz)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveQuiz(null);
                  setResult(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
              >
                Back to Daily Quiz Hub
              </button>
            </div>
          </div>

          {result.review.map((item, idx) => (
            <div
              key={item.questionId}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  {idx + 1}. {item.questionText}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                    item.isCorrect
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {item.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Correct</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>{item.selectedOptionId ? 'Incorrect' : 'Unanswered'}</span>
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {item.options.map((opt) => {
                  const isSelected = opt.id === item.selectedOptionId;
                  const isRight = opt.isCorrect;
                  let style =
                    'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300';
                  if (isRight) {
                    style =
                      'border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium';
                  } else if (isSelected && !isRight) {
                    style =
                      'border-red-400/60 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200';
                  }
                  return (
                    <div
                      key={opt.id}
                      className={`px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm flex items-center gap-2.5 ${style}`}
                    >
                      <span className="font-mono font-semibold">{opt.optionLabel}.</span>
                      <span>{opt.optionText}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0B1120] border border-slate-200/70 dark:border-slate-800 rounded-lg p-3.5 leading-relaxed">
                <strong className="text-slate-900 dark:text-white">Explanation:</strong>{' '}
                {item.explanation}
              </p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  // --- MAIN DAILY QUIZ HUB ---
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0D9488] dark:text-teal-400">
            AI-Powered Daily General Knowledge Practice
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2447] dark:text-white">
            দরবার Daily Quiz
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
            Take today’s featured GK challenge or generate a fresh AI quiz across 9 curated
            categories with verified answers, countdown timers, and explanations.
          </p>
        </div>

        {!student && (
          <div className="w-full sm:w-64">
            <label
              htmlFor="guest-quiz-name"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Your Name (optional for scoreboard)
            </label>
            <input
              id="guest-quiz-name"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Riya Sen (Class 12)"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Featured Daily Quiz + AI Category Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Today's Featured Quiz */}
        <div className="lg:col-span-7 bg-[#0F2447] text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-x-2 text-xs text-teal-300">
              <span>Today’s Featured Challenge</span>
              {dailyQuiz && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{dailyQuiz.quizDate}</span>
                  <span aria-hidden="true">·</span>
                  <span>{dailyQuiz.category}</span>
                </>
              )}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug">
              {loading ? 'Loading today’s quiz...' : dailyQuiz?.title || 'Daily GK Challenge'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every daily quiz checks for duplicate questions against recent challenges and stores
              your score automatically for longitudinal progress tracking.
            </p>
          </div>

          {dailyQuiz && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/15">
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300">
                <span>{dailyQuiz.questions.length} Questions</span>
                <span aria-hidden="true">·</span>
                <span>{formatCountdown(dailyQuiz.timeLimitSeconds)} Time Limit</span>
              </div>
              <button
                type="button"
                onClick={() => startQuiz(dailyQuiz)}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Start Daily Quiz</span>
              </button>
            </div>
          )}
        </div>

        {/* AI Fresh Quiz Generator Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
                Generate Fresh AI Quiz
              </h2>
              <Sparkles className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Pick any of the 9 General Knowledge categories to generate a unique 5-question quiz
              with verified answers and explanations.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUIZ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#0F2447] dark:bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateAiQuiz()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white disabled:opacity-60 transition-colors"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>
                {generating
                  ? `Generating ${selectedCategory} Quiz...`
                  : `Generate ${selectedCategory} Quiz`}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              {aiConfigured
                ? 'Server-side AI quiz engine active · deduplicates recent questions'
                : 'Falls back to verified archive quizzes if AI API key is not configured'}
            </p>
          </div>
        </div>
      </div>

      {/* Quiz Archive & Recent Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Daily Quiz Archive */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#0F2447] dark:text-white">
              Daily &amp; Category Quiz Archive
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {archive.length} published quizzes
            </span>
          </div>

          <div className="space-y-3">
            {archive.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-[#1D4ED8] dark:text-teal-400">
                      {item.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.quizDate}</span>
                    {item.isAiGenerated && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>AI Generated</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {item.questionCount} questions · {item.attemptCount} attempts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleOpenArchivedQuiz(item.id)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-[#0F2447] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  Take Quiz
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Daily Quiz Statistics & Score History */}
        <section className="lg:col-span-5 space-y-4">
          <h2 className="font-display text-xl font-bold text-[#0F2447] dark:text-white">
            {student ? 'Your Quiz History & Stats' : 'Quiz Performance & Recent Scores'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Attempts</p>
              <p className="font-display text-2xl font-bold text-[#0F2447] dark:text-white tabular-nums mt-1">
                {stats?.totalAttempts ?? 0}
              </p>
            </div>
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Average Accuracy</p>
              <p className="font-display text-2xl font-bold text-[#0D9488] dark:text-teal-400 tabular-nums mt-1">
                {stats?.averageAccuracy ?? 0}%
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <History className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
              <span>Recent Quiz Attempts</span>
            </div>

            {!stats || stats.recentAttempts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                No completed quiz attempts yet. Start today’s challenge to record your first score!
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.recentAttempts.map((att) => (
                  <div key={att.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {att.quizTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {att.category} · {formatCountdown(att.timeTakenSeconds)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#0F2447] dark:text-teal-300 shrink-0">
                      {att.score}/{att.totalQuestions}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
