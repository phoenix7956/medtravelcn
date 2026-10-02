#!/usr/bin/env node
// 官方名单缺口 → 补录新医院（不是改字段，是加行）
// 用法: node scripts/import-missing-hospitals.mjs <list.json>
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const listFile = process.argv[2];
if (!listFile || !existsSync(listFile)) {
  console.error('用法: node scripts/import-missing-hospitals.mjs <list.json>');
  process.exit(1);
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('✗ 需要 DATABASE_URL');
  process.exit(1);
}

const list = JSON.parse(readFileSync(listFile, 'utf-8'));
const meta = list._meta || {};
const incoming = list.new_hospitals || [];

const client = new Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1|\.local/.test(url) ? false : { rejectUnauthorized: false },
});
await client.connect();

// 确认城市存在
const citySet = new Set((await client.query('SELECT slug FROM cities')).rows.map(r => r.slug));
const srcUrl = (meta.source_urls || [])[0] || '';

let added = 0, skipped = 0;
const missingCities = new Set();

for (const h of incoming) {
  if (!citySet.has(h.city_slug)) { missingCities.add(h.city_slug); skipped++; continue; }

  const exists = await client.query(
    'SELECT 1 FROM hospitals WHERE city_slug=$1 AND chinese_name=$2 LIMIT 1',
    [h.city_slug, h.chinese_name]
  );
  if (exists.rowCount > 0) { skipped++; continue; }

  // 排序号：同城末尾
  const pos = await client.query(
    'SELECT COALESCE(MAX(sort_order), -1)+1 AS n FROM hospitals WHERE city_slug=$1',
    [h.city_slug]
  );

  await client.query(`
    INSERT INTO hospitals
      (city_slug, name, chinese_name, specialties, type, sort_order, created_at)
    VALUES ($1,$2,$3,$4,$5,$6, now())
  `, [h.city_slug, h.name, h.chinese_name, h.specialties ?? null, h.type ?? 'hospital', pos.rows[0].n]);

  // 若是官方认证，���写 meta
  if (h.certified) {
    const hid = await client.query(
      'SELECT id FROM hospitals WHERE city_slug=$1 AND chinese_name=$2',
      [h.city_slug, h.chinese_name]
    );
    await client.query(`
      INSERT INTO hospital_meta
        (hospital_id, foreign_access, cert_level, cert_source, cert_year,
         international_dept, emergency_24h, insurance_direct, source_url, maintainer, note)
      VALUES ($1,'certified',$2,$3,$4,'yes','yes','unknown',$5,'xieguanzhi',$6)
      ON CONFLICT(hospital_id) DO UPDATE SET foreign_access='certified', cert_source=EXCLUDED.cert_source
    `, [
      hid.rows[0].id,
      meta.list_name || '涉外医疗服务医院',
      meta.announced_by || '广东省卫生健康委、广东省医保局、广东省药监局（2026-03-26）',
      meta.cert_year ?? 2026,
      srcUrl,
      h.note ? `${h.chinese_name}（${h.note}）` : h.chinese_name,
    ]);
  }
  added++;
}

const r = await client.query(
  'SELECT (SELECT COUNT(*) FROM cities)::int AS c, (SELECT COUNT(*) FROM hospitals)::int AS h, (SELECT COUNT(*) FROM hospital_meta)::int AS m'
);
const nCities = r.rows[0].c, nHosp = r.rows[0].h, nMeta = r.rows[0].m;

console.log(`\n═══ 缺口补录 ═══\n`);
console.log(`  新增医院    ${added}`);
console.log(`  跳过        ${skipped}${missingCities.size ? `（城市不存在: ${[...missingCities].join(', ')}）` : ''}`);
console.log(`\n  DB 现状: ${nCities} 城 / ${nHosp} 医院 / ${nMeta} 已补录资质\n`);

await client.end();
process.exit(0);
