import { FormEvent, useState } from 'react';
import { BookOpen, CheckCircle2, Mail, MapPin, Phone, Send, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AppRoute, HomepageContent } from '../types/darbar';

export function AboutPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <section className="space-y-4">
        <p className="text-xs font-semibold text-[#0D9488] dark:text-teal-400">
          About দরবার (Darbar)
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0F2447] dark:text-white [text-wrap:balance]">
          A Focused Digital Study Hall for Senior Secondary Students
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
          দরবার (Darbar) was founded to remove friction from Class 11 and Class 12 exam
          preparation. Instead of scattered messaging threads and broken file links, Darbar
          organizes verified notes, derivations, question papers, and daily general knowledge
          practice into one dependable, mobile-friendly academic archive.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: BookOpen,
            title: 'Bilingual Accessibility',
            body: 'Serving English and Bengali medium learners side-by-side with clear chapter indexing across all 7 core subjects.',
          },
          {
            icon: ShieldCheck,
            title: 'Two-Tier Academic Curation',
            body: 'Documents and quizzes are managed through an audited Super Admin and Vice Admin review workflow to preserve accuracy.',
          },
          {
            icon: CheckCircle2,
            title: 'Open Learning First',
            body: 'Every published PDF, formula sheet, and daily GK quiz is immediately accessible on phones, tablets, and desktops.',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F2447] dark:text-teal-300 flex items-center justify-center">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {card.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {card.body}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-[#0F2447] text-white rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-bold">Ready to start revising?</h2>
          <p className="text-sm text-slate-300">
            Jump into our Class 11 &amp; 12 library or test yourself with today’s Daily Quiz.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('materials')}
            className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white"
          >
            Explore Materials
          </button>
          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            Daily Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactPage({ homepage }: { homepage: HomepageContent }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/contact', {
        method: 'POST',
        body: { name, email, subject, message },
      });
      setSuccess(res.message);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0D9488] dark:text-teal-400">Contact Desk</p>
          <h1 className="font-display text-3xl font-bold text-[#0F2447] dark:text-white">
            Reach the Darbar Academic Team
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Request missing chapter notes, report a question correction, or share feedback about
            Class 11 &amp; 12 study resources.
          </p>
        </div>

        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 mt-1 text-[#0D9488]" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Email</p>
              <p>{homepage.contactEmail}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 mt-1 text-[#0D9488]" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Academic Desk Phone</p>
              <p className="tabular-nums">{homepage.contactPhone}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 mt-1 text-[#0D9488]" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Office</p>
              <p>{homepage.contactAddress}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Your Name
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="contact-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-subject"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Subject / Topic
            </label>
            <input
              id="contact-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Request for Class 12 Chemistry Electrochemistry Notes"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              rows={5}
              required
              minLength={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 hover:bg-[#193666] text-white disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Sending...' : 'Send Message'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[#0F2447] dark:text-white">
        {type === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400">Effective Date: January 2026</p>
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        {type === 'privacy' ? (
          <>
            <p>
              দরবার (Darbar) collects only the information necessary to provide student accounts,
              saved study materials, download history, and daily quiz score tracking.
            </p>
            <p>
              Passwords are stored using salted cryptographic hashing on the server. Session tokens
              expire automatically and are never sold or shared with third-party advertisers.
            </p>
            <p>
              Students may browse and download public study materials without registering an
              account. Registered learners can update or delete bookmarks and account information at
              any time from the Student Dashboard.
            </p>
          </>
        ) : (
          <>
            <p>
              Study documents published on দরবার (Darbar) are intended strictly for personal
              educational study by Class 11 and Class 12 students and educators.
            </p>
            <p>
              Automated scraping, unauthorized uploading, or redistribution of curated study packs
              for commercial resale is prohibited. Administrative access is restricted to verified
              Super Admin and Vice Admin personnel and is logged for accountability.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
