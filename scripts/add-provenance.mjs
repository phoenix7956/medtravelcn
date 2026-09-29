// scripts/add-provenance.mjs
// R142 数据治理：为 cities 表补「五段式来源溯源」能力
// 背景：avg_cost / wait_time / growth 三个字段无出处，等同对海外患者做医疗广告承诺。
// 方案：不 ALTER 既有表（migrate.mjs / export-db-to-search-index.mjs 都用显式列名，
//       加列虽兼容但会污染导出结构），改为独立溯源表，按 city_slug + field 三键挂载。
// 幂等：CREATE TABLE IF NOT EXISTS + INSERT OR REPLACE，重复执行安全。
//
// Run: node scripts/add-provenance.mjs

import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'medtravelcn.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS data_provenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_slug TEXT NOT NULL,
    field TEXT NOT NULL,
    source_name TEXT,
    source_url TEXT,
    metric_basis TEXT,
    value_type TEXT NOT NULL DEFAULT 'unverified'
      CHECK (value_type IN ('observed', 'estimated', 'unverified')),
    verified_at TEXT,
    maintainer TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE (city_slug, field),
    FOREIGN KEY (city_slug) REFERENCES cities(slug) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_provenance_city ON data_provenance(city_slug);
  CREATE INDEX IF NOT EXISTS idx_provenance_status ON data_provenance(value_type);
`);

const TRACKED_FIELDS = ['avg_cost', 'wait_time', 'growth'];
const MAINTAINER = 'xieguanzhi';

// 存量 31 城全部标 unverified：来源未核验前不得对外承诺，也不得扩散到新城市。
const cities = db.prepare('SELECT slug FROM cities').all();
const upsert = db.prepare(`
  INSERT OR IGNORE INTO data_provenance
    (city_slug, field, value_type, maintainer, note)
  VALUES
    (@city_slug, @field, 'unverified', @maintainer, @note)
`);

const tx = db.transaction(() => {
  let n = 0;
  for (const c of cities) {
    for (const f of TRACKED_FIELDS) {
      upsert.run({
        city_slug: c.slug,
        field: f,
        maintainer: MAINTAINER,
        note: 'R142 建表时存量数据来源未知，待核验；核验前 UI 应按 estimated/unverified 呈现',
      });
      n++;
    }
  }
  return n;
});

const inserted = tx();

const total = db.prepare('SELECT COUNT(*) n FROM data_provenance').get().n;
const byType = db.prepare(
  'SELECT value_type, COUNT(*) n FROM data_provenance GROUP BY value_type'
).all();

db.close();

console.log(`✅ data_provenance 表就绪：新建 ${inserted} 条溯源记录（${cities.length} 城 × ${TRACKED_FIELDS.length} 字段）`);
console.log(`   表内总计：${total} 条`);
console.log('   分布：' + byType.map(r => `${r.value_type}=${r.n}`).join('  '));
console.log('   口径：observed=可追溯公开统计 | estimated=估算 | unverified=未核验');
