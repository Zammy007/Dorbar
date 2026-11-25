import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatFileSize } from '../lib/documentLogic';
import { AdminUploadForm } from '../components/AdminUploadForm';
import { AdminQuizManager } from '../components/AdminQuizManager';
import type { AdminPermissionSet } from '../lib/permissions';
import type {
  AdminActivityLogItem,
  AdminProfileData,
  AnnouncementItem,
  AppRoute,
  DocumentItem,
  HomepageContent,
  SubjectItem,
} from '../types/darbar';

type AdminTab =
  | 'overview'
  | 'documents'
  | 'quizzes'
  | 'website'
  | 'vice-admin'
  | 'audit-security'
  | 'profile';

interface OverviewResponse {
  kpis: {
    totalStudents: number;
    totalDocuments: number;
    totalDownloads: number;
    totalQuizzes: number;
    totalQuizAttempts: number;
    totalMessages: number;
  };
  aiConfigured: boolean;
  recentLogs: AdminActivityLogItem[];
  recentDocuments: Array<{
    id: number;
    title: string;
    subjectName: string;
    fileFormat: string;
    status: string;
    downloadCount: number;
    createdAt: string;
  }>;
}

const PERMISSION_LABELS: Array<{ key: keyof AdminPermissionSet; label: string }> = [
  { key: 'uploadDocuments', label: 'Upload Study Materials' },
  { key: 'editDocuments', label: 'Edit & Organize Documents' },
  { key: 'deleteDocuments', label: 'Delete Documents' },
  { key: 'manageSubjects', label: 'Create Subject Categories' },
  { key: 'manageQuizzes', label: 'Create & Manage Quizzes' },
  { key: 'publishDailyQuiz', label: 'Publish Daily Featured Quiz' },
  { key: 'manageAnnouncements', label: 'Manage Announcements' },
  { key: 'viewAnalytics', label: 'View Platform Statistics' },
];

