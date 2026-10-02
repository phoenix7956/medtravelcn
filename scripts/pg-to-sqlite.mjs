#!/usr/bin/env node
// Postgres → SQLite 回写 + 重建 snapshot
// 用法: DATABASE_URL=... node scripts/pg-to-sqlite.mjs
import { Client } from 'pg';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error('✗ 需要 DATABASE_URL'); process.exit(1); }

const client = new Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1|\.local/.test(url) ? false : { rejectUnauthorized: false },
});
await client.connect();
console.log('✓ PG 已连接');

// SQLite 侧建 meta 表
const db = new Database(join(ROOT, 'data', 'medtravelcn.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS hospital_meta (
    hospital_id        INTEGER PRIMARY KEY,
    foreign_access     TEXT,
    cert_level         TEXT,
    cert_source        TEXT,
    cert_year          INTEGER,
    insurance_direct   TEXT,
    emergency_24h      TEXT,
    international_dept TEXT,
    source_url         TEXT,
    verified_at        TEXT,
    maintainer         TEXT,
    note               TEXT
  );
`);

// 1) 拉 PG 的医院，按 chinese_name 对齐 SQLite（SQLite 是 id 主键）
const pgHosp = (await client.query('SELECT * FROM hospitals ORDER BY id')).rows;
const meta = (await client.query('SELECT * FROM hospital_meta')).rows;
const metaByCn = new Map();
for (const m of meta) {
  const h = pgHosp.find(x => x.id === m.hospital_id);
  if (h && h.chinese_name) metaByCn.set(h.chinese_name, m);
}

const insH = db.prepare(`
  INSERT OR IGNORE INTO hospitals
    (city_slug, name, chinese_name, specialties, type, sort_order, created_at)
  VALUES (?,?,?,?,?,?,COALESCE(?, datetime('now')))
`);
const insM = db.prepare(`
  INSERT OR REPLACE INTO hospital_meta
    (hospital_id, foreign_access, cert_level, cert_source, cert_year,
     insurance_direct, emergency_24h, international_dept, source_url, verified_at, maintainer, note)
  VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')),?,?)
`);

let added = 0, metaAdded = 0;
for (const h of pgHosp) {
  if (!h.chinese_name) continue;
  const exists = db.prepare('SELECT 1 FROM hospitals WHERE chinese_name=? LIMIT 1').get(h.chinese_name);
  if (!exists) {
    insH.run(h.city_slug, h.name, h.chinese_name, h.specialties ?? null,
             h.type ?? 'hospital', Number(h.sort_order ?? 999),
             h.created_at ? String(h.created_at).slice(0,19).replace('T',' ') : null);
    added++;
  }
  const m = metaByCn.get(h.chinese_name);
  if (m) {
    const local = db.prepare('SELECT id FROM hospitals WHERE chinese_name=?').get(h.chinese_name);
    if (local) {
      insM.run(local.id, m.foreign_access, m.cert_level, m.cert_source, m.cert_year,
               m.insurance_direct, m.emergency_24h, m.international_dept,
               m.source_url, m.verified_at ? String(m.verified_at).slice(0,19).replace('T',' ') : null,
               m.maintainer, m.note);
      metaAdded++;
    }
  }
}

const stats = {
  cities: db.prepare('SELECT COUNT(*) n FROM cities').get().n,
  hospitals: db.prepare('SELECT COUNT(*) n FROM hospitals').get().n,
  meta: db.prepare('SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access IS NOT NULL').get().n,
};
const cert = db.prepare("SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access='certified'").get().n;

console.log(`\n  新增医院到 SQLite  ${added}`);
console.log(`  同步资质 meta      ${metaAdded}`);
console.log(`\n  SQLite 现状: ${stats.cities} 城 / ${stats.hospitals} 医院 / ${stats.meta} 已补录`);
console.log(`  其中 certified: ${cert}\n`);

db.close();
await client.end();
process.exit(0);
