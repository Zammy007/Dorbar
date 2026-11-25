import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAdminPerform,
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
  DEFAULT_VICE_ADMIN_PERMISSIONS,
} from './permissions';

test('Super Admin has all permissions when active and none when inactive', () => {
  assert.equal(
    canAdminPerform(
      { role: 'SUPER_ADMIN', isActive: true, permissions: DEFAULT_SUPER_ADMIN_PERMISSIONS },
      'manageSecuritySettings'
    ),
    true
  );
  assert.equal(
    canAdminPerform(
      { role: 'SUPER_ADMIN', isActive: false, permissions: DEFAULT_SUPER_ADMIN_PERMISSIONS },
      'uploadDocuments'
    ),
    false
  );
});

test('Vice Admin can never perform Super-Admin-only security or admin management actions', () => {
  const vice = {
    role: 'VICE_ADMIN' as const,
    isActive: true,
    permissions: {
      ...DEFAULT_VICE_ADMIN_PERMISSIONS,
      deleteDocuments: true,
      publishDailyQuiz: true,
    },
  };

  assert.equal(canAdminPerform(vice, 'uploadDocuments'), true);
  assert.equal(canAdminPerform(vice, 'deleteDocuments'), true);
  assert.equal(canAdminPerform(vice, 'manageSecuritySettings'), false);
  assert.equal(canAdminPerform(vice, 'manageViceAdmin'), false);
  assert.equal(canAdminPerform(vice, 'viewAuditLogs'), false);
});

test('Vice Admin respects granular permission toggles set by Super Admin', () => {
  const restrictedVice = {
    role: 'VICE_ADMIN' as const,
    isActive: true,
    permissions: {
      ...DEFAULT_VICE_ADMIN_PERMISSIONS,
      uploadDocuments: false,
      manageAnnouncements: false,
    },
  };

  assert.equal(canAdminPerform(restrictedVice, 'uploadDocuments'), false);
  assert.equal(canAdminPerform(restrictedVice, 'manageAnnouncements'), false);
  assert.equal(canAdminPerform(restrictedVice, 'manageQuizzes'), true);
});
