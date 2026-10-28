// scripts/sync-sqlite-to-postgres.mjs
// R146 数据库化：把 SQLite 是源头的两张表推送到 Postgres：
//   data_provenance（snapshot 不携带）+ hospital_meta（资质补录）
// 用法：DATABASE_URL='postgresql://...' node scripts/sync-sqlite-to-postgres.mjs
// 幂等：provenance 按 (city_slug, field) upsert；hospital_meta 按 hospital_id upsert。
// 前提：先跑过 scripts/init-postgres.mjs（建表 + 灌 cities/hospitals/reviews）。
import { Client } from 'pg';
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('❌ 需要 DATABASE_URL');
  process.exit(1);
}

const localDbPath = join(ROOT, 'data', 'medtravelcn.db');
if (!existsSync(localDbPath)) {
  console.error('❌ 本地 SQLite 不存在：', localDbPath);
  process.exit(1);
}

const local = new Database(localDbPath, { readonly: true });

// 先取数（Node 24 + better-sqlite3 cleanup-hook 崩溃规避：取完立即 close）
let provRows, metaRows;
try {
  provRows = local.prepare('SELECT * FROM data_provenance').all();
  const hasMeta = local.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='hospital_meta'`).get();
  metaRows = hasMeta ? local.prepare('SELECT * FROM hospital_meta').all() : [];
} finally {
  local.close();
}

const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1|\.local/.test(url) ? false : { rejectUnauthorized: false } });
await c.connect();

// data_provenance upsert
const upsertProv = 'INSERT INTO data_provenance (city_slug, field, source_name, source_url, metric_basis, value_type, verified_at, maintainer, note, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (city_slug, field) DO UPDATE SET source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url, metric_basis=EXCLUDED.metric_basis, value_type=EXCLUDED.value_type, verified_at=EXCLUDED.verified_at, maintainer=EXCLUDED.maintainer, note=EXCLUDED.note, updated_at=EXCLUDED.updated_at';

let provN = 0;
for (const p of provRows) {
  await c.query(upsertProv, [
    p.city_slug, p.field, p.source_name, p.source_url, p.metric_basis, p.value_type,
    p.verified_at, p.maintainer, p.note, p.created_at, p.updated_at,
  ]);
  provN++;
}
console.log(`✅ data_provenance: ${provN} 条 upsert`);

// hospital_meta upsert（仅当 PG 端 hospitals.id 与 SQLite id 对齐时安全）
let metaN = 0;
for (const m of metaRows) {
  await c.query(
    `INSERT INTO hospital_meta (hospital_id, foreign_access, cert_level, cert_source, cert_year, insurance_direct, emergency_24h, international_dept, source_url, verified_at, maintainer, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (hospital_id) DO UPDATE SET
       foreign_access=EXCLUDED.foreign_access, cert_level=EXCLUDED.cert_level,
       cert_source=EXCLUDED.cert_source, cert_year=EXCLUDED.cert_year,
       insurance_direct=EXCLUDED.insurance_direct, emergency_24h=EXCLUDED.emergency_24h,
       international_dept=EXCLUDED.international_dept, source_url=EXCLUDED.source_url,
       verified_at=EXCLUDED.verified_at, maintainer=EXCLUDED.maintainer, note=EXCLUDED.note`,
    [m.hospital_id, m.foreign_access, m.cert_level, m.cert_source, m.cert_year,
     m.insurance_direct, m.emergency_24h, m.international_dept, m.source_url,
     m.verified_at, m.maintainer, m.note]
  );
  metaN++;
}
console.log(`✅ hospital_meta: ${metaN} 条 upsert`);

// 校验
const { rows: pN } = await c.query('SELECT COUNT(*)::int n FROM data_provenance');
const { rows: mN } = await c.query('SELECT COUNT(*)::int n FROM hospital_meta');
console.log(`📊 PG 现状: provenance=${pN[0].n} · hospital_meta=${mN[0].n}`);

await c.end();
console.log('DONE.');
