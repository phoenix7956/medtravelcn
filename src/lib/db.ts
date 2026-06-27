// src/lib/db.ts
// SQLite database helper - shared across all pages
import Database from 'better-sqlite3';
import { join } from 'node:path';

// Use process.cwd() so dev (cwd=project root) and built chunks resolve
// to the same data/ directory regardless of chunk location.
const DB_PATH = join(process.cwd(), 'data', 'medtravelcn.db');

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
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
  return getDB().prepare('SELECT * FROM cities ORDER BY name').all() as City[];
}

export function getCity(slug: string): City | undefined {
  return getDB().prepare('SELECT * FROM cities WHERE slug = ?').get(slug) as City | undefined;
}

export function getHospitalsByCity(citySlug: string): Hospital[] {
  return getDB()
    .prepare('SELECT * FROM hospitals WHERE city_slug = ? ORDER BY sort_order, id')
    .all(citySlug) as Hospital[];
}

export function getHospitalCount(citySlug: string): number {
  const row = getDB()
    .prepare('SELECT COUNT(*) as c FROM hospitals WHERE city_slug = ?')
    .get(citySlug) as { c: number };
  return row.c;
}

export function getAllHospitals(): Hospital[] {
  return getDB().prepare('SELECT * FROM hospitals ORDER BY city_slug, sort_order').all() as Hospital[];
}

export function getApprovedReviews(limit = 50): Review[] {
  return getDB()
    .prepare('SELECT * FROM reviews WHERE approved = 1 ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Review[];
}

export function getReviewsByCity(citySlug: string, limit = 20): Review[] {
  return getDB()
    .prepare('SELECT * FROM reviews WHERE city_slug = ? AND approved = 1 ORDER BY created_at DESC LIMIT ?')
    .all(citySlug, limit) as Review[];
}

export function insertReview(review: Omit<Review, 'id' | 'created_at' | 'approved'>): number {
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

export function searchHospitals(query: string): Hospital[] {
  const q = `%${query.toLowerCase()}%`;
  return getDB()
    .prepare(`
      SELECT h.* FROM hospitals h
      LEFT JOIN cities c ON h.city_slug = c.slug
      WHERE LOWER(h.name) LIKE ?
         OR LOWER(h.specialties) LIKE ?
         OR LOWER(h.chinese_name) LIKE ?
         OR LOWER(c.name) LIKE ?
      ORDER BY c.name, h.sort_order
      LIMIT 30
    `)
    .all(q, q, q, q) as Hospital[];
}

export function incrementView(page: string): number {
  const stmt = getDB().prepare(`
    INSERT INTO views (page, count) VALUES (?, 1)
    ON CONFLICT(page) DO UPDATE SET count = count + 1
  `);
  stmt.run(page);
  const row = getDB().prepare('SELECT count FROM views WHERE page = ?').get(page) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getViews(page?: string): Record<string, number> | number {
  if (page) {
    const row = getDB().prepare('SELECT count FROM views WHERE page = ?').get(page) as { count: number } | undefined;
    return row?.count ?? 0;
  }
  const rows = getDB().prepare('SELECT page, count FROM views').all() as { page: string; count: number }[];
  const result: Record<string, number> = {};
  rows.forEach(r => { result[r.page] = r.count; });
  return result;
}