// src/lib/db.ts
// Storage layer:
// - Cities / hospitals / SQLite (static data, baked into build)
// - Reviews / views → Vercel KV (dynamic, serverless fs is readonly)
// - Dev mode (no KV env vars) → fall back to SQLite for both

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { kv } from '@vercel/kv';

// Use process.cwd() so dev (cwd=project root) and built chunks resolve
// to the same data/ directory regardless of chunk location.
const DB_PATH = join(process.cwd(), 'data', 'medtravelcn.db');

// Detect Vercel KV (production) vs SQLite fallback (local dev)
const USE_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let _db: Database.Database | null = null;

// Vercel serverless 无法使用 better-sqlite3（SqliteError / native ABI 不匹配），
// 生产环境改读 build 时生成的 src/data/snapshot.json；本地 dev 仍走 SQLite。
const IS_VERCEL = !!process.env.VERCEL;
const _viewCounts: Record<string, number> = {};
let _json: { cities: any[]; hospitals: any[] } | null = null;

function loadSnapshot(): { cities: any[]; hospitals: any[] } {
  if (_json) return _json;
  const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs');
  const candidates = [
    join(process.cwd(), 'src', 'data', 'snapshot.json'),
    join(process.cwd(), 'data', 'snapshot.json'),
    join(process.cwd(), '..', 'src', 'data', 'snapshot.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      _json = JSON.parse(readFileSync(p, 'utf-8'));
      return _json!;
    }
  }
  throw new Error(`snapshot.json not found. Tried: ${candidates.join(', ')}`);
}

