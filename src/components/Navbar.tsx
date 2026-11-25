import { useState } from 'react';
import { Menu, Moon, Sun, User, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { AppRoute } from '../types/darbar';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute, param?: string) => void;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string }> = [
  { route: 'home', label: 'Home' },
  { route: 'materials', label: 'Study Materials' },
  { route: 'quiz', label: 'Daily Quiz' },
  { route: 'about', label: 'About Us' },
  { route: 'contact', label: 'Contact' },
];

export function Navbar({ currentRoute, onNavigate }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { student, admin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Clean single-line brand wordmark */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            go('home');
          }}
          className="font-display text-2xl font-bold tracking-tight text-[#0F2447] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded"
        >
          দরবার
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {NAV_ITEMS.map((item) => {
            const active =
              currentRoute === item.route ||
              (item.route === 'materials' && currentRoute === 'subject');
            return (
              <a
                key={item.route}
                href={`#${item.route}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.route);
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-200 ${
                  active
                    ? 'text-[#0F2447] dark:text-white font-semibold after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:bg-[#0D9488]'
                    : 'hover:text-[#0F2447] dark:hover:text-white'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Theme switch + primary Student account CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => go(admin ? 'admin-dashboard' : 'student')}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white hover:bg-[#193666] dark:hover:bg-blue-500 transition-colors duration-200 whitespace-nowrap shrink-0"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            <span>
              {admin
                ? admin.role === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : 'Vice Admin'
                : student
                  ? student.fullName.split(' ')[0]
                  : 'Student Login'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              currentRoute === item.route ||
              (item.route === 'materials' && currentRoute === 'subject');
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => go(item.route)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-100 dark:bg-slate-800 text-[#0F2447] dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => go('student')}
              className="w-full py-3 px-4 rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white text-sm font-medium text-center"
            >
              {student ? `Student Dashboard (${student.fullName.split(' ')[0]})` : 'Student Profile / Login'}
            </button>
            <button
              type="button"
              onClick={() => go(admin ? 'admin-dashboard' : 'admin-login')}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium text-center"
            >
              {admin ? 'Open Admin Dashboard' : 'Administrator Portal'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
