import { useCallback, useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { apiRequest } from './lib/api';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { SubjectUploadModal } from './components/SubjectUploadModal';
import { HomePage } from './pages/HomePage';
import { MaterialsPage } from './pages/MaterialsPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { DailyQuizPage } from './pages/DailyQuizPage';
import { StudentPortalPage } from './pages/StudentPortalPage';
import { AboutPage, ContactPage, LegalPage } from './pages/AboutContactPages';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import type {
  AnnouncementItem,
  AppRoute,
  DocumentItem,
  HomepageContent,
  PlatformStats,
  SubjectItem,
} from './types/darbar';

interface BootstrapPayload {
  stats: PlatformStats;
  subjects: SubjectItem[];
  recentDocuments: DocumentItem[];
  announcements: AnnouncementItem[];
  homepage: HomepageContent;
}

const FALLBACK_HOMEPAGE: HomepageContent = {
  heroTitle: 'Your Learning Journey Starts Here.',
  heroSubtitle: 'Everything you need to study smarter, learn better, and stay ahead.',
  welcomeHeading: 'Welcome to দরবার (Darbar)',
  welcomeBody:
    'Built specifically for Class 11 and Class 12 learners, Darbar gathers curated subject notes, solved board question papers, and daily general knowledge challenges.',
  contactEmail: 'academic@darbar-edu.org',
  contactPhone: '+91 33 4018 7420',
  contactAddress: 'College Street Academic Wing, Kolkata 700073, West Bengal',
};

function parseRouteFromHash(): { route: AppRoute; param: string } {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  if (!raw || raw === 'home') return { route: 'home', param: '' };
  if (raw.startsWith('subject/')) {
    return { route: 'subject', param: decodeURIComponent(raw.slice('subject/'.length)) };
  }
  const allowed: AppRoute[] = [
    'home',
    'materials',
    'quiz',
    'student',
    'about',
    'contact',
    'privacy',
    'terms',
    'admin-login',
    'admin-dashboard',
  ];
  if (allowed.includes(raw as AppRoute)) {
    return { route: raw as AppRoute, param: '' };
  }
  return { route: 'home', param: '' };
}

function DarbarShell() {
  const [routeState, setRouteState] = useState<{ route: AppRoute; param: string }>(() =>
    parseRouteFromHash()
  );
  const [searchSeed, setSearchSeed] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [uploadSubject, setUploadSubject] = useState<SubjectItem | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const [bootstrap, setBootstrap] = useState<BootstrapPayload>({
    stats: { totalDocuments: 0, totalSubjects: 0, totalQuizzes: 0, totalStudents: 0 },
    subjects: [],
    recentDocuments: [],
    announcements: [],
    homepage: FALLBACK_HOMEPAGE,
  });
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const loadBootstrap = useCallback(async () => {
    setBootstrapError(null);
    try {
      const data = await apiRequest<BootstrapPayload>('/api/bootstrap');
      setBootstrap(data);
    } catch (err: any) {
      setBootstrapError(err?.message || 'Unable to connect to Darbar database.');
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const onHashChange = () => {
      setRouteState(parseRouteFromHash());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((route: AppRoute, param = '') => {
    const hash = route === 'subject' && param ? `#subject/${encodeURIComponent(param)}` : `#${route}`;
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setRouteState({ route, param });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleHeroSearch = useCallback(
    (q: string) => {
      setSearchSeed(q);
      navigate('materials');
    },
    [navigate]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar currentRoute={routeState.route} onNavigate={navigate} />

      {bootstrapError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4">
            <span>{bootstrapError}</span>
            <button
              type="button"
              onClick={() => void loadBootstrap()}
              className="font-semibold underline shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {routeState.route === 'home' && (
          <HomePage
            stats={bootstrap.stats}
            subjects={bootstrap.subjects}
            recentDocuments={bootstrap.recentDocuments}
            announcements={bootstrap.announcements}
            homepage={bootstrap.homepage}
            loading={loadingBootstrap}
            onNavigate={navigate}
            onSearchSubmit={handleHeroSearch}
            onPreviewDocument={setPreviewDoc}
            onUploadSubject={setUploadSubject}
          />
        )}

        {routeState.route === 'materials' && (
          <MaterialsPage
            subjects={bootstrap.subjects}
            initialQuery={searchSeed}
            refreshKey={dataVersion}
            onNavigate={navigate}
            onPreviewDocument={setPreviewDoc}
            onUploadSubject={setUploadSubject}
          />
        )}

        {routeState.route === 'subject' && (
          <SubjectDetailPage
            slug={routeState.param}
            subjects={bootstrap.subjects}
            refreshKey={dataVersion}
            onNavigate={navigate}
            onPreviewDocument={setPreviewDoc}
            onUploadSubject={setUploadSubject}
          />
        )}

        {routeState.route === 'quiz' && <DailyQuizPage />}

        {routeState.route === 'student' && <StudentPortalPage onNavigate={navigate} />}

        {routeState.route === 'about' && <AboutPage onNavigate={navigate} />}

        {routeState.route === 'contact' && <ContactPage homepage={bootstrap.homepage} />}

        {routeState.route === 'privacy' && <LegalPage type="privacy" />}

        {routeState.route === 'terms' && <LegalPage type="terms" />}

        {routeState.route === 'admin-login' && <AdminLoginPage onNavigate={navigate} />}

        {routeState.route === 'admin-dashboard' && (
          <AdminDashboardPage
            subjects={bootstrap.subjects}
            homepage={bootstrap.homepage}
            onNavigate={navigate}
            onRefreshPublicData={() => void loadBootstrap()}
          />
        )}
      </main>

      <Footer homepage={bootstrap.homepage} onNavigate={navigate} />

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <SubjectUploadModal
        subject={uploadSubject}
        onClose={() => setUploadSubject(null)}
        onUploaded={() => {
          setDataVersion((v) => v + 1);
          void loadBootstrap();
        }}
        onViewSubject={(slug) => navigate('subject', slug)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DarbarShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
