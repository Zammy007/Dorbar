import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { adminProfiles, authSessions, users, type ViceAdminPermissions } from '../src/db/schema.ts';
import { adminAuth } from '../src/lib/firebase-admin.ts';
import { hashToken } from './crypto.ts';
import { type AdminActionKey, type AdminRole, canAdminPerform } from '../src/lib/permissions.ts';

export interface AuthenticatedStudent {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  studentClass: string;
  authProvider: string;
  avatarUrl: string | null;
}

export interface AuthenticatedAdmin {
  id: number;
  role: AdminRole;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  permissions: ViceAdminPermissions;
  lastLoginAt: Date | null;
}

export interface DarbarRequest extends Request {
  student?: AuthenticatedStudent;
  admin?: AuthenticatedAdmin;
}

async function resolveStudentFromToken(rawToken: string): Promise<AuthenticatedStudent | null> {
  // 1. Check Darbar DB session token first
  const tokenHash = hashToken(rawToken);
  const sessions = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        eq(authSessions.actorType, 'student'),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (sessions.length > 0) {
    const found = await db
      .select()
      .from(users)
      .where(eq(users.id, sessions[0].actorId))
      .limit(1);
    if (found.length > 0) {
      const u = found[0];
      return {
        id: u.id,
        uid: u.uid,
        email: u.email,
        fullName: u.fullName,
        studentClass: u.studentClass,
        authProvider: u.authProvider,
        avatarUrl: u.avatarUrl,
      };
    }
  }

  // 2. Fallback: verify Firebase Auth ID Token (Google Sign-In)
  if (rawToken.includes('.')) {
    try {
      const decoded = await adminAuth.verifyIdToken(rawToken);
      const email = decoded.email || `${decoded.uid}@student.darbar.edu`;
      const fullName = decoded.name || email.split('@')[0];
      const synced = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email,
          fullName,
          studentClass: 'Class 12',
          authProvider: 'google',
          avatarUrl: decoded.picture || null,
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            fullName,
            avatarUrl: decoded.picture || null,
            lastLoginAt: new Date(),
          },
        })
        .returning();

      const u = synced[0];
      return {
        id: u.id,
        uid: u.uid,
        email: u.email,
        fullName: u.fullName,
        studentClass: u.studentClass,
        authProvider: u.authProvider,
        avatarUrl: u.avatarUrl,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function optionalStudentAuth(
  req: DarbarRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const student = await resolveStudentFromToken(token);
        if (student) req.student = student;
      } catch (err) {
        console.error('Optional student auth check failed:', err);
      }
    }
  }
  next();
}

export async function requireStudentAuth(
  req: DarbarRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Student sign-in is required.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const student = await resolveStudentFromToken(token);
    if (!student) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
    req.student = student;
    next();
  } catch (err) {
    console.error('Student auth error:', err);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

export async function requireAdminAuth(
  req: DarbarRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Administrator authentication is required.' });
  }
  const token = authHeader.slice(7).trim();
  const tokenHash = hashToken(token);

  try {
    const sessions = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          eq(authSessions.actorType, 'admin'),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Admin session expired or invalid.' });
    }

    const profiles = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.id, sessions[0].actorId))
      .limit(1);

    if (profiles.length === 0 || !profiles[0].isActive) {
      return res.status(403).json({ error: 'This administrator account is currently deactivated.' });
    }

    const p = profiles[0];
    req.admin = {
      id: p.id,
      role: p.role as AdminRole,
      username: p.username,
      displayName: p.displayName,
      email: p.email,
      avatarUrl: p.avatarUrl,
      isActive: p.isActive,
      permissions: p.permissions,
      lastLoginAt: p.lastLoginAt,
    };
    next();
  } catch (err) {
    console.error('Admin auth verification failed:', err);
    return res.status(500).json({ error: 'Could not verify administrator session.' });
  }
}

export function requireAdminPermission(action: AdminActionKey) {
  return (req: DarbarRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Administrator authentication is required.' });
    }
    if (!canAdminPerform(req.admin, action)) {
      return res.status(403).json({
        error: `Permission denied: your role does not allow "${action}".`,
      });
    }
    next();
  };
}
