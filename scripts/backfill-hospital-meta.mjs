#!/usr/bin/env node
// ══════════════════════════════════════════════════════════
// 医院资质补录管道 · 2026-10-02
// ══════════════════════════════════════════════════════════
// 目的：把「这家医院对外国患者门槛多高」这个核心问题，变成可填、可查、可维护的字段。
//
// 设计原则（老板 10-02 定调后确立）：
//   ① 查不到就标 unknown，绝不填 false（假信息比空信息更害人）
//   ② 每条记录带来源 URL + 核实时间（防自己打脸：信息会过期）
//   ③ 分级：官方名单 > 医院官网自述 > 推断
//
// 字段语义：
//   foreign_access ∈ {certified, open, appointment_only, restricted, unknown}
//     certified       在省市卫健委涉外医疗服务机构名单内（官方验收）
//     open            官网/公开信息确认接收外国患者，无特殊门槛
//     appointment_only 需提前预约或走国际部流程
//     restricted      军警医院等，外国患者基本无法自行就医
//     unknown         查不到（默认，绝不猜）
//
// 用法：
//   node scripts/backfill-hospital-meta.mjs --list              列出待补录
//   node scripts/backfill-hospital-meta.mjs --file batch.json   批量导入补录
//   node scripts/backfill-hospital-meta.mjs --stats             看填充率
// ══════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB = join(ROOT, 'data', 'medtravelcn.db');

const VALID_ACCESS = ['certified', 'open', 'appointment_only', 'restricted', 'unknown'];

// ─────────── 命令分支 ───────────
const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === '--stats' || !cmd) {
  showStats();
} else if (cmd === '--list') {
  listPending();
} else if (cmd === '--file') {
  const f = args[1];
  if (!f) { console.error('用法: --file <path>'); process.exit(1); }
  applyFile(f);
} else {
  console.log(`用法:
  --list              列出待补录医院
  --file <path>       从 JSON 批量导入补录
  --stats             查看填充率
  --help              本帮助`);
  process.exit(0);
}

