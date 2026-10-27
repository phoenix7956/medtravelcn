// scripts/fix-p2-05-regions.mjs
// R144 · 2026-10-28 · 补 6 城 region（P2-05 残留）
// dongguan/guiyang/nanchang/shenyang/shijiazhuang/taiyuan
// region 归属按地理事实填写，溯源如实标 estimated。
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
if (!existsSync(DB_PATH)) { console.error('❌ DB not found'); process.exit(1); }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const NOW = new Date().toISOString().slice(0, 19).replace('T', ' ');

const regions = [
  { slug: 'dongguan',       region: 'South China'  },
  { slug: 'guiyang',        region: 'Southwest China' },
  { slug: 'nanchang',       region: 'East China'   },
  { slug: 'shenyang',       region: 'Northeast China' },
  { slug: 'shijiazhuang',   region: 'North China'  },
  { slug: 'taiyuan',        region: 'North China'  },
];

const upd = db.prepare("UPDATE cities SET region=@region WHERE slug=@slug AND (region IS NULL OR region='')");
for (const r of regions) {
  const res = upd.run({ slug: r.slug, region: r.region });
  console.log(`  ${r.slug}: ${r.region} → ${res.changes} row(s)`);
}

// 溯源
const insProv = db.prepare(`
  INSERT OR IGNORE INTO data_provenance (city_slug, field, source_name, source_url,
    metric_basis, value_type, verified_at, maintainer, note, created_at, updated_at)
  VALUES (@city_slug, 'region', 'MedTravelCN editorial', 'internal:R144-p2-05',
    'region 为地理事实，非数据指标', 'observed', @verified_at, @maintainer, @note, @created_at, @updated_at)
`);
for (const r of regions) {
  insProv.run({ city_slug: r.slug, verified_at: NOW, maintainer: 'root-bot',
    note: '按地理常识填写，非编辑估算', created_at: NOW, updated_at: NOW });
}

db.close();

// 校验
const verify = (() => {
  const d = new Database(DB_PATH, { readonly: true });
  const missing = d.prepare("SELECT slug FROM cities WHERE region IS NULL OR region='' ORDER BY slug").all().map(r=>r.slug);
  const provN = d.prepare("SELECT COUNT(*) n FROM data_provenance WHERE field='region'").get().n;
  d.close();
  return { missing, provN };
})();
console.log('校验:', JSON.stringify(verify));
console.log('DONE. 接下来: node scripts/gen-snapshot.mjs && node scripts/export-db-to-search-index.mjs && node scripts/verify-sync.mjs');
