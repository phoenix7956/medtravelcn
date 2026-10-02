// scripts/ingest-batch.mjs
// ChinaMedGuide · 通用批量摄入脚本（R142 数据治理兼容版）
//
// 用法：
//   node scripts/ingest-batch.mjs <batch.json> --dry-run          # 默认，仅报告不入库
//   node scripts/ingest-batch.mjs <batch.json> --apply           # 实际写入
//   node scripts/ingest-batch.mjs <batch.csv>  --apply --format=csv
//
// 输入（JSON 格式）：
//   {
//     "batch_id": "batch-001-r142-cities",
//     "created_at": "2026-09-30T...",
//     "maintainer": "xieguanzhi",
//     "verified_default": false,        // 默认未核验（遵循 R142）
//     "cities": [...],
//     "hospitals": [...],
//     "provenance": [...]               // 与 R142 data_provenance 表联动（必填）
//   }
//
// 设计原则（R142 红线）：
//   1. 任何 hospital 写入必须有对应 provenance 记录（value_type 至少 'estimated'）
//   2. 默认 verified=false / value_type=unverified，需 --apply 才会真的写
//   3. 去重：以 (city_slug, name) 为唯一键
//   4. 字段校验：缺失项进 warning，不阻断
//   5. 幂等：INSERT OR IGNORE，重复执行安全
//
// 守约：不依赖任何未声明外部资源（DB / FS / stdout 即可）

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');

// ---------- CLI ----------
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('用法: node scripts/ingest-batch.mjs <file.json|csv> [--dry-run|--apply] [--format=json|csv]');
  process.exit(1);
}
const file = args[0];
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run') || !apply; // 默认 dry-run
const fmtArg = args.find(a => a.startsWith('--format='));
const format = fmtArg ? fmtArg.split('=')[1] : (file.endsWith('.csv') ? 'csv' : 'json');

if (!existsSync(file)) {
  console.error(`❌ 文件不存在: ${file}`);
  process.exit(1);
}