export function AdminDashboardPage({
  subjects,
  homepage,
  onNavigate,
  onRefreshPublicData,
}: {
  subjects: SubjectItem[];
  homepage: HomepageContent;
  onNavigate: (route: AppRoute) => void;
  onRefreshPublicData: () => void;
}) {
  const { admin, adminToken, logoutAdmin } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tab, setTab] = useState<AdminTab>('overview');

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [viceProfile, setViceProfile] = useState<AdminProfileData | null>(null);
  const [viceActivities, setViceActivities] = useState<AdminActivityLogItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminActivityLogItem[]>([]);
  const [contactMessages, setContactMessages] = useState<
    Array<{ id: number; name: string; email: string; subject: string; message: string; createdAt: string }>
  >([]);
  const [myActivities, setMyActivities] = useState<AdminActivityLogItem[]>([]);

  // Form states
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectBn, setNewSubjectBn] = useState('');
  const [newSubjectDesc, setNewSubjectDesc] = useState('');

  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState<'info' | 'exam' | 'update'>('info');

  const [siteForm, setSiteForm] = useState<HomepageContent>(homepage);
  const [viceNewPassword, setViceNewPassword] = useState('');

  const [currSuperPass, setCurrSuperPass] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [newSuperPass, setNewSuperPass] = useState('');

  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocChapter, setEditDocChapter] = useState('');
  const [editDocStatus, setEditDocStatus] = useState<'published' | 'draft'>('published');

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSiteForm(homepage);
  }, [homepage]);

  const isSuper = admin?.role === 'SUPER_ADMIN';

  const loadDashboardData = useCallback(async () => {
    if (!admin || !adminToken) return;
    setError(null);
    try {
      const promises: Array<Promise<any>> = [
        apiRequest<OverviewResponse>('/api/admin/overview', { token: adminToken }).then(setOverview),
        apiRequest<{ documents: DocumentItem[] }>('/api/admin/documents', { token: adminToken }).then(
          (r) => setDocs(r.documents)
        ),
        apiRequest<{ recentActivities: AdminActivityLogItem[] }>('/api/admin/me', {
          token: adminToken,
        }).then((r) => setMyActivities(r.recentActivities)),
      ];

      if (isSuper || admin.permissions.manageAnnouncements) {
        promises.push(
          apiRequest<{ announcements: AnnouncementItem[] }>('/api/admin/announcements', {
            token: adminToken,
          }).then((r) => setAnnouncements(r.announcements))
        );
      }

      if (isSuper) {
        promises.push(
          apiRequest<{ viceAdmin: AdminProfileData; activities: AdminActivityLogItem[] }>(
            '/api/admin/vice-admin',
            { token: adminToken }
          ).then((r) => {
            setViceProfile(r.viceAdmin);
            setViceActivities(r.activities);
          }),
          apiRequest<{
            logs: AdminActivityLogItem[];
            contactMessages: Array<{
              id: number;
              name: string;
              email: string;
              subject: string;
              message: string;
              createdAt: string;
            }>;
          }>('/api/admin/audit-logs', { token: adminToken }).then((r) => {
            setAuditLogs(r.logs);
            setContactMessages(r.contactMessages);
          })
        );
      }

      await Promise.all(promises);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin dashboard data.');
    }
  }, [admin, adminToken, isSuper]);

  useEffect(() => {
    if (!admin || !adminToken) {
      onNavigate('admin-login');
      return;
    }
    void loadDashboardData();
  }, [admin, adminToken, onNavigate, loadDashboardData]);

  if (!admin || !adminToken) return null;

  const canUpload = isSuper || admin.permissions.uploadDocuments;
  const canEdit = isSuper || admin.permissions.editDocuments;
  const canDelete = isSuper || admin.permissions.deleteDocuments;
  const canSubjects = isSuper || admin.permissions.manageSubjects;
  const canQuizzes = isSuper || admin.permissions.manageQuizzes;
  const canAnnouncements = isSuper || admin.permissions.manageAnnouncements;

  const handleSaveDocEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    setError(null);
    try {
      await apiRequest(`/api/admin/documents/${editingDoc.id}`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          title: editDocTitle,
          chapterName: editDocChapter,
          status: editDocStatus,
        },
      });
      setEditingDoc(null);
      setFeedback('Document updated successfully.');
      await loadDashboardData();
      onRefreshPublicData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update document.');
    }
  };

  const handleDeleteDoc = async (id: number) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/documents/${id}`, { method: 'DELETE', token: adminToken });
      setFeedback('Document removed from storage and database.');
      await loadDashboardData();
      onRefreshPublicData();
    } catch (err: any) {
      setError(err?.message || 'Permission denied or failed to delete document.');
    }
  };

  const handleCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/admin/subjects', {
        method: 'POST',
        token: adminToken,
        body: {
          name: newSubjectName,
          bengaliName: newSubjectBn || newSubjectName,
          description: newSubjectDesc,
        },
      });
      setNewSubjectName('');
      setNewSubjectBn('');
      setNewSubjectDesc('');
      setFeedback('New subject category added.');
      onRefreshPublicData();
      await loadDashboardData();
    } catch (err: any) {
      setError(err?.message || 'Could not create subject.');
    }
  };

  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/admin/announcements', {
        method: 'POST',
        token: adminToken,
        body: { title: annTitle, content: annContent, type: annType },
      });
      setAnnTitle('');
      setAnnContent('');
      setFeedback('Announcement published.');
      await loadDashboardData();
      onRefreshPublicData();
    } catch (err: any) {
      setError(err?.message || 'Could not publish announcement.');
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE', token: adminToken });
    await loadDashboardData();
    onRefreshPublicData();
  };

  const handleSaveWebsiteSettings = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/admin/website-settings', {
        method: 'PATCH',
        token: adminToken,
        body: siteForm,
      });
      setFeedback('Homepage content and contact settings saved.');
      onRefreshPublicData();
      await loadDashboardData();
    } catch (err: any) {
      setError(err?.message || 'Could not save website settings.');
    }
  };

  const handleUpdateViceAdmin = async (
    patch: Partial<{ isActive: boolean; permissions: AdminPermissionSet; newPassword: string }>
  ) => {
    setError(null);
    try {
      const res = await apiRequest<{ viceAdmin: AdminProfileData }>('/api/admin/vice-admin', {
        method: 'PATCH',
        token: adminToken,
        body: patch,
      });
      setViceProfile(res.viceAdmin);
      setViceNewPassword('');
      setFeedback('Vice Admin access and permissions updated.');
      await loadDashboardData();
    } catch (err: any) {
      setError(err?.message || 'Could not update Vice Admin.');
    }
  };

  const handleRotateSecurityCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/security/credentials', {
        method: 'PATCH',
        token: adminToken,
        body: {
          currentPassword: currSuperPass,
          newAccessCode: newAccessCode || undefined,
          newSuperPassword: newSuperPass || undefined,
        },
      });
      setFeedback(res.message);
      setCurrSuperPass('');
      setNewAccessCode('');
      setNewSuperPass('');
      await loadDashboardData();
    } catch (err: any) {
      setError(err?.message || 'Credential rotation failed.');
    }
  };

  const navTabs: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard; show: boolean }> =
    [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
      { id: 'documents', label: 'Documents', icon: FileText, show: true },
      { id: 'quizzes', label: 'Quizzes', icon: BrainCircuit, show: canQuizzes },
      {
        id: 'website',
        label: isSuper ? 'Website & Notices' : 'Announcements',
        icon: isSuper ? Globe : Megaphone,
        show: isSuper || canAnnouncements,
      },
      { id: 'vice-admin', label: 'Vice Admin', icon: UserCog, show: isSuper },
      { id: 'audit-security', label: 'Audit & Security', icon: ShieldCheck, show: isSuper },
      { id: 'profile', label: 'My Profile', icon: Activity, show: true },
    ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Collapsible Admin Sidebar */}
        <aside
          className={`w-full ${
            sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
          } shrink-0 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 transition-all duration-200`}
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                {admin.avatarUrl && (
                  <img
                    src={admin.avatarUrl}
                    alt={admin.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#0D9488] dark:text-teal-400">
                    {isSuper ? 'Super Admin' : 'Vice Admin'}
                  </p>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {admin.displayName}
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav aria-label="Admin sections" className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {navTabs
              .filter((t) => t.show)
              .map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setError(null);
                      setFeedback(null);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#0F2447] dark:bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
          </nav>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={async () => {
                await logoutAdmin();
                onNavigate('home');
              }}
              className="w-full flex items-center justify-center lg:justify-start gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                দরবার Administration / {isSuper ? 'Super Admin Console' : 'Vice Admin Workspace'}
              </p>
              <h1 className="font-display text-2xl font-bold text-[#0F2447] dark:text-white mt-0.5">
                {navTabs.find((t) => t.id === tab)?.label}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              View Student Site
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {feedback && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {tab === 'overview' && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Students', value: overview.kpis.totalStudents },
                  { label: 'Documents', value: overview.kpis.totalDocuments },
                  { label: 'Downloads', value: overview.kpis.totalDownloads },
                  { label: 'Quizzes', value: overview.kpis.totalQuizzes },
                  { label: 'Quiz Attempts', value: overview.kpis.totalQuizAttempts },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
                    <p className="font-display text-2xl font-bold text-[#0F2447] dark:text-white tabular-nums mt-1">
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                    Recent Administrative Activity
                  </h2>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {overview.recentLogs.slice(0, 7).map((log) => (
                      <div key={log.id} className="py-2.5 text-xs">
                        <p className="font-medium text-slate-900 dark:text-white">{log.details}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {log.adminName} ({log.adminRole}) ·{' '}
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                    Recently Uploaded Study Files
                  </h2>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {overview.recentDocuments.map((d) => (
                      <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {d.title}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {d.subjectName} · {d.fileFormat} · {d.status}
                          </p>
                        </div>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                          {d.downloadCount} {d.downloadCount === 1 ? 'download' : 'downloads'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTS */}
          {tab === 'documents' && (
            <div className="space-y-6">
              {canUpload ? (
                <AdminUploadForm
                  token={adminToken}
                  subjects={subjects}
                  onUploaded={() => {
                    void loadDashboardData();
                    onRefreshPublicData();
                  }}
                />
              ) : (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-800 dark:text-amber-200">
                  Document uploading is currently restricted for your Vice Admin profile by the Super
                  Admin.
                </div>
              )}

              {/* Create Subject Category (Authorized admins) */}
              {canSubjects && (
                <form
                  onSubmit={handleCreateSubject}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
                >
                  <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#0D9488]" />
                    <span>Add New Subject Category</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Subject Name (e.g. Computer Science)"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Bengali Title (optional)"
                      value={newSubjectBn}
                      onChange={(e) => setNewSubjectBn(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      required
                      minLength={10}
                      placeholder="Short description..."
                      value={newSubjectDesc}
                      onChange={(e) => setNewSubjectDesc(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
                  >
                    Create Subject
                  </button>
                </form>
              )}

              {/* Inline Edit Drawer */}
              {editingDoc && (
                <form
                  onSubmit={handleSaveDocEdit}
                  className="bg-blue-50/70 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-5 space-y-3"
                >
                  <p className="text-xs font-semibold text-[#0F2447] dark:text-white">
                    Editing: {editingDoc.title}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={editDocTitle}
                      onChange={(e) => setEditDocTitle(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={editDocChapter}
                      onChange={(e) => setEditDocChapter(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                    <select
                      value={editDocStatus}
                      onChange={(e) => setEditDocStatus(e.target.value as 'published' | 'draft')}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#0F2447] text-white"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDoc(null)}
                      className="px-4 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Documents Inventory Table */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                    Uploaded Study Documents ({docs.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0B1120] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Title &amp; Chapter</th>
                        <th className="py-3 px-4 font-semibold">Subject</th>
                        <th className="py-3 px-4 font-semibold">Format / Size</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Downloads</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {docs.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{d.title}</p>
                            <p className="text-[11px] text-slate-500">{d.chapterName}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {d.subjectName}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {d.fileFormat} · {formatFileSize(d.fileSizeBytes)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-medium ${
                                d.status === 'published'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {d.status === 'published' ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {d.downloadCount}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDoc(d);
                                  setEditDocTitle(d.title);
                                  setEditDocChapter(d.chapterName);
                                  setEditDocStatus(d.status || 'published');
                                }}
                                className="text-[#1D4ED8] dark:text-teal-400 font-medium hover:underline"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteDoc(d.id)}
                                className="text-red-600 dark:text-red-400 font-medium hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: QUIZZES */}
          {tab === 'quizzes' && canQuizzes && (
            <AdminQuizManager
              token={adminToken}
              admin={admin}
              onChanged={() => {
                void loadDashboardData();
                onRefreshPublicData();
              }}
            />
          )}

          {/* TAB: WEBSITE & ANNOUNCEMENTS */}
          {tab === 'website' && (
            <div className="space-y-6">
              {canAnnouncements && (
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
                    Student Announcements
                  </h2>
                  <form onSubmit={handleCreateAnnouncement} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Announcement headline..."
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        className="sm:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      />
                      <select
                        value={annType}
                        onChange={(e) => setAnnType(e.target.value as 'info' | 'exam' | 'update')}
                        className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      >
                        <option value="info">General Notice</option>
                        <option value="exam">Exam Update</option>
                        <option value="update">New Uploads</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      required
                      placeholder="Announcement details..."
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0D9488] text-white"
                    >
                      Publish Announcement
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                    {announcements.map((a) => (
                      <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {a.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {a.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAnnouncement(a.id)}
                          aria-label={`Delete announcement ${a.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isSuper && (
                <form
                  onSubmit={handleSaveWebsiteSettings}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
                    Homepage &amp; Contact Settings (Super Admin)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Hero Headline
                      </label>
                      <input
                        type="text"
                        value={siteForm.heroTitle}
                        onChange={(e) => setSiteForm({ ...siteForm, heroTitle: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Hero Subtitle
                      </label>
                      <input
                        type="text"
                        value={siteForm.heroSubtitle}
                        onChange={(e) =>
                          setSiteForm({ ...siteForm, heroSubtitle: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={siteForm.contactEmail}
                        onChange={(e) =>
                          setSiteForm({ ...siteForm, contactEmail: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        value={siteForm.contactPhone}
                        onChange={(e) =>
                          setSiteForm({ ...siteForm, contactPhone: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Welcome Section Copy
                    </label>
                    <textarea
                      rows={3}
                      value={siteForm.welcomeBody}
                      onChange={(e) => setSiteForm({ ...siteForm, welcomeBody: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
                  >
                    Save Website Settings
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB: VICE ADMIN MANAGEMENT (SUPER ADMIN ONLY) */}
          {tab === 'vice-admin' && isSuper && viceProfile && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    {viceProfile.avatarUrl && (
                      <img
                        src={viceProfile.avatarUrl}
                        alt={viceProfile.displayName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    )}
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {viceProfile.displayName}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Vice Admin · {viceProfile.email} · Status:{' '}
                        <strong
                          className={
                            viceProfile.isActive ? 'text-emerald-600' : 'text-red-600'
                          }
                        >
                          {viceProfile.isActive ? 'Active' : 'Deactivated'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleUpdateViceAdmin({ isActive: !viceProfile.isActive })
                    }
                    className={`px-4 py-2 text-xs font-semibold rounded-lg ${
                      viceProfile.isActive
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {viceProfile.isActive ? 'Deactivate Vice Admin' : 'Activate Vice Admin'}
                  </button>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Server-Enforced Vice Admin Permissions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PERMISSION_LABELS.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1120] cursor-pointer"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {item.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(viceProfile.permissions[item.key])}
                          onChange={(e) =>
                            void handleUpdateViceAdmin({
                              permissions: {
                                ...viceProfile.permissions,
                                [item.key]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-[#0D9488]"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    minLength={6}
                    value={viceNewPassword}
                    onChange={(e) => setViceNewPassword(e.target.value)}
                    placeholder="Reset Vice Admin password (min 6 chars)..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={viceNewPassword.length < 6}
                    onClick={() => void handleUpdateViceAdmin({ newPassword: viceNewPassword })}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white disabled:opacity-50"
                  >
                    Update Vice Admin Password
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                  Vice Admin Activity Review
                </h3>
                {viceActivities.length === 0 ? (
                  <p className="text-xs text-slate-500">No Vice Admin actions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viceActivities.map((act) => (
                      <div key={act.id} className="py-2.5 text-xs">
                        <p className="font-medium text-slate-900 dark:text-white">{act.details}</p>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {act.action} · {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: AUDIT & SECURITY (SUPER ADMIN ONLY) */}
          {tab === 'audit-security' && isSuper && (
            <div className="space-y-6">
              <form
                onSubmit={handleRotateSecurityCredentials}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0D9488]" />
                  <span>Rotate Admin Access Code &amp; Super Admin Password</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sensitive credential updates require re-verifying your current Super Admin
                  password.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="password"
                    required
                    placeholder="Current Super Admin password *"
                    value={currSuperPass}
                    onChange={(e) => setCurrSuperPass(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    placeholder="New shared access code (optional)"
                    value={newAccessCode}
                    onChange={(e) => setNewAccessCode(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    placeholder="New Super Admin password (optional)"
                    value={newSuperPass}
                    onChange={(e) => setNewSuperPass(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#0F2447] dark:bg-blue-600 text-white"
                >
                  Update Security Credentials
                </button>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                    Complete Audit Trail ({auditLogs.length})
                  </h3>
                  <div className="max-h-96 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="py-2.5 text-xs">
                        <p className="font-medium text-slate-900 dark:text-white">{log.details}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {log.adminName} ({log.adminRole}) · {log.action} ·{' '}
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                  <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
                    Student Contact Desk Inbox ({contactMessages.length})
                  </h3>
                  {contactMessages.length === 0 ? (
                    <p className="text-xs text-slate-500">No messages submitted yet.</p>
                  ) : (
                    <div className="max-h-96 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {contactMessages.map((m) => (
                        <div key={m.id} className="py-3 text-xs space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {m.subject}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400">{m.message}</p>
                          <p className="text-[11px] text-slate-500">
                            {m.name} ({m.email}) · {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADMIN PROFILE */}
          {tab === 'profile' && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                {admin.avatarUrl && (
                  <img
                    src={admin.avatarUrl}
                    alt={admin.displayName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-[#0D9488] dark:text-teal-400">
                    {isSuper ? 'Super Administrator' : 'Vice Administrator'}
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {admin.displayName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {admin.email} · Username: <span className="font-mono">{admin.username}</span> ·
                    Last login:{' '}
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Active now'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Your Recent Recorded Activities
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {myActivities.map((act) => (
                    <div key={act.id} className="py-2.5 text-xs">
                      <p className="font-medium text-slate-900 dark:text-white">{act.details}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {act.action} · {new Date(act.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
