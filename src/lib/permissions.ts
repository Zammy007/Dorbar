export type AdminRole = 'SUPER_ADMIN' | 'VICE_ADMIN';

export interface AdminPermissionSet {
  uploadDocuments: boolean;
  editDocuments: boolean;
  deleteDocuments: boolean;
  manageSubjects: boolean;
  manageQuizzes: boolean;
  publishDailyQuiz: boolean;
  manageAnnouncements: boolean;
  viewAnalytics: boolean;
}

export type AdminActionKey =
  | keyof AdminPermissionSet
  | 'manageViceAdmin'
  | 'manageSecuritySettings'
  | 'manageWebsiteSettings'
  | 'viewAuditLogs';

export const DEFAULT_SUPER_ADMIN_PERMISSIONS: AdminPermissionSet = {
  uploadDocuments: true,
  editDocuments: true,
  deleteDocuments: true,
  manageSubjects: true,
  manageQuizzes: true,
  publishDailyQuiz: true,
  manageAnnouncements: true,
  viewAnalytics: true,
};

export const DEFAULT_VICE_ADMIN_PERMISSIONS: AdminPermissionSet = {
  uploadDocuments: true,
  editDocuments: true,
  deleteDocuments: false,
  manageSubjects: false,
  manageQuizzes: true,
  publishDailyQuiz: false,
  manageAnnouncements: true,
  viewAnalytics: true,
};

const SUPER_ADMIN_ONLY_ACTIONS = new Set<AdminActionKey>([
  'manageViceAdmin',
  'manageSecuritySettings',
  'manageWebsiteSettings',
  'viewAuditLogs',
]);

export function canAdminPerform(
  actor: { role: AdminRole; isActive: boolean; permissions: AdminPermissionSet },
  action: AdminActionKey
): boolean {
  if (!actor.isActive) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  if (SUPER_ADMIN_ONLY_ACTIONS.has(action)) return false;
  return Boolean(actor.permissions[action as keyof AdminPermissionSet]);
}

export function sanitizeViceAdminPermissions(input: Partial<AdminPermissionSet>): AdminPermissionSet {
  return {
    uploadDocuments: Boolean(input.uploadDocuments),
    editDocuments: Boolean(input.editDocuments),
    deleteDocuments: Boolean(input.deleteDocuments),
    manageSubjects: Boolean(input.manageSubjects),
    manageQuizzes: Boolean(input.manageQuizzes),
    publishDailyQuiz: Boolean(input.publishDailyQuiz),
    manageAnnouncements: Boolean(input.manageAnnouncements),
    viewAnalytics: Boolean(input.viewAnalytics),
  };
}
