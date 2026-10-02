// src/lib/store.ts — 可切数据层
// 现状：生产用 src/data/snapshot.json（静态），本地用 SQLite
// 目标：接 Postgres 后用数据库（增删改查即时生效，不必 rebuild）
//
// 判定顺序：DATABASE_URL 存在 → Postgres；VERCEL 且无 DB → snapshot；其余 → SQLite

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { City, Hospital } from './db';

export type StoreMode = 'postgres' | 'snapshot' | 'sqlite';

const HAS_PG_URL = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const IS_VERCEL = !!process.env.VERCEL;

export function storeMode(): StoreMode {
  if (HAS_PG_URL) return 'postgres';
  if (IS_VERCEL) return 'snapshot';
  return 'sqlite';
}

const SNAPSHOT = join(process.cwd(), 'src', 'data', 'snapshot.json');

let _snap: { cities: City[]; hospitals: Hospital[]; reviews?: any[] } | null = null;
export function snapshot() {
  if (_snap) return _snap;
  if (!existsSync(SNAPSHOT)) throw new Error(`snapshot.json missing at ${SNAPSHOT}`);
  _snap = JSON.parse(readFileSync(SNAPSHOT, 'utf-8'));
  return _snap!;
}

let _db: Database.Database | null = null;
export function sqlite(): Database.Database {
  if (!_db) {
    _db = new Database(join(process.cwd(), 'data', 'medtravelcn.db'));
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

let _pg: any = null;
export async function pg() {
  if (_pg) return _pg;
  const { Pool } = await import('pg');
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  _pg = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1|\.local/.test(url!) ? false : { rejectUnauthorized: false } });
  return _pg;
}

// ---------- 统一读接口 ----------
export async function allCities(): Promise<City[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query('SELECT * FROM cities ORDER BY name');
    return rows;
  }
  if (m === 'snapshot') return snapshot().cities;
  return sqlite().prepare('SELECT * FROM cities ORDER BY name').all() as City[];
}

export async function oneCity(slug: string): Promise<City | undefined> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query('SELECT * FROM cities WHERE slug = $1', [slug]);
    return rows[0];
  }
  if (m === 'snapshot') return snapshot().cities.find(c => c.slug === slug);
  return sqlite().prepare('SELECT * FROM cities WHERE slug = ?').get(slug) as City | undefined;
}

export async function hospitalsOf(citySlug: string): Promise<Hospital[]> {
  const m = storeMode();
  if (m === 'postgres') {
    const r = await pg();
    const { rows } = await r.query(
      'SELECT * FROM hospitals WHERE city_slug = $1 ORDER BY sort_order, id',
      [citySlug]
    );
    return rows;
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
    return rows;
  }
  if (m === 'snapshot') {
    return [...snapshot().hospitals].sort(
      (a, b) => a.city_slug.localeCompare(b.city_slug) || a.sort_order - b.sort_order
    );
  }
  return sqlite().prepare('SELECT * FROM hospitals ORDER BY city_slug, sort_order').all() as Hospital[];
}

export async function searchHospitals(q: string): Promise<Hospital[]> {
  const term = q.toLowerCase();
  const hs = await allHospitals();
  const cs = await allCities();
  const cmap = new Map(cs.map(c => [c.slug, c]));
  return hs
    .filter(h =>
      [h.name, h.specialties, h.chinese_name, cmap.get(h.city_slug)?.name]
        .some(v => (v || '').toLowerCase().includes(term))
    )
    .slice(0, 30);
}
