import crypto from 'node:crypto';

const EPHEMERAL_HMAC_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(plain, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function timingSafeStringCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}:darbar-ip`).digest('hex').slice(0, 24);
}

export function issueGateToken(ttlMs = 5 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${exp}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', EPHEMERAL_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifyGateToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp || !nonce || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', EPHEMERAL_HMAC_SECRET)
    .update(`${expStr}.${nonce}`)
    .digest('hex');
  return timingSafeStringCompare(sig, expectedSig);
}

export function issueSubjectUploadToken(ttlMs = 30 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `subject-upload.${exp}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', EPHEMERAL_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySubjectUploadToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [scope, expStr, nonce, sig] = parts;
  if (scope !== 'subject-upload') return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp || !nonce || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', EPHEMERAL_HMAC_SECRET)
    .update(`${scope}.${expStr}.${nonce}`)
    .digest('hex');
  return timingSafeStringCompare(sig, expectedSig);
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: { windowMs: number; maxAttempts: number }) {
  const buckets = new Map<string, RateBucket>();

  return function checkLimit(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (existing.count >= options.maxAttempts) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }
    existing.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  };
}
