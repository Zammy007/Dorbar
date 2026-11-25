import { FormEvent, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookMarked,
  BrainCircuit,
  Clock,
  Eye,
  Lock,
  Megaphone,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { SubjectIcon } from '../components/SubjectIcon';
import { DocumentCard } from '../components/DocumentCard';
import type {
  AnnouncementItem,
  AppRoute,
  DocumentItem,
  HomepageContent,
  PlatformStats,
  SubjectItem,
} from '../types/darbar';

interface HomePageProps {
  stats: PlatformStats;
  subjects: SubjectItem[];
  recentDocuments: DocumentItem[];
  announcements: AnnouncementItem[];
  homepage: HomepageContent;
  loading: boolean;
  onNavigate: (route: AppRoute, param?: string) => void;
  onSearchSubmit: (query: string) => void;
  onPreviewDocument: (doc: DocumentItem) => void;
  onUploadSubject: (subject: SubjectItem) => void;
}

const WHY_DARBAR = [
  {
    icon: BookMarked,
    title: 'Board-Aligned Class 11 & 12 Archive',
    description:
      'Every note, derivation, and question bank is organized cleanly by subject and chapter so students spend time studying rather than searching.',
  },
  {
    icon: BrainCircuit,
    title: 'Fresh Daily General Knowledge Quizzes',
    description:
      'Timed 4-option quizzes across Science, History, Indian GK, and Current Affairs with immediate answer explanations and score tracking.',
  },
  {
    icon: Smartphone,
    title: 'Fast & Reliable on Any Device',
    description:
      'Built lightweight for Android phones, tablets, and slower connections with direct one-tap PDF previews and offline-ready downloads.',
  },
  {
    icon: ShieldCheck,
    title: 'Curated by Verified Educators',
    description:
      'Resources are reviewed and published by Darbar academic administrators with transparent version updates and zero clutter.',
  },
];

export function HomePage({
  stats,
  subjects,
  recentDocuments,
  announcements,
  homepage,
  loading,
  onNavigate,
  onSearchSubmit,
  onPreviewDocument,
  onUploadSubject,
}: HomePageProps) {
  const [heroQuery, setHeroQuery] = useState('');

  const handleQuickSearch = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit(heroQuery.trim());
  };

  return (
    <div className="space-y-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-[#0F2447] text-white">
        <img
          src="/src/assets/images/hero_darbar_study_1795581778849.jpg"
          alt="Sunlit library study table with physics and mathematics notebooks"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#091834]/95 via-[#0F2447]/85 to-[#0F2447]/65"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl space-y-6"
          >
            <p className="text-sm font-medium text-teal-300 tracking-wide">
              দরবার · Class 11 &amp; 12 Academic Resource Hall
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] [text-wrap:balance]">
              {homepage.heroTitle}
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
              {homepage.heroSubtitle}
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('materials')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors duration-200 whitespace-nowrap"
              >
                <span>Explore Materials</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('quiz')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white transition-colors duration-200 whitespace-nowrap"
              >
                <span>Take Daily Quiz</span>
              </button>
            </div>

            {/* Instant Global Search Bar */}
            <form onSubmit={handleQuickSearch} className="pt-4 max-w-xl">
              <label htmlFor="hero-search" className="sr-only">
                Search study materials, subjects, chapters, or question papers
              </label>
              <div className="flex items-center bg-white dark:bg-[#111827] rounded-xl p-1.5 shadow-lg border border-white/10">
                <Search
                  className="w-5 h-5 text-slate-400 ml-3 shrink-0"
                  aria-hidden="true"
                />
                <input
                  id="hero-search"
                  type="search"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Search Physics, Calculus, Bengali notes, question papers..."
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  Search
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* ACTIVE ANNOUNCEMENTS BAR */}
      {announcements.length > 0 && (
        <section
          aria-label="Latest academic notices"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10"
        >
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {announcements[0].title}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  {announcements[0].content}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('materials')}
              className="text-xs font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline whitespace-nowrap shrink-0 self-start md:self-center"
            >
              Browse latest uploads
            </button>
          </div>
        </section>
      )}

      {/* 2. WELCOME TO DARBAR + 6. LIVE PLATFORM STATISTICS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6 space-y-4">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2447] dark:text-white">
              {homepage.welcomeHeading}
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {homepage.welcomeBody}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('about')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline"
              >
                <span>Learn about our academic mission</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Real Database-Connected Platform Statistics */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            {[
              { label: 'Total Documents', value: stats.totalDocuments, note: 'Verified study files' },
              { label: 'Total Subjects', value: stats.totalSubjects, note: 'Class 11 & 12 streams' },
              { label: 'Total Quizzes', value: stats.totalQuizzes, note: 'Published GK challenges' },
              { label: 'Total Students', value: stats.totalStudents, note: 'Registered learners' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                {loading ? (
                  <div className="h-9 w-16 mt-2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ) : (
                  <p className="font-display text-3xl font-bold text-[#0F2447] dark:text-white tabular-nums mt-1.5">
                    {stat.value}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. AVAILABLE SUBJECTS (7 MAIN SUBJECTS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2447] dark:text-white">
              Available Subjects
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5">
              Select a subject to explore chapter-wise PDF notes, solved question papers, and practice sets.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('materials')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
          >
            <span>View all materials</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse"
                />
              ))
            : subjects.map((subject) => (
                <article
                  key={subject.id}
                  className="group text-left bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-[#1D4ED8] dark:hover:border-teal-500 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F2447] dark:text-teal-300 flex items-center justify-center group-hover:bg-[#0F2447] group-hover:text-white dark:group-hover:bg-teal-600 transition-colors">
                        <SubjectIcon name={subject.icon} className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {subject.documentCount ?? 0} files
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                      {subject.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {subject.bengaliName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                      {subject.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('subject', subject.slug)}
                      aria-label={`View ${subject.name} materials`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUploadSubject(subject)}
                      aria-label={`Upload to ${subject.name} (password protected)`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#0D9488] hover:text-[#0D9488] dark:hover:border-teal-400 dark:hover:text-teal-300 hover:bg-teal-50/60 dark:hover:bg-teal-950/30 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Upload</span>
                      <Lock className="w-3 h-3 opacity-70" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
        </div>
      </section>

      {/* 4. RECENTLY UPLOADED MATERIALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2447] dark:text-white">
              Recently Uploaded Materials
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5">
              Latest study sheets, board question banks, and formula compendiums added to Darbar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('materials')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
          >
            <span>Filter &amp; search all documents</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : recentDocuments.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No study materials have been published yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {recentDocuments.slice(0, 8).map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onPreview={onPreviewDocument}
                onRequireStudentLogin={() => onNavigate('student')}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. DAILY GENERAL KNOWLEDGE QUIZ SPOTLIGHT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0F2447] text-white grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold text-teal-300 tracking-wide">
              দরবার Daily Quiz · Powered by AI
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-bold leading-tight [text-wrap:balance]">
              Sharpen Your General Knowledge Every Single Day
            </h2>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
              Challenge yourself with fresh 4-option multiple-choice sets spanning Science, History,
              Geography, Technology, Current Affairs, Indian GK, and World GK. Every quiz features a
              live countdown timer, automatic grading, and crisp explanations.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                Timed challenge
              </span>
              <span aria-hidden="true">·</span>
              <span>9 GK categories</span>
              <span aria-hidden="true">·</span>
              <span>Instant answer explanations</span>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('quiz')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors"
              >
                <span>Start Today’s Quiz</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px]">
            <img
              src="/src/assets/images/banner_daily_quiz_1795581779685.jpg"
              alt="Glass prism, brass compass, and hardcover encyclopedia on a navy desk"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* 6. WHY CHOOSE DARBAR? */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2447] dark:text-white">
            Why Choose দরবার?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1.5">
            Designed around how Class 11 and 12 students actually prepare for board examinations and
            competitive entrance tests.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_DARBAR.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F2447] dark:text-teal-300 flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-slate-400">
                    0{idx + 1}
                  </span>
                </div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