export function getDB(): Database.Database {
  if (!_db) {
    if (IS_VERCEL) throw new Error('SQLite unavailable on Vercel; use snapshot accessors.');
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

// ---- 生产（Vercel）读快照；本地读 SQLite ----
function rows<T>(sql: string, args: any[] = []): T[] {
  if (IS_VERCEL) {
    const s = loadSnapshot();
    if (sql.includes('FROM cities')) {
      if (sql.includes('WHERE slug = ?')) {
        return [s.cities.find((c: any) => c.slug === args[0])].filter(Boolean) as T[];
      }
      if (sql.includes('COUNT')) {
        return [{ c: s.cities.length } as unknown as T];
      }
      return s.cities as T[];
    }
    if (sql.includes('FROM hospitals')) {
      let h = s.hospitals;
      if (sql.includes('city_slug = ?')) {
        const slug = args[0];
        if (sql.includes('COUNT')) return [{ c: h.filter((x: any) => x.city_slug === slug).length } as unknown as T];
        h = h.filter((x: any) => x.city_slug === slug);
        if (sql.includes('ORDER BY city_slug, sort_order')) {
          h = [...h].sort((a: any, b: any) => a.city_slug.localeCompare(b.city_slug) || a.sort_order - b.sort_order);
        } else {
          h = [...h].sort((a: any, b: any) => a.sort_order - b.sort_order || a.id - b.id);
        }
        return h as T[];
      }
      if (sql.includes('COUNT')) return [{ c: h.length } as unknown as T];
      if (sql.includes('LIKE')) {
        const q = String(args[0] || '').toLowerCase();
        const cities = new Map(s.cities.map((c: any) => [c.slug, c]));
        return h
          .filter((x: any) =>
            [x.name, x.specialties, x.chinese_name, cities.get(x.city_slug)?.name]
              .some((v) => (v || '').toLowerCase().includes(q))
          )
          .slice(0, 30) as T[];
      }
      return [...h].sort((a: any, b: any) =>
        a.city_slug.localeCompare(b.city_slug) || a.sort_order - b.sort_order
      ) as T[];
    }
    if (sql.includes('FROM reviews')) {
      if (sql.includes('approved = 1')) {
        const limit = (args[1] as number) || 50;
        const list = (args[0] && !Number.isNaN(args[0] as number)
          ? _json!.reviews || []
          : _json!.reviews || []).slice(0, limit);
        return list as T[];
      }
      return [] as T[];
    }
    if (sql.includes('FROM views')) {
      if (sql.includes('WHERE page = ?')) {
        return [{ count: _viewCounts[args[0]] || 0 } as unknown as T];
      }
      return Object.entries(_viewCounts).map(([page, count]) => ({ page, count })) as T[];
    }
    return [] as T[];
  }
  return getDB().prepare(sql).all(...args) as T[];
}

export function storageMode(): 'kv' | 'sqlite-readonly' | 'sqlite' {
  if (USE_KV) return 'kv';
  return IS_VERCEL ? 'sqlite-readonly' : 'sqlite';
}

export interface City {
  slug: string;
  name: string;
  chinese_name: string | null;
  region: string | null;
  population: string | null;
  intro: string | null;
  meta_title: string | null;
  meta_description: string | null;
  avg_cost: string | null;
  wait_time: string | null;
  growth: string | null;
  created_at: string;
}

export interface Hospital {
  id: number;
  city_slug: string;
  name: string;
  chinese_name: string | null;
  specialties: string | null;
  address: string | null;
  phone: string | null;
  url: string | null;
  type: string;
  sort_order: number;
  created_at: string;
  // 国际患者信息（2026-10-26 数据库化补齐；SQLite/Postgres 双端一致）
  jci_certified?: number | boolean;
  accepts_international?: number | boolean;
  english_departments?: string | null;
  booking_method?: string | null;
  visa_assist?: number | boolean;
  inpatient_standard?: string | null;
  payment_methods?: string | null;
  insurance_direct?: number | boolean;
  interpreter_on_site?: number | boolean;
  verified?: number | boolean;
  source_url?: string | null;
  updated_at?: string | null;
}

export interface Review {
  id: number;
  city_slug: string | null;
  hospital_name: string | null;
  rating: number;
  author: string;
  email: string | null;
  country: string | null;
  content: string;
  approved: number;
  created_at: string;
}

export function getAllCities(): City[] {
  return rows<City>("SELECT * FROM cities ORDER BY name");
}

export function getCity(slug: string): City | undefined {
  return rows<City>('SELECT * FROM cities WHERE slug = ?', [slug])[0];
}

export function getHospitalsByCity(citySlug: string): Hospital[] {
  return rows<Hospital>(
    'SELECT * FROM hospitals WHERE city_slug = ? ORDER BY sort_order, id',
    [citySlug]
  );
}

export function getHospitalCount(citySlug: string): number {
  return rows<{ c: number }>(
    'SELECT COUNT(*) as c FROM hospitals WHERE city_slug = ?',
    [citySlug]
  )[0].c;
}

export function getAllHospitals(): Hospital[] {
  return rows<Hospital>('SELECT * FROM hospitals ORDER BY city_slug, sort_order');
}

export function getApprovedReviews(limit = 50): Review[] {
  if (USE_KV) {
    // KV stores reviews as keys like "review:1234" with JSON value
    return getReviewsFromKV(limit);
  }
  if (IS_VERCEL) return [] as Review[];
  return rows<Review>(
    'SELECT * FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

export function getReviewsByCity(citySlug: string, limit = 20): Review[] {
  if (USE_KV) {
    return getReviewsFromKV(limit, citySlug);
  }
  if (IS_VERCEL) return [] as Review[];
  return rows<Review>(
    'SELECT * FROM reviews WHERE city_slug = ? AND approved = 1 ORDER BY created_at DESC LIMIT ?',
    [citySlug, limit]
  );
}

export function insertReview(review: Omit<Review, 'id' | 'created_at' | 'approved'>): number {
  if (USE_KV) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const fullReview: Review = {
      id,
      created_at: new Date().toISOString(),
      approved: 1,
      ...review,
    };
    // Use await in caller - kv.set is async
    // We need to wrap in async; here return a Promise<number> instead
    return kv
      .set(`review:${id}`, JSON.stringify(fullReview))
      .then(() => {
        // Also push id to a sorted set for fast listing
        return kv.zadd('reviews:all', { score: -id, member: String(id) });
      })
      .then(() => {
        if (review.city_slug) {
          return kv.zadd(`reviews:city:${review.city_slug}`, { score: -id, member: String(id) });
        }
        return 0;
      })
      .then(() => id) as unknown as number;
  }
  // Vercel 无 KV 时无法持久化评论，抛出可读错误
  if (IS_VERCEL) {
    throw new Error('Reviews unavailable in this environment (read-only storage).');
  }
  const stmt = getDB().prepare(`
    INSERT INTO reviews (city_slug, hospital_name, rating, author, email, country, content, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const info = stmt.run(
    review.city_slug || null,
    review.hospital_name || null,
    review.rating,
    review.author,
    review.email || null,
    review.country || null,
    review.content
  );
  return info.lastInsertRowid as number;
}

async function getReviewsFromKV(limit: number, citySlug?: string): Promise<Review[]> {
  const setKey = citySlug ? `reviews:city:${citySlug}` : 'reviews:all';
  const ids = (await kv.zrange(setKey, 0, limit - 1)) as string[];
  if (!ids || ids.length === 0) return [];
  const reviews = await Promise.all(
    ids.map(id => kv.get<string>(`review:${id}`).then(v => v ? JSON.parse(v) as Review : null))
  );
  return reviews.filter((r): r is Review => r !== null);
}

export function searchHospitals(query: string): Hospital[] {
  const q = `%${query.toLowerCase()}%`;
  return rows<Hospital>(
    `
      SELECT h.* FROM hospitals h
      LEFT JOIN cities c ON h.city_slug = c.slug
      WHERE LOWER(h.name) LIKE ?
         OR LOWER(h.specialties) LIKE ?
         OR LOWER(h.chinese_name) LIKE ?
         OR LOWER(c.name) LIKE ?
      ORDER BY c.name, h.sort_order
      LIMIT 30
    `,
    [q, q, q, q]
  );
}

export function incrementView(page: string): number | Promise<number> {
  if (USE_KV) {
    return kv.incr(`views:${page}`) as Promise<number>;
  }
  // Vercel：SQLite 只读，计数存内存
  if (IS_VERCEL) {
    _viewCounts[page] = (_viewCounts[page] || 0) + 1;
    return _viewCounts[page];
  }
  const stmt = getDB().prepare(`
    INSERT INTO views (page, count) VALUES (?, 1)
    ON CONFLICT(page) DO UPDATE SET count = count + 1
  `);
  stmt.run(page);
  const row = getDB().prepare('SELECT count FROM views WHERE page = ?').get(page) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getViews(page?: string): Record<string, number> | number | Promise<Record<string, number>> | Promise<number> {
  if (USE_KV) {
    if (page) {
      return kv.get<number>(`views:${page}`).then(v => v ?? 0) as Promise<number>;
    }
    return kv.keys('views:*').then(async (keys) => {
      const result: Record<string, number> = {};
      await Promise.all(
        (keys as string[]).map(async k => {
          const v = await kv.get<number>(k);
          result[k.replace(/^views:/, '')] = v ?? 0;
        })
      );
      return result;
    }) as Promise<Record<string, number>>;
  }
  if (page) {
    return rows<{ count: number }>('SELECT count FROM views WHERE page = ?', [page])[0]?.count ?? 0;
  }
  const rowsOut = rows<{ page: string; count: number }>('SELECT page, count FROM views');
  const result: Record<string, number> = {};
  rowsOut.forEach(r => { result[r.page] = r.count; });
  return result;
}
