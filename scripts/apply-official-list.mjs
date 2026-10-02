#!/usr/bin/env node
// 官方涉外名单 → 匹配库内医院 → 生成 backfill 数据
// 用法: node scripts/apply-official-list.mjs <list.json>
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync as rf } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const listFile = process.argv[2];
if (!listFile || !existsSync(listFile)) {
  console.error('用法: node scripts/apply-official-list.mjs <list.json>');
  process.exit(1);
}

const list = JSON.parse(readFileSync(listFile, 'utf8'));
const meta = list._meta || {};
const hospitals = list.hospitals || [];

// 用 snapshot.json（无 native 依赖；better-sqlite3 在 Node 24 + arm64 下会 GC 崩溃）
const snapPath = join(ROOT, 'src', 'data', 'snapshot.json');
const snap = JSON.parse(rf(snapPath, 'utf-8'));
const rows = snap.hospitals.map(h => ({
  id: h.id, city_slug: h.city_slug, name: h.name, chinese_name: h.chinese_name
}));

// 归一化：去空格/标点/括注，便于模糊匹配
// 归一化：只做「格式」归一，绝不删有区分度的词
// （曾因删除「医院」二字，导致 7 家中山大学系医院全部塌缩成同一 key）
function norm(s) {
  return (s || '')
    .replace(/[（(].*?[)）]/g, '')        // 去括注
    .replace(/[—–\-·\s]+/g, '')         // 去破折号/空格
    .replace(/[医院]$/g, '')               // 只去结尾的「医院」
    .toLowerCase();
}

const byCity = {};
for (const r of rows) (byCity[r.city_slug] ||= []).push(r);

const matched = [];
const unmatched = [];

const used = new Set();
for (const h of hospitals) {
  const target = norm(h.zh);
  let pool = (byCity[h.city] || []).filter(r => !used.has(r.id));
  // 优先匹配 chinese_name，其次英文名
  const scoreOf = (r) => {
    const cn = norm(r.chinese_name || '');
    const en = norm(r.name || '');
    if (cn && cn === target) return 100;
    if (en === target) return 95;
    if (cn && (cn.includes(target) || target.includes(cn))) return 80;
    if (en && (en.includes(target) || target.includes(en))) return 70;
    return 0;
  };
  let best = null, bestScore = 0;
  for (const r of pool) {
    const s = scoreOf(r);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  if (best && bestScore >= 70) {
    used.add(best.id);
    matched.push({ ...h, id: best.id, dbName: best.name, score: bestScore });
  } else {
    unmatched.push(h);
  }
}

const srcUrl = (meta.source_urls || [])[0] || '';
const out = hospitals.length && matched.length ? matched.map(m => ({
  id: m.id,
  foreign_access: 'certified',
  cert_level: meta.list_name || '涉外医疗服务机构',
  cert_source: `${meta.announced_by || ''}（${meta.announced_date || ''}）`,
  cert_year: meta.announced_date ? Number(String(meta.announced_date).slice(0, 4)) : null,
  international_dept: 'yes',
  emergency_24h: 'yes',
  insurance_direct: 'unknown',
  source_url: srcUrl,
  maintainer: 'xieguanzhi',
  note: m.note ? `${m.name}（${m.note}）` : m.zh,
})) : [];

const outName = `matched-${listFile.split('/').pop().replace('.json', '')}.json`;
const outPath = join(ROOT, 'data', 'backfill', outName);
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

console.log(`\n═══ ${meta.list_name || listFile} ═══\n`);
console.log(`  名单总数      ${hospitals.length}`);
const ids = new Set(matched.map(m => m.id));
const dupIds = matched.filter(m => ids.size !== matched.length);
console.log(`  库内匹配      ${matched.length}${ids.size !== matched.length ? `  ⚠️ id 重复!` : ''}`);
console.log(`  库内缺失      ${unmatched.length}`);
console.log(`\n  已匹配:`);
for (const m of matched) console.log(`    #${String(m.id).padEnd(4)} ${m.zh.padEnd(22)} → ${m.dbName.slice(0, 46)}`);
if (unmatched.length) {
  console.log(`\n  ⚠️ 库内没有（需补录）:`);
  for (const u of unmatched) console.log(`    ${u.zh}`);
}
console.log(`\n  输出: data/backfill/${outName}\n`);

process.exit(0);
