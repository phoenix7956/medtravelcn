// src/lib/admin.ts — 后台鉴权（简单口令 + HMAC 会话）
// 用法：
//   ADMIN_PASSWORD 环境变量存明文口令（Vercel 环境变量）
//   ADMIN_SESSION_SECRET 存随机长串用于签 cookie
import { createHmac, timingSafeEqual } from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.ADMIN_SESSION_SECRET || PASSWORD;
const COOKIE = 'cmg_admin';
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

export function adminConfigured(): boolean {
  return !!PASSWORD;
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function makeToken(): string {
  const exp = Date.now() + TTL_MS;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token || !SECRET) return false;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expect = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
  if (!PASSWORD || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function readCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_MS / 1000}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
