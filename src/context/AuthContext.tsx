import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiRequest } from '../lib/api';
import type { AdminProfileData, StudentProfile } from '../types/darbar';

interface AuthContextValue {
  student: StudentProfile | null;
  studentToken: string | null;
  admin: AdminProfileData | null;
  adminToken: string | null;
  savedDocIds: Set<number>;
  setStudentSession: (student: StudentProfile, token: string) => void;
  setAdminSession: (admin: AdminProfileData, token: string) => void;
  signInWithGoogle: () => Promise<void>;
  logoutStudent: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  toggleBookmark: (docId: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminProfileData | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [savedDocIds, setSavedDocIds] = useState<Set<number>>(new Set());

  const refreshBookmarksWithToken = useCallback(async (token: string) => {
    try {
      const data = await apiRequest<{ savedDocuments: Array<{ id: number }> }>(
        '/api/student/dashboard',
        { token }
      );
      setSavedDocIds(new Set(data.savedDocuments.map((d) => d.id)));
    } catch {
      // ignore if session expired
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await apiRequest<{ student: StudentProfile }>('/api/student/firebase-sync', {
          method: 'POST',
          token: idToken,
        });
        setStudent(res.student);
        setStudentToken(idToken);
        await refreshBookmarksWithToken(idToken);
      } catch (err) {
        console.error('Firebase student sync skipped:', err);
      }
    });
    return () => unsubscribe();
  }, [refreshBookmarksWithToken]);

  const setStudentSession = useCallback(
    (profile: StudentProfile, token: string) => {
      setStudent(profile);
      setStudentToken(token);
      void refreshBookmarksWithToken(token);
    },
    [refreshBookmarksWithToken]
  );

  const setAdminSession = useCallback((profile: AdminProfileData, token: string) => {
    setAdmin(profile);
    setAdminToken(token);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const res = await apiRequest<{ student: StudentProfile }>('/api/student/firebase-sync', {
      method: 'POST',
      token: idToken,
    });
    setStudent(res.student);
    setStudentToken(idToken);
    await refreshBookmarksWithToken(idToken);
  }, [refreshBookmarksWithToken]);

  const logoutStudent = useCallback(async () => {
    const token = studentToken;
    setStudent(null);
    setStudentToken(null);
    setSavedDocIds(new Set());
    if (token) {
      try {
        await apiRequest('/api/student/logout', { method: 'POST', token });
      } catch {
        // ignore
      }
    }
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // ignore
    }
  }, [studentToken]);

  const logoutAdmin = useCallback(async () => {
    const token = adminToken;
    setAdmin(null);
    setAdminToken(null);
    if (token) {
      try {
        await apiRequest('/api/admin/auth/logout', { method: 'POST', token });
      } catch {
        // ignore
      }
    }
  }, [adminToken]);

  const refreshBookmarks = useCallback(async () => {
    if (!studentToken) return;
    await refreshBookmarksWithToken(studentToken);
  }, [studentToken, refreshBookmarksWithToken]);

  const toggleBookmark = useCallback(
    async (docId: number): Promise<boolean> => {
      if (!studentToken) return false;
      const alreadySaved = savedDocIds.has(docId);
      if (alreadySaved) {
        await apiRequest(`/api/student/bookmarks/${docId}`, {
          method: 'DELETE',
          token: studentToken,
        });
        setSavedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        return false;
      } else {
        await apiRequest(`/api/student/bookmarks/${docId}`, {
          method: 'POST',
          token: studentToken,
        });
        setSavedDocIds((prev) => new Set(prev).add(docId));
        return true;
      }
    },
    [studentToken, savedDocIds]
  );

  return (
    <AuthContext.Provider
      value={{
        student,
        studentToken,
        admin,
        adminToken,
        savedDocIds,
        setStudentSession,
        setAdminSession,
        signInWithGoogle,
        logoutStudent,
        logoutAdmin,
        refreshBookmarks,
        toggleBookmark,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
