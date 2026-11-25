import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Lock, Shield, UserCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { AdminProfileData, AppRoute } from '../types/darbar';
import type { AdminRole } from '../lib/permissions';

interface GateProfileOption {
  role: AdminRole;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export function AdminLoginPage({
  onNavigate,
}: {
  onNavigate: (route: AppRoute) => void;
}) {
  const { admin, setAdminSession } = useAuth();

  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [envGateActive, setEnvGateActive] = useState(false);

  // First-run setup form
  const [setupAccessCode, setSetupAccessCode] = useState('');
  const [setupSuperPass, setSetupSuperPass] = useState('');
  const [setupVicePass, setSetupVicePass] = useState('');

  // Standard 2-step login flow
  const [step, setStep] = useState<'gate' | 'profile'>('gate');
  const [accessCode, setAccessCode] = useState('');
  const [gateToken, setGateToken] = useState('');
  const [profiles, setProfiles] = useState<GateProfileOption[]>([]);
  const [selectedRole, setSelectedRole] = useState<AdminRole>('SUPER_ADMIN');
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      onNavigate('admin-dashboard');
      return;
    }
    apiRequest<{ needsSetup: boolean; envGateActive: boolean }>('/api/admin/auth/status')
      .then((res) => {
        setNeedsSetup(res.needsSetup);
        setEnvGateActive(res.envGateActive);
      })
      .catch((err: any) => setError(err?.message || 'Could not reach admin authentication service.'))
      .finally(() => setChecking(false));
  }, [admin, onNavigate]);

  const handleFirstRunSetup = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/auth/setup', {
        method: 'POST',
        body: {
          accessCode: setupAccessCode,
          superAdminPassword: setupSuperPass,
          viceAdminPassword: setupVicePass,
        },
      });
      setNeedsSetup(false);
      setNotice(res.message);
      setSetupAccessCode('');
      setSetupSuperPass('');
      setSetupVicePass('');
    } catch (err: any) {
      setError(err?.message || 'Setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyGate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ gateToken: string; profiles: GateProfileOption[] }>(
        '/api/admin/auth/verify-gate',
        { method: 'POST', body: { accessCode } }
      );
      setGateToken(res.gateToken);
      setProfiles(res.profiles);
      setSelectedRole('SUPER_ADMIN');
      setAccessCode('');
      setStep('profile');
    } catch (err: any) {
      setError(err?.message || 'Access code verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ token: string; admin: AdminProfileData }>(
        '/api/admin/auth/login',
        {
          method: 'POST',
          body: {
            gateToken,
            role: selectedRole,
            password,
          },
        }
      );
      setAdminSession(res.admin, res.token);
      onNavigate('admin-dashboard');
    } catch (err: any) {
      setError(err?.message || 'Administrator authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="h-64 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#0F2447] dark:bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2447] dark:text-white">
              দরবার Administrator Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {needsSetup
                ? 'One-time security claim: configure the hashed access code and distinct personal passwords for Super Admin and Vice Admin.'
                : step === 'gate'
                  ? 'Step 1 of 2: Enter the server-verified administrator access code.'
                  : 'Step 2 of 2: Select your administrator profile and verify your personal password.'}
            </p>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3.5 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* FIRST-RUN SECURE SETUP */}
        {needsSetup ? (
          <form onSubmit={handleFirstRunSetup} className="space-y-4">
            {!envGateActive && (
              <div>
                <label
                  htmlFor="setup-access-code"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Initial Shared Admin Access Code
                </label>
                <input
                  id="setup-access-code"
                  type="password"
                  required
                  minLength={4}
                  value={setupAccessCode}
                  onChange={(e) => setSetupAccessCode(e.target.value)}
                  placeholder="Enter your chosen access code"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="setup-super-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Super Admin Personal Password (Dr. Subhajit Chatterjee)
              </label>
              <input
                id="setup-super-password"
                type="password"
                required
                minLength={6}
                value={setupSuperPass}
                onChange={(e) => setSetupSuperPass(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="setup-vice-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Vice Admin Personal Password (Ananya Mukherjee)
              </label>
              <input
                id="setup-vice-password"
                type="password"
                required
                minLength={6}
                value={setupVicePass}
                onChange={(e) => setSetupVicePass(e.target.value)}
                placeholder="Must differ from Super Admin password"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#0F2447] dark:bg-blue-600 hover:bg-[#193666] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? 'Securing Credentials...' : 'Initialize Administrator Credentials'}
            </button>
          </form>
        ) : step === 'gate' ? (
          /* STEP 1: SHARED ACCESS CODE VERIFICATION */
          <form onSubmit={handleVerifyGate} className="space-y-4">
            <div>
              <label
                htmlFor="admin-access-code"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Admin Access Code
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="admin-access-code"
                  type="password"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter administrator access code"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#0F2447] dark:bg-blue-600 hover:bg-[#193666] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? 'Verifying Code...' : 'Continue to Profile Selection'}
            </button>
          </form>
        ) : (
          /* STEP 2: PROFILE SELECTION + SEPARATE PERSONAL PASSWORD */
          <form onSubmit={handleRoleLogin} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Select administrator profile">
              {profiles.map((p) => {
                const active = selectedRole === p.role;
                return (
                  <button
                    key={p.role}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!p.isActive}
                    onClick={() => setSelectedRole(p.role)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      active
                        ? 'border-[#1D4ED8] dark:border-teal-400 bg-blue-50/70 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    } ${!p.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                          <UserCheck className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1D4ED8] dark:text-teal-400">
                          {p.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Vice Admin'}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {p.displayName}
                        </p>
                      </div>
                    </div>
                    {!p.isActive && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">
                        Account deactivated
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="admin-role-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Personal Password for{' '}
                {selectedRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Vice Admin'}
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="admin-role-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your individual admin password"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('gate');
                  setPassword('');
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#0F2447] dark:bg-blue-600 hover:bg-[#193666] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting
                  ? 'Signing In...'
                  : `Sign In as ${selectedRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Vice Admin'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
