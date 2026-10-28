// src/lib/store.ts — 统一数据层（R146 数据库化）
// 三端自动切换：DATABASE_URL → Postgres；VERCEL 无 DB → snapshot.json；其余 → SQLite
// 所有页面/API 只 import 本文件，不再直接 import db.ts / data.ts。
//
// 设计要点：
// - 读：cities / hospitals / reviews / provenance / views
// - 写：reviews（submit）、views（track）——Postgres/SQLite 直接落库，
//       snapshot 端（无 DB 无 KV）写操作抛可读错误，不静默丢。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export type StoreMode = 'postgres' | 'snapshot' | 'sqlite';

const HAS_PG_URL = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const IS_VERCEL = !!process.env.VERCEL;

export function storeMode(): StoreMode {
  if (HAS_PG_URL) return 'postgres';
  if (IS_VERCEL) return 'snapshot';
  return 'sqlite';
}

// ---------- 类型（与 SQLite/Postgres schema 对齐） ----------
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

export interface Provenance {
  id: number;
  city_slug: string;
  field: string;
  source_name: string | null;
  source_url: string | null;
  metric_basis: string | null;
  value_type: string;
  verified_at: string | null;
  maintainer: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- 连接池 ----------
const SNAPSHOT_PATH = join(process.cwd(), 'src', 'data', 'snapshot.json');

let _snap: {
  cities: City[];
  hospitals: Hospital[];
  reviews?: Review[];
} | null = null;

export function snapshot() {
  if (_snap) return _snap;
  if (!existsSync(SNAPSHOT_PATH)) throw new Error(`snapshot.json missing at ${SNAPSHOT_PATH}`);
  _snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
  return _snap!;
}

let _db: Database.Database | null = null;
export function sqlite(): Database.Database {
  if (!_db) {
    _db = new Database(join(process.cwd(), 'data', 'medtravelcn.db'));
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

let _pg: any = null;
export async function pg() {
  if (_pg) return _pg;
  const { Pool } = await import('pg');
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  _pg = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1|\.local/.test(url!) ? false : { rejectUnauthorized: false },
  });
  return _pg;
}

// ---------- cities ----------
export async function allCities(): Promise<City[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query('SELECT * FROM cities ORDER BY name');
    return rows as City[];
  }
  if (m === 'snapshot') return snapshot().cities;
  return sqlite().prepare('SELECT * FROM cities ORDER BY name').all() as City[];
}

export async function oneCity(slug: string): Promise<City | undefined> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query('SELECT * FROM cities WHERE slug = $1', [slug]);
    return rows[0] as City | undefined;
  }
  if (m === 'snapshot') return snapshot().cities.find(c => c.slug === slug);
  return sqlite().prepare('SELECT * FROM cities WHERE slug = ?').get(slug) as City | undefined;
}

// ---------- hospitals ----------
export async function hospitalsOf(citySlug: string): Promise<Hospital[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query(
      'SELECT * FROM hospitals WHERE city_slug = $1 ORDER BY sort_order, id',
      [citySlug]
    );
    return rows as Hospital[];
  }
  if (m === 'snapshot') {
    return snapshot()
      .hospitals.filter(h => h.city_slug === citySlug)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }
  return sqlite()
    .prepare('SELECT * FROM hospitals WHERE city_slug = ? ORDER BY sort_order, id')
    .all(citySlug) as Hospital[];
}

export async function hospitalCount(citySlug: string): Promise<number> {
  return (await hospitalsOf(citySlug)).length;
}

export async function allHospitals(): Promise<Hospital[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query('SELECT * FROM hospitals ORDER BY city_slug, sort_order, id');
    return rows as Hospital[];
  }
  if (m === 'snapshot') {
    return [...snapshot().hospitals].sort(
      (a, b) => a.city_slug.localeCompare(b.city_slug) || a.sort_order - b.sort_order
    );
  }
  return sqlite()
    .prepare('SELECT * FROM hospitals ORDER BY city_slug, sort_order')
    .all() as Hospital[];
}

export async function searchHospitals(q: string): Promise<Hospital[]> {
  const term = q.toLowerCase();
  const [hs, cs] = await Promise.all([allHospitals(), allCities()]);
  const cmap = new Map(cs.map(c => [c.slug, c]));
  return hs
    .filter(h =>
      [h.name, h.specialties, h.chinese_name, cmap.get(h.city_slug)?.name]
        .some(v => (v || '').toLowerCase().includes(term))
    )
    .slice(0, 30);
}