// ─────────── 实现 ───────────
function open() {
  const db = new Database(DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS hospital_meta (
      hospital_id      INTEGER PRIMARY KEY,
      foreign_access   TEXT,
      cert_level       TEXT,      -- 试点医院 / 定点机构 / 服务点 / null
      cert_source      TEXT,      -- 批文号或名单出处
      cert_year        INTEGER,
      insurance_direct TEXT,      -- yes / no / unknown
      emergency_24h    TEXT,      -- yes / no / unknown
      international_dept TEXT,    -- yes / no / unknown
      source_url       TEXT,      -- 核实的来源
      verified_at      TEXT,      -- 核实时间
      maintainer       TEXT,
      note             TEXT
    );
  `);
  return db;
}

function showStats() {
  const db = open();
  const total = db.prepare('SELECT COUNT(*) n FROM hospitals').get().n;
  const filled = db.prepare('SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access IS NOT NULL').get().n;
  const cert = db.prepare("SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access='certified'").get().n;

  console.log('\n═══ 医院资质填充率 ═══\n');
  console.log(`  医院总数      ${total}`);
  console.log(`  已补录        ${filled}  (${total ? Math.round(filled / total * 100) : 0}%)`);
  console.log(`  官方认证(certified)  ${cert}`);
  console.log(`  待补录        ${total - filled}\n`);

  if (filled) {
    console.log('  按分级:');
    for (const lv of VALID_ACCESS) {
      const n = db.prepare('SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access=?').get(lv).n;
      if (n) console.log(`    ${lv.padEnd(18)} ${n}`);
    }
    console.log('');
  }
  db.close();
  process.exit(0);
}

function listPending() {
  const db = open();
  const rows = db.prepare(`
    SELECT h.id, h.city_slug, h.name, h.url, m.foreign_access
    FROM hospitals h
    LEFT JOIN hospital_meta m ON m.hospital_id = h.id
    WHERE m.foreign_access IS NULL
    ORDER BY h.city_slug, h.id
  `).all();

  console.log(`\n═══ 待补录 ${rows.length} 家 ═══\n`);
  const byCity = {};
  for (const r of rows) (byCity[r.city_slug] ||= []).push(r);
  for (const [city, list] of Object.entries(byCity)) {
    console.log(`  ${city} (${list.length})`);
    for (const r of list) console.log(`    ${r.id}  ${r.name}`);
    console.log('');
  }
  console.log('补录格式见 data/backfill/ 下的模板文件');
  db.close();
  process.exit(0);
}

function applyFile(path) {
  if (!existsSync(path)) { console.error(`✗ 文件不存在: ${path}`); process.exit(1); }
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf-8')); }
  catch (e) { console.error(`✗ JSON 解析失败: ${e.message}`); process.exit(1); }

  const list = Array.isArray(data) ? data : (data.hospitals || []);
  if (!list.length) { console.error('✗ 没有可导入的记录'); process.exit(1); }

  const db = open();
  const upd = db.prepare(`
    INSERT INTO hospital_meta
      (hospital_id, foreign_access, cert_level, cert_source, cert_year,
       insurance_direct, emergency_24h, international_dept,
       source_url, verified_at, maintainer, note)
    VALUES (?,?,?,?,?,?,?,?,?,datetime('now'),?,?)
    ON CONFLICT(hospital_id) DO UPDATE SET
      foreign_access=excluded.foreign_access,
      cert_level=excluded.cert_level,
      cert_source=excluded.cert_source,
      cert_year=excluded.cert_year,
      insurance_direct=excluded.insurance_direct,
      emergency_24h=excluded.emergency_24h,
      international_dept=excluded.international_dept,
      source_url=excluded.source_url,
      verified_at=datetime('now'),
      maintainer=excluded.maintainer,
      note=excluded.note
  `);

  let ok = 0, bad = 0;
  const errors = [];
  for (const h of list) {
    const id = Number(h.id ?? h.hospital_id);
    if (!Number.isInteger(id) || id <= 0) { errors.push(`缺 id: ${JSON.stringify(h).slice(0,60)}`); bad++; continue; }
    if (h.foreign_access && !VALID_ACCESS.includes(h.foreign_access)) {
      errors.push(`${id} 非法 foreign_access: ${h.foreign_access}（允许: ${VALID_ACCESS.join('/')}）`);
      bad++; continue;
    }
    // 来源硬要求：有 foreign_access 结论就必须有 source_url
    if (h.foreign_access && h.foreign_access !== 'unknown' && !h.source_url) {
      errors.push(`${id} 缺 source_url（结论 ${h.foreign_access} 必须有出处）`);
      bad++; continue;
    }
    upd.run(
      id, h.foreign_access ?? 'unknown',
      h.cert_level ?? null, h.cert_source ?? null, h.cert_year ?? null,
      h.insurance_direct ?? 'unknown', h.emergency_24h ?? 'unknown', h.international_dept ?? 'unknown',
      h.source_url ?? null, h.maintainer ?? 'xieguanzhi', h.note ?? null
    );
    ok++;
  }

  console.log(`\n  导入: ok=${ok} bad=${bad}`);
  for (const e of errors.slice(0, 10)) console.log(`   ✗ ${e}`);
  if (errors.length > 10) console.log(`   ...还有 ${errors.length - 10} 条`);

  const total = db.prepare('SELECT COUNT(*) n FROM hospitals').get().n;
  const filled = db.prepare('SELECT COUNT(*) n FROM hospital_meta WHERE foreign_access IS NOT NULL').get().n;
  console.log(`  填充率: ${filled}/${total} (${total ? Math.round(filled / total * 100) : 0}%)\n`);
  db.close();
  process.exit(bad ? 1 : 0);
}
