// scripts/add-cities-2026-09-05.mjs
// R141+ ChinaMedGuide daily expansion: 贵阳 (Guiyang) + 石家庄 (Shijiazhuang)
// Author: 墨 (2026-09-05 daily expansion)
// Idempotent: INSERT OR IGNORE

import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'medtravelcn.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const NOW = new Date().toISOString().slice(0, 19).replace('T', ' ');

// ============== CITIES (2 new) ==============
const newCities = [
  {
    slug: `guiyang`,
    name: `Guiyang`,
    chinese_name: `贵阳`,
    region: `Southwest China`,
    population: `6.2M`,
    intro: `Guiyang is the capital of Guizhou province and a rapidly growing medical hub in Southwest China. Known for traditional Chinese medicine combined with modern oncology and respiratory medicine, the city's high-altitude climate offers specialized rehabilitation programs.`,
    meta_title: `Guiyang Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Top hospitals in Guiyang, China. Browse TCM, oncology, and respiratory specialties with regional pricing advantages.`,
    avg_cost: `$900-$4,500`,
    wait_time: `1-3 days`,
    growth: `+52% YoY`,
  },
  {
    slug: `shijiazhuang`,
    name: `Shijiazhuang`,
    chinese_name: `石家庄`,
    region: `North China`,
    population: `11.2M`,
    intro: `Shijiazhuang is the capital of Hebei province and a major medical center serving northern China. The city is known for ophthalmology, cardiovascular surgery, and pharmaceutical research, with Hebei Medical University-affiliated hospitals providing affordable specialized care.`,
    meta_title: `Shijiazhuang Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Top hospitals in Shijiazhuang, China. Browse ophthalmology, cardiovascular, and pharmaceutical research specialties.`,
    avg_cost: `$1,000-$5,000`,
    wait_time: `1-3 days`,
    growth: `+48% YoY`,
  },
];

// ============== HOSPITALS (8 new, 4 per city) ==============
const newHospitals = [
  // Guiyang (4)
  { city: `guiyang`, name: `Guizhou Provincial People's Hospital (贵州省人民医院)`, cn: `贵州省人民医院`, spec: `Oncology, Cardiology, Pulmonology, General Surgery, Nephrology`, addr: `83 East Zhongshan Road, Nanming District`, phone: `+86-851-8527-3111`, url: `http://www.gz5055.cn/`, order: 0 },
  { city: `guiyang`, name: `The Affiliated Hospital of Guizhou Medical University (贵州医科大学附属医院)`, cn: `贵州医科大学附属医院`, spec: `General Medicine, Oncology, Emergency Medicine, Infectious Diseases, Pulmonology`, addr: `28 Guiyi Street, Yunyan District`, phone: `+86-851-8677-3111`, url: `http://www.gmcah.cn/`, order: 1 },
  { city: `guiyang`, name: `Guiyang First People's Hospital (贵阳市第一人民医院)`, cn: `贵阳市第一人民医院`, spec: `Cardiology, Orthopedics, General Surgery, Nephrology, Endocrinology`, addr: `97 Bo'ai Road, Nanming District`, phone: `+86-851-8581-3333`, url: `http://www.gy1y.cn/`, order: 2 },
  { city: `guiyang`, name: `Guizhou Provincial Tumor Hospital (贵州省肿瘤医院)`, cn: `贵州省肿瘤医院`, spec: `Surgical Oncology, Medical Oncology, Radiation Oncology, Hematology, Pathology`, addr: `1 Beijing Road, Yunyan District`, phone: `+86-851-8651-1111`, url: `http://www.gzszlyy.cn/`, order: 3 },

  // Shijiazhuang (4)
  { city: `shijiazhuang`, name: `Hebei Medical University First Hospital (河北医科大学第一医院)`, cn: `河北医科大学第一医院`, spec: `General Medicine, Cardiology, Oncology, Nephrology, Hematology`, addr: `89 Donggang Road, Yuhua District`, phone: `+86-311-8591-7000`, url: `http://www.jyyy1.com/`, order: 0 },
  { city: `shijiazhuang`, name: `Hebei Provincial People's Hospital (河北省人民医院)`, cn: `河北省人民医院`, spec: `Cardiovascular Surgery, Oncology, Neurology, Endocrinology, General Surgery`, addr: `348 Heping West Road, Xinhua District`, phone: `+86-311-8598-9639`, url: `http://www.hbpphosp.cn/`, order: 1 },
  { city: `shijiazhuang`, name: `Hebei Eye Hospital (河北省眼科医院)`, cn: `河北省眼科医院`, spec: `Ophthalmology, Optometry, Retinal Surgery, Cataract Surgery, Glaucoma`, addr: `9 Tianshan Street, Qiaoxi District`, phone: `+86-311-8523-7890`, url: `http://www.hbeye.cn/`, order: 2 },
  { city: `shijiazhuang`, name: `The Second Hospital of Hebei Medical University (河北医科大学第二医院)`, cn: `河北医科大学第二医院`, spec: `General Medicine, Cardiology, Neurosurgery, Oncology, Pulmonology`, addr: `215 Heping West Road, Xinhua District`, phone: `+86-311-6600-2000`, url: `http://www.hb2h.com/`, order: 3 },
];

// ============== EXECUTE ==============
const insertCity = db.prepare(`
  INSERT OR IGNORE INTO cities (
    slug, name, chinese_name, region, population, intro,
    meta_title, meta_description, avg_cost, wait_time, growth, created_at
  ) VALUES (
    @slug, @name, @chinese_name, @region, @population, @intro,
    @meta_title, @meta_description, @avg_cost, @wait_time, @growth, @created_at
  )
`);
const insertHospital = db.prepare(`
  INSERT OR IGNORE INTO hospitals (
    city_slug, name, chinese_name, specialties, address, phone, url, type, sort_order, created_at
  ) VALUES (
    @city_slug, @name, @chinese_name, @specialties, @address, @phone, @url, 'hospital', @sort_order, @created_at
  )
`);

let cityCount = 0;
let hospCount = 0;

const tx = db.transaction(() => {
  for (const c of newCities) {
    const r = insertCity.run({ ...c, created_at: NOW });
    if (r.changes > 0) cityCount++;
  }
  for (const h of newHospitals) {
    const row = { city_slug: h.city, name: h.name, chinese_name: h.cn, specialties: h.spec, address: h.addr, phone: h.phone, url: h.url, sort_order: h.order, created_at: NOW };
    const r = insertHospital.run(row);
    if (r.changes > 0) hospCount++;
  }
});
tx();

console.log(`Cities inserted (new): ${cityCount}`);
console.log(`Hospitals inserted (new): ${hospCount}`);

const totalCities = db.prepare('SELECT COUNT(*) as c FROM cities').get().c;
const totalHospitals = db.prepare('SELECT COUNT(*) as c FROM hospitals').get().c;
console.log(`Total cities now: ${totalCities}`);
console.log(`Total hospitals now: ${totalHospitals}`);

db.close();
console.log('DONE.');
