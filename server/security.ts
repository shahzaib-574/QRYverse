import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InputError extends Error {}

export function makeId(): string {
  return randomUUID();
}

export function normalizeEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new InputError('A valid email address is required.');
  return email;
}

export function validatePassword(value: unknown): string {
  const password = String(value ?? '');
  if (password.length < 10 || password.length > 200) throw new InputError('Password must contain 10 to 200 characters.');
  return password;
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): { salt: string; hash: string } {
  return { salt, hash: scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex') };
}

export function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  try {
    const actual = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function slugify(value: unknown): string {
  const slug = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(slug)) throw new InputError('Slug must contain 3 to 64 letters, numbers, or hyphens.');
  if (new Set(['api', 'v1', 'health', 'admin', 'login', 'register', 'r']).has(slug)) throw new InputError('That slug is reserved.');
  return slug;
}

export function validateDestination(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (raw.length > 2048) throw new InputError('Destination is too long.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new InputError('A valid HTTPS destination is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new InputError('A credential-free HTTPS destination is required.');
  return url.toString();
}

export function cleanText(value: unknown, label: string, maxLength: number): string {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength) throw new InputError(`${label} must contain 1 to ${maxLength} characters.`);
  return text;
}
