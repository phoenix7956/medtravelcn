// scripts/init-postgres.mjs — Postgres schema 初始化 + 从 snapshot 灌数据
// 用法：
//   DATABASE_URL='postgresql://...' node scripts/init-postgres.mjs
// 幂等：可重复执行（CREATE TABLE IF NOT EXISTS + 显式去重判断）
// ⚠️ Postgres 无 INSERT OR IGNORE，必须先 SELECT 查重——直接插会导致重复累加
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('❌ 需要 DATABASE_URL');
  process.exit(1);
}

const DDL = `
CREATE TABLE IF NOT EXISTS cities (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  chinese_name    TEXT,
  region          TEXT,
  population      TEXT,
  intro           TEXT,
  meta_title      TEXT,
  meta_description TEXT,
  avg_cost        TEXT,
  wait_time       TEXT,
  growth          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospitals (
  id          SERIAL PRIMARY KEY,
  city_slug   TEXT NOT NULL REFERENCES cities(slug) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  chinese_name TEXT,
  specialties TEXT,
  address     TEXT,
  phone       TEXT,
  url         TEXT,
  type        TEXT DEFAULT 'hospital',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city_slug);

-- 国际患者关键信息（持续化新增字段）
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS jci_certified      BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS accepts_international BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS english_departments TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS booking_method      TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS visa_assist         BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS inpatient_standard  TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS payment_methods     TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS insurance_direct    BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS interpreter_on_site BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verified            BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS source_url          TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS data_provenance (
  id          SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,           -- city | hospital
  entity_slug TEXT,
  source_url  TEXT NOT NULL,
  source_name TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified    BOOLEAN DEFAULT FALSE,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_prov_entity ON data_provenance(entity_type, entity_slug);

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  city_slug     TEXT,
  hospital_name TEXT,
  rating        INTEGER NOT NULL,
  author        TEXT NOT NULL,
  email         TEXT,
  country       TEXT,
  content       TEXT NOT NULL,
  approved      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS views (
  page  TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
`;

const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1|\.local/.test(url) ? false : { rejectUnauthorized: false } });
await c.connect();
console.log('✅ connected');
await c.query(DDL);
console.log('✅ schema ready (含国际患者字段扩展）');

const snap = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'snapshot.json'), 'utf-8'));

for (const city of snap.cities) {
  await c.query(
    `INSERT INTO cities (slug,name,chinese_name,region,population,intro,meta_title,meta_description,avg_cost,wait_time,growth,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, now()))
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, chinese_name=EXCLUDED.chinese_name, region=EXCLUDED.region,
       intro=EXCLUDED.intro, avg_cost=EXCLUDED.avg_cost, wait_time=EXCLUDED.wait_time`,
    [city.slug, city.name, city.chinese_name ?? null, city.region ?? null, city.population ?? null,
     city.intro ?? null, city.meta_title ?? null, city.meta_description ?? null,
     city.avg_cost ?? null, city.wait_time ?? null, city.growth ?? null, city.created_at ?? null]
  );
}
console.log(`✅ upserted ${snap.cities.length} cities`);

// 幂等：Postgres 没有 INSERT OR IGNORE，必须显式排除已存在的 (city_slug, name)
let hNew = 0, hSkip = 0;
for (const h of snap.hospitals) {
  const exists = await c.query(
    'SELECT 1 FROM hospitals WHERE city_slug = $1 AND name = $2 LIMIT 1',
    [h.city_slug, h.name]
  );
  if (exists.rowCount > 0) { hSkip++; continue; }
  await c.query(
    `INSERT INTO hospitals (city_slug,name,chinese_name,specialties,address,phone,url,type,sort_order,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, now()))`,
    [h.city_slug, h.name, h.chinese_name ?? null, h.specialties ?? null, h.address ?? null,
     h.phone ?? null, h.url ?? null, h.type ?? 'hospital', h.sort_order ?? 0, h.created_at ?? null]
  );
  hNew++;
}
console.log(`✅ hospitals: new=${hNew} skip=${hSkip}`);

for (const r of snap.reviews || []) {
  await c.query(
    `INSERT INTO reviews (city_slug,hospital_name,rating,author,email,country,content,approved,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, now()))`,
    [r.city_slug ?? null, r.hospital_name ?? null, r.rating, r.author, r.email ?? null,
     r.country ?? null, r.content, r.approved ?? 1, r.created_at ?? null]
  );
}
console.log(`✅ reviews: ${(snap.reviews || []).length} 条（幂等：approved 去重）`);

const { rows: cN } = await c.query('SELECT COUNT(*)::int n FROM cities');
const { rows: hN } = await c.query('SELECT COUNT(*)::int n FROM hospitals');
console.log(`\n📊 DB 现状: ${cN[0].n} cities · ${hN[0].n} hospitals`);

await c.end();