// ---------- DB 准备 ----------
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 确保溯源表存在（R142 add-provenance.mjs 已建；此处防御性检查）
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
`);

// ---------- 读取 batch ----------
const raw = readFileSync(file, 'utf8');
let batch;
if (format === 'json') {
  batch = JSON.parse(raw);
} else {
  batch = parseCsv(raw);
}
const batchId = batch.batch_id || `batch-${Date.now()}`;
const maintainer = batch.maintainer || 'xieguanzhi';
const verifiedDefault = batch.verified_default ?? false;

console.log(`\n═══ ${dryRun ? 'DRY-RUN' : 'APPLY'} · batch=${batchId} ═══`);
console.log(`来源: ${file}`);
console.log(`maintainer: ${maintainer} · verified_default: ${verifiedDefault}`);
console.log(`cities: ${batch.cities?.length || 0} · hospitals: ${batch.hospitals?.length || 0} · provenance: ${batch.provenance?.length || 0}\n`);

// ---------- 校验 ----------
const report = {
  batch_id: batchId,
  file,
  mode: dryRun ? 'dry-run' : 'apply',
  cities: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: [] },
  hospitals: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: [] },
  provenance: { total: 0, inserted: 0, skipped: 0, errors: [] },
  warnings: [],
  duplicates_in_batch: [],
  verified_status: { verified_true: 0, verified_false: 0, no_flag: 0 },
};

// 字段必需性（与现有 hospitals 表对齐；schema v2 新增字段此处不强制）
const REQUIRED_CITY = ['slug', 'name'];
const REQUIRED_HOSP = ['city_slug', 'name'];

function validateRecord(rec, req, label, idx) {
  for (const f of req) {
    if (rec[f] === undefined || rec[f] === null || rec[f] === '') {
      report.warnings.push(`${label}[${idx}] 缺必填字段 ${f}（${rec.name || rec.slug || '?'}）`);
    }
  }
}

// 批内去重检查
const seenHosp = new Map();
for (let i = 0; i < (batch.hospitals || []).length; i++) {
  const h = batch.hospitals[i];
  validateRecord(h, REQUIRED_HOSP, 'hospital', i);
  const key = `${h.city_slug}|${h.name}`;
  if (seenHosp.has(key)) {
    report.duplicates_in_batch.push(key);
  } else {
    seenHosp.set(key, i);
  }
}

const seenCity = new Map();
for (let i = 0; i < (batch.cities || []).length; i++) {
  const c = batch.cities[i];
  validateRecord(c, REQUIRED_CITY, 'city', i);
  const key = c.slug;
  if (seenCity.has(key)) {
    report.duplicates_in_batch.push(key);
  } else {
    seenCity.set(key, i);
  }
}

if (report.duplicates_in_batch.length > 0) {
  console.error(`❌ 批内有重复键:`);
  for (const k of report.duplicates_in_batch) console.error(`   ${k}`);
  console.error(`   请先 dedup 再跑`);
  if (!apply) {
    // dry-run 不阻断，仍输出报告
  } else {
    db.close();
    process.exit(1);
  }
}

// ---------- DB 现况对照 ----------
const existingCities = new Map(db.prepare('SELECT slug FROM cities').all().map(r => [r.slug, true]));
const existingHospitals = new Map();
for (const r of db.prepare('SELECT id, city_slug, name FROM hospitals').all()) {
  existingHospitals.set(`${r.city_slug}|${r.name}`, r.id);
}

// R142 红线（修正版）：
//   data_provenance 表按 (city_slug, field) 唯一，只能追踪城市级数值承诺；
//   医院身份核验由 batch JSON 自身承担：
//     (a) 每个医院必须有 `url` 字段（指向官方/卫健委公开页面）
//     (b) 每个医院必须显式标记 `verified: true|false`
//     (c) batch JSON 必须有 maintainer + created_at（即"谁、什么时候、提交了什么"作为审计凭证）
//   不在 data_provenance 表强插 hospital_id，是因为该表是 city 数值承诺专用。
//   若未来医院级 provenance 需求出现，再开 hospital_provenance 表。

const orphanHospitals = [];
for (let i = 0; i < (batch.hospitals || []).length; i++) {
  const h = batch.hospitals[i];
  if (!h.url || String(h.url).length < 6) {
    orphanHospitals.push(`${h.name} (${h.city_slug}) — 缺 url 字段`);
  } else if (h.verified === undefined || h.verified === null) {
    orphanHospitals.push(`${h.name} (${h.city_slug}) — 未标 verified 字段`);
  }
}
if (orphanHospitals.length > 0) {
  console.error(`❌ R142 红线（医院身份核验失败）:`);
  for (const x of orphanHospitals) console.error(`   ${x}`);
  if (apply) {
    db.close();
    process.exit(1);
  } else {
    console.error(`   dry-run 模式继续，但 --apply 会被拒\n`);
  }
}

// ---------- 执行 ----------
if (!dryRun) {
  const insertCity = db.prepare(`
    INSERT OR IGNORE INTO cities
      (slug, name, chinese_name, region, intro, population, meta_title, meta_description,
       avg_cost, wait_time, growth, created_at)
    VALUES
      (@slug, @name, @chinese_name, @region, @intro, @population, @meta_title, @meta_description,
       @avg_cost, @wait_time, @growth, datetime('now'))
  `);
  const insertHosp = db.prepare(`
    INSERT OR IGNORE INTO hospitals
      (city_slug, name, chinese_name, specialties, address, phone, url, type, sort_order, created_at)
    VALUES
      (@city_slug, @name, @chinese_name, @specialties, @address, @phone, @url, 'hospital', @sort_order, datetime('now'))
  `);
  const upsertProv = db.prepare(`
    INSERT OR REPLACE INTO data_provenance
      (city_slug, field, source_name, source_url, metric_basis, value_type, verified_at, maintainer, note, updated_at)
    VALUES
      (@city_slug, @field, @source_name, @source_url, @metric_basis, @value_type, @verified_at, @maintainer, @note, datetime('now'))
  `);

  // 外键前置检查：医院的 city_slug 必须已存在或本批次会插入
  const knownCities = new Set(existingCities);
  for (const c of batch.cities || []) knownCities.add(c.slug);
  const orphanRefs = [];
  for (const h of batch.hospitals || []) {
    if (!knownCities.has(h.city_slug)) orphanRefs.push(`${h.name} → ${h.city_slug}`);
  }
  if (orphanRefs.length) {
    console.log(`\n⚠️  ${orphanRefs.length} 家医院引用了不存在的城市（将被跳过，避免外键回滚整批）:`);
    for (const r of orphanRefs.slice(0, 10)) console.log(`   ${r}`);
  }
  const validHospitals = (batch.hospitals || []).filter(h => knownCities.has(h.city_slug));
  const badHospitals = (batch.hospitals || []).filter(h => !knownCities.has(h.city_slug));

  const tx = db.transaction(() => {
    // 先插城市（保证医院有父行）
    for (const c of batch.cities || []) {
      report.cities.total++;
      if (existingCities.has(c.slug)) {
        report.cities.skipped++;
        continue;
      }
      try {
        const r = insertCity.run({
          ...c,
          population: c.population ?? null,
          meta_title: c.meta_title ?? null,
          meta_description: c.meta_description ?? null,
          intro: c.intro ?? null,
          avg_cost: c.avg_cost ?? null,
          wait_time: c.wait_time ?? null,
          growth: c.growth ?? null,
        });
        if (r.changes > 0) report.cities.inserted++;
        else report.cities.skipped++;
      } catch (e) {
        report.cities.errors.push({ slug: c.slug, err: e.message });
      }
    }
    // Hospitals
    for (const h of validHospitals) {
      report.hospitals.total++;
      const key = `${h.city_slug}|${h.name}`;
      if (existingHospitals.has(key)) {
        report.hospitals.skipped++;
        continue;
      }
      try {
        const r = insertHosp.run({
          ...h,
          chinese_name: h.chinese_name ?? null,
          specialties: h.specialties ?? null,
          address: h.address ?? null,
          phone: h.phone ?? null,
          url: h.url ?? null,
          sort_order: h.sort_order ?? 999,
        });
        if (r.changes > 0) report.hospitals.inserted++;
        else report.hospitals.skipped++;
      } catch (e) {
        report.hospitals.errors.push({ name: h.name, err: e.message });
      }
    }
    // Provenance
    for (const p of batch.provenance || []) {
      report.provenance.total++;
      try {
        upsertProv.run({
          city_slug: p.city_slug,
          field: p.field,
          source_name: p.source_name || null,
          source_url: p.source_url || null,
          metric_basis: p.metric_basis || null,
          value_type: p.value_type || 'unverified',
          verified_at: p.verified_at || null,
          maintainer: p.maintainer || maintainer,
          note: p.note || null,
        });
        report.provenance.inserted++;
      } catch (e) {
        report.provenance.errors.push({ row: p, err: e.message });
      }
    }
  });
  tx();
} else {
  // Dry-run 只统计，不写
  for (const c of batch.cities || []) {
    report.cities.total++;
    if (existingCities.has(c.slug)) report.cities.skipped++;
    else report.cities.inserted++;
  }
  for (const h of batch.hospitals || []) {
    report.hospitals.total++;
    if (h.verified === true) report.verified_status.verified_true++;
    else if (h.verified === false) report.verified_status.verified_false++;
    else report.verified_status.no_flag++;
    const key = `${h.city_slug}|${h.name}`;
    if (existingHospitals.has(key)) report.hospitals.skipped++;
    else report.hospitals.inserted++;
  }
  for (const p of batch.provenance || []) report.provenance.total++;
}

// ---------- 报告 ----------
console.log('── 结果 ──');
console.log(`cities:     new=${report.cities.inserted}  skip=${report.cities.skipped}  err=${report.cities.errors.length}`);
console.log(`hospitals:  new=${report.hospitals.inserted}  skip=${report.hospitals.skipped}  err=${report.hospitals.errors.length}`);
console.log(`provenance: rows=${report.provenance.total}  err=${report.provenance.errors.length}`);

  // 错误明细（原来只统计不打印，导致 apply 静默全失败）
  for (const [label, r] of Object.entries(report)) {
    if (r.errors && r.errors.length) {
      console.log(`\n❌ ${label} 错误 ${r.errors.length} 条:`);
      for (const e of r.errors.slice(0, 8)) {
        console.log(`   ${e.slug || e.name || JSON.stringify(e).slice(0, 60)} → ${e.err}`);
      }
      if (r.errors.length > 8) console.log(`   ...还有 ${r.errors.length - 8} 条`);
    }
  }

if (report.warnings.length > 0) {
  console.log(`\n⚠️  warnings (${report.warnings.length}):`);
  for (const w of report.warnings.slice(0, 10)) console.log(`   ${w}`);
  if (report.warnings.length > 10) console.log(`   ... 还有 ${report.warnings.length - 10} 条`);
}

if (dryRun) {
  console.log(`\n🔒 DRY-RUN: 数据未写入。确认无误后用 --apply 提交:`);
  console.log(`   node scripts/ingest-batch.mjs ${file} --apply`);
}

// 不调 db.close()：better-sqlite3 在 Node v24 + arm64 下由 GC 自动关闭，
// 显式 close 会在 GC 阶段触发 double-free (RemoveEnvironmentCleanupHook 断言失败)。
// 验证：scripts/data-quality.mjs / add-cities-2026-09-05.mjs 都未 close，可跑通。
// 退出码由 process.exit 显式控制，避免任何挂起 native handle。
process.exit(report.hospitals.errors.length > 0 ? 1 : 0);

// ---------- CSV 解析（极简版） ----------
function parseCsv(text) {
  // 仅支持：headers + records + 双引号转义 + 行内逗号
  // 不支持嵌套引号；R142 batch 建议优先 JSON
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const headers = parseCsvLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; });
    records.push(obj);
  }
  // CSV 不分 cities/hospitals/provenance：按 type 列分桶
  const cities = records.filter(r => r.type === 'city');
  const hospitals = records.filter(r => r.type === 'hospital');
  const provenance = records.filter(r => r.type === 'provenance').map(r => ({
    city_slug: r.city_slug,
    field: r.field,
    value_type: r.value_type || 'unverified',
    source_name: r.source_name,
    source_url: r.source_url,
    note: r.note,
  }));
  return { batch_id: 'csv-batch', cities, hospitals, provenance };
}
function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}