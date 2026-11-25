import { Mail, MapPin, Phone, Shield } from 'lucide-react';
import type { AppRoute, HomepageContent } from '../types/darbar';

interface FooterProps {
  homepage: HomepageContent;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function Footer({ homepage, onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand & About */}
          <div className="space-y-3">
            <div className="font-display text-2xl font-bold text-[#0F2447] dark:text-white">
              দরবার
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              A dedicated digital study hall for Class 11 and Class 12 students offering curated
              subject notes, solved board papers, and AI-powered daily general knowledge quizzes.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('materials')}
                  className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                >
                  Study Materials
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('quiz')}
                  className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                >
                  দরবার Daily Quiz
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                >
                  About Darbar
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('student')}
                  className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                >
                  Student Account
                </button>
              </li>
            </ul>
          </div>

          {/* Subjects & Governance */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Core Subjects
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              {[
                { slug: 'bengali', label: 'বাংলা (Bengali)' },
                { slug: 'english', label: 'English' },
                { slug: 'physics', label: 'Physics' },
                { slug: 'mathematics', label: 'Mathematics' },
                { slug: 'chemistry', label: 'Chemistry' },
                { slug: 'biology', label: 'Biology' },
              ].map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => onNavigate('subject', s.slug)}
                    className="hover:text-[#1D4ED8] dark:hover:text-teal-400 transition-colors"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Contact Information
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 mt-0.5 text-[#0D9488] shrink-0" aria-hidden="true" />
                <span>{homepage.contactEmail}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 mt-0.5 text-[#0D9488] shrink-0" aria-hidden="true" />
                <span className="tabular-nums">{homepage.contactPhone}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 text-[#0D9488] shrink-0" aria-hidden="true" />
                <span>{homepage.contactAddress}</span>
              </li>
            </ul>
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onNavigate('admin-login')}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-[#0F2447] dark:hover:text-white transition-colors"
              >
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Administrator Portal</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© 2026 দরবার. All Rights Reserved.</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Terms and Conditions
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Contact Desk
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
