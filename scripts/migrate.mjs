// scripts/migrate.mjs
// Migrate data from search_index.json (11 cities + 49 hospitals) into SQLite
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
const SOURCE = join(ROOT, 'search_index.json');

if (!existsSync(DB_PATH)) {
  console.error('❌ DB not found. Run: npm run db:init');
  process.exit(1);
}
if (!existsSync(SOURCE)) {
  console.error('❌ search_index.json not found at', SOURCE);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const citiesData = JSON.parse(readFileSync(SOURCE, 'utf8'));

// Wipe existing data (idempotent migration)
db.exec(`
  DELETE FROM hospitals;
  DELETE FROM cities;
  DELETE FROM sqlite_sequence WHERE name IN ('cities', 'hospitals');
`);

const insertCity = db.prepare(`
  INSERT INTO cities (slug, name, chinese_name, region, intro, meta_title, meta_description, avg_cost, wait_time, growth)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHospital = db.prepare(`
  INSERT INTO hospitals (city_slug, name, chinese_name, specialties, address, phone, url, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// City meta + stats (reasonable defaults; can be edited later)
const CITY_META = {
  shanghai: { region: 'East China', chinese_name: '上海', avg_cost: '$2,500-$12,000', wait_time: '2-5 days', growth: '+73% YoY' },
  beijing: { region: 'North China', chinese_name: '北京', avg_cost: '$2,400-$11,500', wait_time: '3-7 days', growth: '+58% YoY' },
  guangzhou: { region: 'South China', chinese_name: '广州', avg_cost: '$2,200-$10,000', wait_time: '2-5 days', growth: '+51% YoY' },
  shenzhen: { region: 'South China', chinese_name: '深圳', avg_cost: '$2,300-$10,500', wait_time: '1-4 days', growth: '+62% YoY' },
  chengdu: { region: 'West China', chinese_name: '成都', avg_cost: '$1,800-$8,500', wait_time: '2-5 days', growth: '+44% YoY' },
  hangzhou: { region: 'East China', chinese_name: '杭州', avg_cost: '$2,100-$9,800', wait_time: '2-5 days', growth: '+48% YoY' },
  wuhan: { region: 'Central China', chinese_name: '武汉', avg_cost: '$1,700-$7,800', wait_time: '2-4 days', growth: '+39% YoY' },
  xian: { region: 'Northwest China', chinese_name: '西安', avg_cost: '$1,600-$7,500', wait_time: '2-4 days', growth: '+35% YoY' },
  nanjing: { region: 'East China', chinese_name: '南京', avg_cost: '$2,000-$9,200', wait_time: '2-5 days', growth: '+42% YoY' },
  chongqing: { region: 'Southwest China', chinese_name: '重庆', avg_cost: '$1,700-$7,800', wait_time: '2-4 days', growth: '+37% YoY' },
  tianjin: { region: 'North China', chinese_name: '天津', avg_cost: '$2,000-$9,000', wait_time: '2-5 days', growth: '+41% YoY' },
  // Added 2026-07 by 墨 (老板拍 "全干")
  suzhou: { region: 'East China', chinese_name: '苏州', avg_cost: '$2,000-$9,500', wait_time: '2-5 days', growth: '+38% YoY' },
  xiamen: { region: 'East China', chinese_name: '厦门', avg_cost: '$1,800-$8,500', wait_time: '1-3 days', growth: '+47% YoY' },
  qingdao: { region: 'East China', chinese_name: '青岛', avg_cost: '$1,900-$9,200', wait_time: '1-4 days', growth: '+41% YoY' },
  changsha: { region: 'Central China', chinese_name: '长沙', avg_cost: '$1,500-$7,000', wait_time: '2-5 days', growth: '+34% YoY' },
  harbin: { region: 'Northeast China', chinese_name: '哈尔滨', avg_cost: '$1,400-$6,500', wait_time: '2-4 days', growth: '+31% YoY' },
  kunming: { region: 'Southwest China', chinese_name: '昆明', avg_cost: '$1,400-$6,800', wait_time: '2-5 days', growth: '+44% YoY' },
  jinan: { region: 'East China', chinese_name: '济南', avg_cost: '$1,700-$7,800', wait_time: '2-4 days', growth: '+29% YoY' },
  dalian: { region: 'Northeast China', chinese_name: '大连', avg_cost: '$1,600-$7,500', wait_time: '1-4 days', growth: '+36% YoY' },
};

const transaction = db.transaction(() => {
  let cityCount = 0;
  let hospitalCount = 0;

  for (const c of citiesData) {
    const meta = CITY_META[c.city] || {};
    insertCity.run(
      c.city,
      c.cityName,
      meta.chinese_name || null,
      meta.region || null,
      null, // intro can be added later via admin
      `${c.cityName} Hospitals for Foreign Patients | MedTravelCN`,
      `Top international-standard hospitals in ${c.cityName}, China. Browse verified hospitals, compare costs, and book your medical trip.`,
      meta.avg_cost || null,
      meta.wait_time || null,
      meta.growth || null
    );
    cityCount++;

    c.hospitals.forEach((h, i) => {
      // Extract Chinese name from "English Name (中文名)" pattern
      const cnMatch = h.name && h.name.match(/\(([^)]+)\)/);
      const chineseName = cnMatch ? cnMatch[1] : null;
      insertHospital.run(
        c.city,
        h.name,
        chineseName,
        h.specialties || null,
        h.address || null,
        h.phone || null,
        h.url || null,
        i
      );
      hospitalCount++;
    });
  }

  return { cityCount, hospitalCount };
});

const result = transaction();
console.log(`✅ Migrated ${result.cityCount} cities and ${result.hospitalCount} hospitals from search_index.json`);

// Verify
const verifyCities = db.prepare('SELECT COUNT(*) as c FROM cities').get();
const verifyHospitals = db.prepare('SELECT COUNT(*) as c FROM hospitals').get();
console.log(`✅ DB now has: ${verifyCities.c} cities, ${verifyHospitals.c} hospitals`);

db.close();