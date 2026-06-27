// scripts/init-db.mjs
// Initialize SQLite database with schema
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'medtravelcn.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS cities (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chinese_name TEXT,
    region TEXT,
    population TEXT,
    intro TEXT,
    meta_title TEXT,
    meta_description TEXT,
    avg_cost TEXT,
    wait_time TEXT,
    growth TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hospitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    chinese_name TEXT,
    specialties TEXT,
    address TEXT,
    phone TEXT,
    url TEXT,
    type TEXT DEFAULT 'hospital',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (city_slug) REFERENCES cities(slug) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city_slug);

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_slug TEXT,
    hospital_name TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    author TEXT NOT NULL,
    email TEXT,
    country TEXT,
    content TEXT NOT NULL,
    approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_city ON reviews(city_slug);
  CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved);

  CREATE TABLE IF NOT EXISTS views (
    page TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
`);

console.log('✅ Schema initialized at', DB_PATH);
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name).join(', '));

db.close();