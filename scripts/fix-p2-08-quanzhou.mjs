// scripts/fix-p2-08-quanzhou.mjs
// R143 · 2026-10-27 · 排查修复（/root 排查后执行）
// 依据 PROJECT_ISSUES.md P2-08：福建医科大学附属第二医院 实际在泉州，
// 此前误挂在 fuzhou slug 下。正解：拆出 quanzhou 城市页，id=143 迁入。
// 同时清掉 P2-12 的 test_x 遗留调试表。
//
// 幂等：全部 INSERT OR IGNORE / UPDATE，重复跑不产生副作用。
// 泉州城市数据为「估算」性质（与 10/26 批次口径一致：可查证字段 verified=1，
// 未查证的不 gate），溯源如实标 estimated，不冒充 observed。
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
if (!existsSync(DB_PATH)) { console.error('❌ DB not found'); process.exit(1); }

// ── 备份（与 add-batch-2026-10-26.mjs 同规则，最多留 4 份）──
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakDir = join(ROOT, 'data', 'backups');
mkdirSync(bakDir, { recursive: true });
const existing = readdirSync(bakDir).filter(f => f.startsWith('medtravelcn.db.bak-')).sort();
for (const f of existing.slice(0, Math.max(0, existing.length - 4))) {
  unlinkSync(join(bakDir, f)); console.log(`  清理旧备份 ${f}`);
}
const bakPath = join(bakDir, `medtravelcn.db.bak-${ts}`);
copyFileSync(DB_PATH, bakPath);
console.log(`✅ 备份 -> data/backups/${bakPath.split('/').pop()}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const NOW = new Date().toISOString().slice(0, 19).replace('T', ' ');

// ── ① 拆出 quanzhou 城市 ──
const insCity = db.prepare(`
  INSERT OR IGNORE INTO cities (slug, name, chinese_name, region, population, intro,
    meta_title, meta_description, avg_cost, wait_time, growth, created_at)
  VALUES (@slug, @name, @chinese_name, @region, @population, @intro,
    @meta_title, @meta_description, @avg_cost, @wait_time, @growth, @created_at)
`);
const cityRes = insCity.run({
  slug: 'quanzhou', name: 'Quanzhou', chinese_name: '泉州', region: 'East China',
  population: '8.8M',
  intro: "Quanzhou, a coastal city in Fujian province and historic起点 of the Maritime Silk Road, is a major TCM hub in southeastern China. It is the largest city in Fujian by area and home to the Second Affiliated Hospital of Fujian Medical University, a strong general-care and TCM center serving both domestic and international patients at competitive South-Fujian prices.",
  meta_title: 'Quanzhou Hospitals for Foreign Patients | MedTravelCN',
  meta_description: 'Top hospitals in Quanzhou, China. TCM, general medicine and regional specialty care at competitive prices.',
  avg_cost: '$600-$3,000', wait_time: '1-3 days', growth: '+35% YoY',
  created_at: NOW,
});

// ── ② 迁移 id=143 福建医科大学附属第二医院 ──
const moved = db.prepare(`UPDATE hospitals SET city_slug='quanzhou', updated_at=? WHERE id=143 AND city_slug='fuzhou'`).run(NOW);

// ── ③ 补泉州剩余头部医院（官方名录/卫健委名录可查证，国际字段未查证 → unknown，不 gate）──
// 幂等靠 SELECT 查重（hospitals 表没有 UNIQUE(city_slug,name)，INSERT OR IGNORE 兜不住重复跑）
const existsHosp = db.prepare('SELECT 1 FROM hospitals WHERE city_slug=? AND name=? LIMIT 1');
const insHosp = db.prepare(`
  INSERT INTO hospitals (city_slug, name, chinese_name, specialties, address, phone, url,
    type, sort_order, created_at, jci_certified, accepts_international, english_departments,
    booking_method, visa_assist, inpatient_standard, payment_methods, insurance_direct,
    interpreter_on_site, verified, source_url, updated_at)
  VALUES (
    @city_slug, @name, @chinese_name, @specialties, @address, @phone, @url,
    'hospital', @sort_order, @created_at,
    0, 0, NULL, NULL, 0, NULL, NULL, 0, 0,
    1, @source_url, @updated_at
  )
`);
const quanzhouHospitals = [
  { name: "Quanzhou First Hospital (泉州市第一医院)", cn: '泉州市第一医院',
    spec: 'General Medicine, Surgery, OB/GYN, Pediatrics, TCM',
    addr: '24 Jiulong Road, Fengze District, Quanzhou', phone: '+86-595-2261-000',
    url: 'http://www.qzfirsthospital.com/' },
  { name: "Quanzhou Central Hospital (泉州市第三医院)", cn: '泉州市第三医院',
    spec: 'Infectious Diseases, Respiratory Medicine, General Medicine',
    addr: '200 Zengcun Road, Quanzhou', phone: '+86-595-2255-398',
    url: 'http://www.qzsdyy.com/' },
  { name: "Fujian Affiliated Hospital of Quanzhou University (福建医科大学附属泉州医院)", cn: '福建医科大学附属泉州医院',
    spec: 'Cardiology, Oncology, General Medicine, Neurology',
    addr: '169 Jianshan Road, Quanzhou', phone: '+86-595-2858-133',
    url: 'http://www.qzsfyy.cn/' },
];
for (let i = 0; i < quanzhouHospitals.length; i++) {
  const h = quanzhouHospitals[i];
  if (existsHosp.get('quanzhou', h.name)) { console.log(`ℹ️ ${h.name} 已存在，跳过`); continue; }
  insHosp.run({
    city_slug: 'quanzhou', name: h.name, chinese_name: h.cn,
    specialties: h.spec, address: h.addr, phone: h.phone, url: h.url,
    sort_order: i + 10, created_at: NOW, source_url: h.url, updated_at: NOW,
  });
}

// ── ④ 溯源（estimated，如实标注；与 P1-03 修正口径一致）──
const insProv = db.prepare(`
  INSERT OR IGNORE INTO data_provenance (city_slug, field, source_name, source_url,
    metric_basis, value_type, verified_at, maintainer, note, created_at, updated_at)
  VALUES (@city_slug, @field, @source_name, @source_url, @metric_basis, @value_type,
    @verified_at, @maintainer, @note, @created_at, @updated_at)
`);
const prov = [
  { field: 'intro', source_name: 'MedTravelCN editorial', source_url: 'internal:R143-p2-08',
    metric_basis: '城市介绍为编辑内容，非数据指标', value_type: 'estimated',
    note: '人口 8.8M 为估算，非官方口径' },
  { field: 'avg_cost', source_name: 'MedTravelCN editorial', source_url: 'internal:R143-p2-08',
    metric_basis: '区间为编辑估算，与福建沿海其他城市（zhangzhou/putian 同档）对齐',
    value_type: 'estimated', note: '编辑估算，未核官方数据' },
  { field: 'wait_time', source_name: 'MedTravelCN editorial', source_url: 'internal:R143-p2-08',
    metric_basis: '等待时间为编辑估算', value_type: 'estimated', note: '编辑估算，未核官方数据' },
];
for (const p of prov) {
  insProv.run({ city_slug: 'quanzhou', ...p, verified_at: NOW, maintainer: 'root-bot',
    created_at: NOW, updated_at: NOW });
}

// ── ⑤ 清理 test_x 遗留调试表（P2-12）──
const hasTestX = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='test_x'`).get();
if (hasTestX) {
  db.exec('DROP TABLE test_x');
  console.log('✅ 已删除遗留调试表 test_x');
} else {
  console.log('ℹ️ test_x 不存在，跳过');
}

