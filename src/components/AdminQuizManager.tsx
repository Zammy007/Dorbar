import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { QUIZ_CATEGORIES } from '../lib/quizLogic';
import type { AdminProfileData } from '../types/darbar';

interface AdminQuizRecord {
  id: number;
  title: string;
  category: string;
  quizDate: string;
  isDaily: boolean;
  isAiGenerated: boolean;
  status: string;
  attemptCount: number;
  questions: Array<{
    id: number;
    questionText: string;
    explanation: string;
  }>;
}

export function AdminQuizManager({
  token,
  admin,
  onChanged,
}: {
  token: string;
  admin: AdminProfileData;
  onChanged: () => void;
}) {
  const [quizzes, setQuizzes] = useState<AdminQuizRecord[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // AI Generator state
  const [aiCategory, setAiCategory] = useState<string>('General Knowledge');
  const [aiCount, setAiCount] = useState(5);
  const [aiDaily, setAiDaily] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Manual Quiz Builder state
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<string>('Science');
  const [manualDaily, setManualDaily] = useState(false);
  const [qText, setQText] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctLabel, setCorrectLabel] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [savingManual, setSavingManual] = useState(false);

  const canPublishDaily =
    admin.role === 'SUPER_ADMIN' || admin.permissions.publishDailyQuiz;

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        quizzes: AdminQuizRecord[];
        aiConfigured: boolean;
      }>('/api/admin/quizzes', { token });
      setQuizzes(res.quizzes);
      setAiConfigured(res.aiConfigured);
    } catch (err: any) {
      setError(err?.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  const handleAiGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/quizzes/generate-ai', {
        method: 'POST',
        token,
        body: { category: aiCategory, count: aiCount, isDaily: aiDaily },
      });
      setFeedback(res.message);
      await loadQuizzes();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'AI quiz generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSavingManual(true);
    setError(null);
    setFeedback(null);
    try {
      await apiRequest('/api/admin/quizzes/manual', {
        method: 'POST',
        token,
        body: {
          title: manualTitle,
          category: manualCategory,
          isDaily: manualDaily,
          questions: [
            {
              questionText: qText,
              explanation: qExplanation,
              options: [
                { label: 'A', text: optA, isCorrect: correctLabel === 'A' },
                { label: 'B', text: optB, isCorrect: correctLabel === 'B' },
                { label: 'C', text: optC, isCorrect: correctLabel === 'C' },
                { label: 'D', text: optD, isCorrect: correctLabel === 'D' },
              ],
            },
          ],
        },
      });
      setFeedback(
        manualDaily && !canPublishDaily
          ? 'Manual quiz submitted as a daily quiz suggestion for Super Admin review.'
          : 'Manual quiz published successfully.'
      );
      setManualTitle('');
      setQText('');
      setQExplanation('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      await loadQuizzes();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Could not create manual quiz.');
    } finally {
      setSavingManual(false);
    }
  };

  const handlePublishQuiz = async (quiz: AdminQuizRecord, isDaily: boolean) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/quizzes/${quiz.id}`, {
        method: 'PATCH',
        token,
        body: { status: 'published', isDaily },
      });
      await loadQuizzes();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to update quiz.');
    }
  };

  const handleDeleteQuiz = async (id: number) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/quizzes/${id}`, { method: 'DELETE', token });
      await loadQuizzes();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Could not delete quiz.');
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    try {
      await apiRequest(`/api/admin/quizzes/questions/${questionId}`, {
        method: 'DELETE',
        token,
      });
      await loadQuizzes();
    } catch (err: any) {
      setError(err?.message || 'Could not delete question.');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3.5 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Quiz Generator */}
        <form
          onSubmit={handleAiGenerate}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
              AI Daily Quiz Generator
            </h3>
            <Sparkles className="w-4 h-4 text-[#0D9488]" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {aiConfigured
              ? 'Server-side Gemini API is ready. Questions are automatically deduplicated and validated.'
              : 'Configure GEMINI_API_KEY in Settings > Secrets to enable live AI generation.'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ai-quiz-cat"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Category
              </label>
              <select
                id="ai-quiz-cat"
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              >
                {QUIZ_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="ai-quiz-count"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Question Count
              </label>
              <select
                id="ai-quiz-count"
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              >
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={aiDaily}
              onChange={(e) => setAiDaily(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>
              {canPublishDaily
                ? 'Publish immediately as Today’s Daily Quiz'
                : 'Submit as Daily Quiz suggestion for Super Admin approval'}
            </span>
          </label>

          <button
            type="submit"
            disabled={generating}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white disabled:opacity-60"
          >
            {generating ? 'Generating & Validating...' : 'Generate AI Quiz'}
          </button>
        </form>

        {/* Manual Quiz Builder */}
        <form
          onSubmit={handleManualCreate}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
              Create Manual Quiz
            </h3>
            <Plus className="w-4 h-4 text-[#0D9488]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Quiz title..."
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            >
              {QUIZ_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            required
            placeholder="Question prompt (min 10 chars)..."
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              placeholder="Option A"
              value={optA}
              onChange={(e) => setOptA(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              placeholder="Option B"
              value={optB}
              onChange={(e) => setOptB(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              placeholder="Option C"
              value={optC}
              onChange={(e) => setOptC(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              placeholder="Option D"
              value={optD}
              onChange={(e) => setOptD(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Correct option"
              value={correctLabel}
              onChange={(e) => setCorrectLabel(e.target.value as 'A' | 'B' | 'C' | 'D')}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            >
              <option value="A">Correct: A</option>
              <option value="B">Correct: B</option>
              <option value="C">Correct: C</option>
              <option value="D">Correct: D</option>
            </select>
            <input
              type="text"
              required
              placeholder="Short explanation..."
              value={qExplanation}
              onChange={(e) => setQExplanation(e.target.value)}
              className="col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={manualDaily}
                onChange={(e) => setManualDaily(e.target.checked)}
              />
              <span>{canPublishDaily ? 'Mark as Daily' : 'Suggest as Daily'}</span>
            </label>
            <button
              type="submit"
              disabled={savingManual}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white disabled:opacity-60"
            >
              {savingManual ? 'Saving...' : 'Save Manual Quiz'}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Quizzes Management Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
          Published &amp; Suggested Quizzes ({quizzes.length})
        </h3>

        {loading ? (
          <div className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {quizzes.map((q) => (
              <div key={q.id} className="py-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {q.title}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {q.category} · {q.quizDate} · {q.status.toUpperCase()} ·{' '}
                      {q.isDaily ? 'Daily Featured' : 'Archive'} · {q.questions.length} Qs ·{' '}
                      {q.attemptCount} attempts
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canPublishDaily && (q.status !== 'published' || !q.isDaily) && (
                      <button
                        type="button"
                        onClick={() => void handlePublishQuiz(q, true)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        Publish as Daily
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteQuiz(q.id)}
                      aria-label={`Delete quiz ${q.title}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {q.questions.length > 0 && (
                  <div className="pl-3 space-y-1">
                    {q.questions.slice(0, 3).map((qq) => (
                      <div
                        key={qq.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"
                      >
                        <span className="truncate">• {qq.questionText}</span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteQuestion(qq.id)}
                          className="text-[11px] text-red-600 dark:text-red-400 hover:underline shrink-0"
                        >
                          Remove Q
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
