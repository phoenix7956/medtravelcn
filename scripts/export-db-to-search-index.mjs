// scripts/export-db-to-search-index.mjs
// Export medtravelcn.db -> search_index.json (searchIndex format expected by migrate.mjs)
// 让 Vercel build 拿到 25 cities / 100 hospitals 真值（不是 search_index.json 老数据）
//
// Run: node scripts/export-db-to-search-index.mjs
import Database from 'better-sqlite3';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
const OUT = join(ROOT, 'search_index.json');

if (!existsSync(DB_PATH)) {
  console.error('❌ DB not found at', DB_PATH);
  process.exit(1);
}

// Load old search_index.json as fallback (some fields migrate.mjs expects: cityName / city / hospitals structure)
const oldData = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];

// Helper: old entry lookup by slug
const oldByCity = new Map();
for (const c of oldData) oldByCity.set(c.city, c);

const db = new Database(DB_PATH, { readonly: true });

const cityRows = db.prepare(`
  SELECT slug, name, chinese_name, region, intro, avg_cost, wait_time, growth
  FROM cities
  ORDER BY slug
`).all();

// 数据库化(2026-10-26)：12 个国际患者字段直接从 DB 导出。
// 列探测：老库若尚未跑 scripts/init-sqlite-intl.mjs，缺列时自动降级（不挂导出链）。
// 注意：better-sqlite3 的 prepared statement 在 .all() 之后被 GC 析构时会触发
// 本机 Node 24 与 native 模块的 cleanup-hook 断言崩溃，故按列探测结果直接
// 拼 SQL、一次 .all()，不再保留额外的 prepared statement。
const colRows = db.prepare(`SELECT name FROM pragma_table_info('hospitals')`).all();
const dbColSet = new Set(colRows.map(r => r.name));
const NEW_HOSP_COLS = [
  'jci_certified', 'accepts_international', 'english_departments', 'booking_method',
  'visa_assist', 'inpatient_standard', 'payment_methods', 'insurance_direct',
  'interpreter_on_site', 'verified', 'source_url', 'updated_at',
].filter(c => dbColSet.has(c));

const hospitalRows = db.prepare(`
  SELECT city_slug, name, chinese_name, specialties, address, phone, url, sort_order${NEW_HOSP_COLS.length ? ', ' + NEW_HOSP_COLS.join(', ') : ''}
  FROM hospitals
  ORDER BY city_slug, sort_order
`).all();

const out = [];

for (const c of cityRows) {
  const old = oldByCity.get(c.slug) || {};
  const hospitalsForCity = hospitalRows
    .filter(h => h.city_slug === c.slug)
    .map(h => ({
      name: h.name,
      specialties: h.specialties,
      address: h.address,
      phone: h.phone,
      url: h.url,
      // Preserve any extra fields from old data if present
      ...(old && old.hospitals && old.hospitals[0] ? Object.fromEntries(
        Object.entries(old.hospitals[0]).filter(([k]) => !['name','specialties','address','phone','url'].includes(k))
      ) : {})
    }));

  out.push({
    city: c.slug,
    cityName: c.name,
    chinese_name: c.chinese_name,
    region: c.region,
    intro: c.intro,
    avg_cost: c.avg_cost,
    wait_time: c.wait_time,
    growth: c.growth,
    hospitals: hospitalsForCity
  });
}

writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log(`✅ Exported ${cityRows.length} cities, ${hospitalRows.length} hospitals from medtravelcn.db to search_index.json`);
console.log(`   File: ${OUT}`);
console.log(`   Size: ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);

db.close();