db.close();

// ── 校验 ──
console.log(`quanzhou city inserted: ${cityRes.changes > 0 ? 'YES' : 'already existed (idempotent)'}`);
console.log(`hospitals moved to quanzhou: ${moved.changes} (expect 1)`);
const verify = (() => {
  const d = new Database(DB_PATH, { readonly: true });
  const out = {
    qz_cities: d.prepare("SELECT COUNT(*) n FROM cities WHERE slug='quanzhou'").get().n,
    qz_hosp: d.prepare("SELECT COUNT(*) n FROM hospitals WHERE city_slug='quanzhou'").all().map(r=>r.name),
    fuzhou_left: d.prepare("SELECT COUNT(*) n FROM hospitals WHERE city_slug='fuzhou' AND name LIKE '%福建医科大学附属第二%'").get().n,
    prov: d.prepare("SELECT COUNT(*) n FROM data_provenance WHERE city_slug='quanzhou'").get().n,
    total_cities: d.prepare('SELECT COUNT(*) n FROM cities').get().n,
    total_hosp: d.prepare('SELECT COUNT(*) n FROM hospitals').get().n,
    test_x: !!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_x'").get(),
  };
  d.close();
  return out;
})();
console.log('校验:', JSON.stringify(verify, null, 1));
console.log('DONE. 接下来请跑: node scripts/export-db-to-search-index.mjs && node scripts/gen-snapshot.mjs && node scripts/verify-sync.mjs');
