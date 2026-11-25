import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  BrainCircuit,
  Clock,
  Download,
  LogOut,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { apiRequest, triggerDocumentDownload } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatFileSize } from '../lib/documentLogic';
import { formatCountdown } from '../lib/quizLogic';
import type { AppRoute, StudentProfile } from '../types/darbar';

interface StudentDashboardData {
  student: StudentProfile;
  savedDocuments: Array<{
    bookmarkId: number;
    id: number;
    title: string;
    chapterName: string;
    category: string;
    fileFormat: string;
    fileSizeBytes: number;
    subjectSlug: string;
    subjectName: string;
  }>;
  recentlyViewed: Array<{
    viewId: number;
    id: number;
    title: string;
    fileFormat: string;
    subjectSlug: string;
    subjectName: string;
    viewedAt: string;
  }>;
  downloadHistory: Array<{
    downloadId: number;
    id: number;
    title: string;
    fileFormat: string;
    fileSizeBytes: number;
    subjectName: string;
    downloadedAt: string;
  }>;
  quizHistory: Array<{
    attemptId: number;
    quizId: number;
    quizTitle: string;
    category: string;
    score: number;
    totalQuestions: number;
    timeTakenSeconds: number;
    completedAt: string;
  }>;
}

export function StudentPortalPage({
  onNavigate,
}: {
  onNavigate: (route: AppRoute, param?: string) => void;
}) {
  const {
    student,
    studentToken,
    setStudentSession,
    signInWithGoogle,
    logoutStudent,
    toggleBookmark,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentClass, setStudentClass] = useState('Class 12');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('Class 12');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!studentToken) return;
    setLoadingDash(true);
    try {
      const data = await apiRequest<StudentDashboardData>('/api/student/dashboard', {
        token: studentToken,
      });
      setDashboard(data);
      setEditName(data.student.fullName);
      setEditClass(data.student.studentClass);
    } catch (err: any) {
      setError(err?.message || 'Could not load student dashboard.');
    } finally {
      setLoadingDash(false);
    }
  }, [studentToken]);

  useEffect(() => {
    if (student && studentToken) {
      void fetchDashboard();
    }
  }, [student, studentToken, fetchDashboard]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (mode === 'login') {
        const res = await apiRequest<{ token: string; student: StudentProfile }>(
          '/api/student/login',
          { method: 'POST', body: { email, password } }
        );
        setStudentSession(res.student, res.token);
      } else if (mode === 'register') {
        const res = await apiRequest<{ token: string; student: StudentProfile }>(
          '/api/student/register',
          { method: 'POST', body: { fullName, email, password, studentClass } }
        );
        setStudentSession(res.student, res.token);
      } else if (mode === 'forgot') {
        if (resetStep === 'request') {
          const res = await apiRequest<{ message: string }>('/api/student/forgot-password', {
            method: 'POST',
            body: { email },
          });
          setFeedback(res.message);
          setResetStep('confirm');
        } else {
          const res = await apiRequest<{ message: string }>('/api/student/reset-password', {
            method: 'POST',
            body: { email, resetCode, newPassword },
          });
          setFeedback(res.message);
          setMode('login');
          setResetStep('request');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentToken) return;
    setSavingProfile(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ student: StudentProfile }>('/api/student/me', {
        method: 'PATCH',
        token: studentToken,
        body: { fullName: editName, studentClass: editClass },
      });
      setStudentSession(res.student, studentToken);
      setFeedback('Student profile updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemoveBookmark = async (docId: number) => {
    await toggleBookmark(docId);
    void fetchDashboard();
  };

  // --- SIGNED OUT AUTH FORMS ---
  if (!student) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-[#0F2447] dark:text-white">
              Student Account
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in to save study materials, track downloads, and build your Daily Quiz score
              history. Browsing public materials remains free without an account.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B1120]">
            {[
              { id: 'login', label: 'Sign In' },
              { id: 'register', label: 'Register' },
              { id: 'forgot', label: 'Reset' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id as 'login' | 'register' | 'forgot');
                  setError(null);
                  setFeedback(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                  mode === tab.id
                    ? 'bg-white dark:bg-slate-800 text-[#0F2447] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogleLogin()}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2.5"
              >
                <span className="font-bold text-blue-600">G</span>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                <span className="bg-white dark:bg-[#111827] px-3 text-xs text-slate-400 absolute">
                  or with email
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label
                    htmlFor="student-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Arindam Bose"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="student-class"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Academic Class
                  </label>
                  <select
                    id="student-class"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  >
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Competitive Prep">Competitive Prep</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="student-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Email Address
              </label>
              <input
                id="student-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label
                  htmlFor="student-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Password
                </label>
                <input
                  id="student-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>
            )}

            {mode === 'forgot' && resetStep === 'confirm' && (
              <>
                <div>
                  <label
                    htmlFor="reset-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    6-Digit Recovery Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    New Password
                  </label>
                  <input
                    id="reset-new-password"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New 6+ character password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            {feedback && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{feedback}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#0F2447] dark:bg-blue-600 hover:bg-[#193666] dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In to Darbar'
                  : mode === 'register'
                    ? 'Create Student Account'
                    : resetStep === 'request'
                      ? 'Request Password Reset'
                      : 'Confirm New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- SIGNED IN STUDENT DASHBOARD ---
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Welcome Banner */}
      <section className="bg-[#0F2447] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs text-teal-300">
            <UserCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {student.studentClass} · {student.email}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Welcome back, {student.fullName}
          </h1>
          <p className="text-sm text-slate-300">
            Track your saved study materials, recent downloads, and daily GK quiz scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>Take Daily Quiz</span>
          </button>
          <button
            type="button"
            onClick={() => void logoutStudent()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </section>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Saved Documents', value: dashboard?.savedDocuments.length ?? 0 },
          { label: 'Downloads Logged', value: dashboard?.downloadHistory.length ?? 0 },
          { label: 'Quizzes Completed', value: dashboard?.quizHistory.length ?? 0 },
          { label: 'Recently Viewed', value: dashboard?.recentlyViewed.length ?? 0 },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{m.label}</p>
            <p className="font-display text-2xl font-bold text-[#0F2447] dark:text-white tabular-nums mt-1">
              {loadingDash ? '—' : m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Saved Documents & Download History */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#0D9488]" />
                <span>Saved Study Documents</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('materials')}
                className="text-xs font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline"
              >
                Explore Library
              </button>
            </div>

            {!dashboard || dashboard.savedDocuments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                You haven’t saved any documents yet. Click the bookmark icon on any study resource
                to keep it here for quick exam revision.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.savedDocuments.map((doc) => (
                  <div
                    key={doc.bookmarkId}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {doc.subjectName} · {doc.fileFormat} · {formatFileSize(doc.fileSizeBytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          triggerDocumentDownload(
                            doc.id,
                            `${doc.title}.${doc.fileFormat.toLowerCase()}`,
                            studentToken
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveBookmark(doc.id)}
                        aria-label={`Remove saved document ${doc.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-[#0D9488]" />
              <span>Quiz History &amp; Scores</span>
            </h2>
            {!dashboard || dashboard.quizHistory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                Complete a daily quiz to track your scores and accuracy over time.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.quizHistory.map((q) => (
                  <div key={q.attemptId} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {q.quizTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {q.category} · {formatCountdown(q.timeTakenSeconds)} ·{' '}
                        {new Date(q.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums text-[#0D9488] dark:text-teal-400 shrink-0">
                      {q.score}/{q.totalQuestions}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Profile Editor & Recent Downloads/Views */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
              Student Profile
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label
                  htmlFor="edit-student-name"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Display Name
                </label>
                <input
                  id="edit-student-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-student-class"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Class
                </label>
                <select
                  id="edit-student-class"
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                >
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                  <option value="Competitive Prep">Competitive Prep</option>
                </select>
              </div>
              {feedback && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{feedback}</p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </form>
          </section>

          <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0D9488]" />
              <span>Download History</span>
            </h2>
            {!dashboard || dashboard.downloadHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documents you download while signed in appear here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.downloadHistory.slice(0, 6).map((item) => (
                  <div key={item.downloadId} className="py-2.5">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.subjectName} · {item.fileFormat}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