// ---------- reviews ----------
export async function approvedReviews(limit = 50, citySlug?: string): Promise<Review[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query(
      `SELECT * FROM reviews WHERE approved = TRUE ${citySlug ? 'AND city_slug = $2' : ''}
       ORDER BY created_at DESC LIMIT $1`,
      citySlug ? [limit, citySlug] : [limit]
    );
    return rows as Review[];
  }
  if (m === 'snapshot') {
    let list = (snapshot().reviews || []) as Review[];
    if (citySlug) list = list.filter(x => !x.city_slug || x.city_slug === citySlug);
    return list.slice(0, limit);
  }
  const stmt = citySlug
    ? sqlite().prepare(
        'SELECT * FROM reviews WHERE approved = 1 AND city_slug = ? ORDER BY created_at DESC LIMIT ?'
      )
    : sqlite().prepare(
        'SELECT * FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT ?'
      );
  return (citySlug ? stmt.all(citySlug, limit) : stmt.all(limit)) as Review[];
}

export interface NewReview {
  city_slug: string | null;
  hospital_name: string | null;
  rating: number;
  author: string;
  email: string | null;
  country: string | null;
  content: string;
}

export async function insertReview(review: NewReview): Promise<number> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query(
      `INSERT INTO reviews (city_slug, hospital_name, rating, author, email, country, content, approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7, TRUE) RETURNING id`,
      [review.city_slug, review.hospital_name, review.rating, review.author, review.email, review.country, review.content]
    );
    return Number(rows[0].id);
  }
  if (m === 'snapshot') {
    throw new Error('Reviews not writable in snapshot mode (no Postgres configured). Set DATABASE_URL to enable review submission.');
  }
  const stmt = sqlite().prepare(`
    INSERT INTO reviews (city_slug, hospital_name, rating, author, email, country, content, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const info = stmt.run(
    review.city_slug, review.hospital_name, review.rating,
    review.author, review.email, review.country, review.content
  );
  return Number(info.lastInsertRowid);
}

// ---------- provenance（R142 YMYL 溯源，对外展示「数据核实」） ----------
export async function provenanceOf(citySlug: string): Promise<Provenance[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query(
      'SELECT * FROM data_provenance WHERE city_slug = $1 ORDER BY field', [citySlug]
    );
    return rows as Provenance[];
  }
  if (m === 'snapshot') return [];
  return sqlite()
    .prepare('SELECT * FROM data_provenance WHERE city_slug = ? ORDER BY field')
    .all(citySlug) as Provenance[];
}

// ---------- views（PV 计数；snapshot 端内存兜底，不持久化） ----------
const _viewCounts: Record<string, number> = {};

export async function incrementView(page: string): Promise<number> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    await r.query(
      `INSERT INTO views (page, count) VALUES ($1, 1) ON CONFLICT (page) DO UPDATE SET count = views.count + 1 RETURNING count`,
      [page]
    );
    const { rows } = await r.query('SELECT count FROM views WHERE page = $1', [page]);
    return Number(rows[0]?.count ?? 0);
  }
  if (m === 'snapshot') {
    _viewCounts[page] = (_viewCounts[page] || 0) + 1;
    return _viewCounts[page];
  }
  const db = sqlite();
  db.prepare(
    'INSERT INTO views (page, count) VALUES (?, 1) ON CONFLICT(page) DO UPDATE SET count = count + 1'
  ).run(page);
  const row = db.prepare('SELECT count FROM views WHERE page = ?').get(page) as { count: number } | undefined;
  return row?.count ?? 0;
}

export async function viewsOf(page?: string): Promise<Record<string, number> | number> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    if (page) {
      const { rows } = await r.query('SELECT count FROM views WHERE page = $1', [page]);
      return Number(rows[0]?.count ?? 0);
    }
    const { rows } = await r.query('SELECT page, count FROM views ORDER BY count DESC');
    const out: Record<string, number> = {};
    for (const r2 of rows) out[r2.page] = Number(r2.count);
    return out;
  }
  if (m === 'snapshot') {
    if (page) return _viewCounts[page] || 0;
    return { ..._viewCounts };
  }
  if (page) {
    const row = sqlite().prepare('SELECT count FROM views WHERE page = ?').get(page) as { count: number } | undefined;
    return row?.count ?? 0;
  }
  const rows = sqlite().prepare('SELECT page, count FROM views ORDER BY count DESC').all() as { page: string; count: number }[];
  const out: Record<string, number> = {};
  rows.forEach(r => { out[r.page] = r.count; });
  return out;
}
