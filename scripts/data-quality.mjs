// scripts/data-quality.mjs — 数据完整度体检
// 用于「持续性」运营：知道哪些字段缺、哪些城市空、哪些内容待补
import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(join(ROOT, 'data', 'medtravelcn.db'), { readonly: true });

const T = (sql) => db.prepare(sql).all();
const G = (sql) => db.prepare(sql).get();

console.log('═══ ChinaMedGuide 数据体检 ═══\n');

const c = G('SELECT COUNT(*) n FROM cities').n;
const h = G('SELECT COUNT(*) n FROM hospitals').n;
const r = G('SELECT COUNT(*) n FROM reviews').n;
const p = G('SELECT COUNT(*) n FROM data_provenance').n;
console.log(`规模：${c} 城 · ${h} 医院 · ${r} 评价 · ${p} 溯源\n`);

console.log('── 医院字段完整度 ──');
const cols = ['chinese_name', 'specialties', 'address', 'phone', 'url', 'type'];
const bar = (pct) => '█'.repeat(Math.round(pct / 5)).padEnd(20, '░');
for (const col of cols) {
  const miss = G(`SELECT COUNT(*) n FROM hospitals WHERE ${col} IS NULL OR ${col} = ''`).n;
  const ok = h - miss;
  const pct = (ok / h) * 100;
  console.log(`  ${col.padEnd(14)} ${String(ok).padStart(3)}/${h}  ${bar(pct)} ${pct.toFixed(0)}%`);
}

console.log('\n── 城市字段完整度 ──');
const ccols = ['chinese_name', 'region', 'intro', 'avg_cost', 'wait_time', 'meta_title', 'meta_description'];
for (const col of ccols) {
  const miss = G(`SELECT COUNT(*) n FROM cities WHERE ${col} IS NULL OR ${col} = ''`).n;
  const ok = c - miss;
  const pct = (ok / c) * 100;
  console.log(`  ${col.padEnd(18)} ${String(ok).padStart(3)}/${c}  ${bar(pct)} ${pct.toFixed(0)}%`);
}

console.log('\n── 城市覆盖（按大区）──');
const regions = T(`
  SELECT COALESCE(NULLIF(c.region,''),'(未填)') AS region,
         COUNT(DISTINCT c.slug) AS cities,
         COUNT(h.id) AS hospitals
  FROM cities c LEFT JOIN hospitals h ON h.city_slug = c.slug
  GROUP BY 1 ORDER BY hospitals DESC
`);
for (const r of regions) {
  console.log(`  ${String(r.region).padEnd(18)} ${String(r.cities).padStart(2)} 城  ${String(r.hospitals).padStart(3)} 院`);
}

console.log('\n── 医院最少的城市（优先补）──');
const thin = T(`
  SELECT c.slug, c.name, COALESCE(c.region,'—') AS region, COUNT(h.id) AS n
  FROM cities c LEFT JOIN hospitals h ON h.city_slug = c.slug
  GROUP BY c.slug HAVING n < 4 ORDER BY n ASC
`);
if (thin.length === 0) console.log('  ✓ 每城 ≥4 院');
for (const t of thin) console.log(`  ${t.name.padEnd(14)} ${t.n} 院  (${t.region})`);

console.log('\n── 溯源覆盖 ──');
const prov = G(`SELECT COUNT(DISTINCT city_slug) n FROM data_provenance`).n;
console.log(`  ${prov}/${c} 城有溯源记录 (${((prov / c) * 100).toFixed(0)}%)`);

console.log('\n── 目标缺口 ──');
console.log(`  城市：${c}/100  (缺 ${Math.max(0, 100 - c)})`);
console.log(`  医院：${h}/1000 (缺 ${Math.max(0, 1000 - h)})`);
console.log(`  溯源：${prov}/${c} 城`);
