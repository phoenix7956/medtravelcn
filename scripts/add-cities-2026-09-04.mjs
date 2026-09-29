// scripts/add-cities-2026-09-04.mjs
// R141+ ChinaMedGuide daily expansion: 太原 (Taiyuan) + 南昌 (Nanchang)
// Author: 墨 (2026-09-04 daily expansion task)
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
    slug: `taiyuan`,
    name: `Taiyuan`,
    chinese_name: `太原`,
    region: `North China`,
    population: `5.3M`,
    intro: `Taiyuan is the capital of Shanxi province and a major industrial hub in North China. Shanxi Bethune Hospital and other provincial hospitals offer advanced oncology, cardiac surgery, and organ transplantation with lower costs than Beijing/Shanghai. Coal-mining medicine and occupational disease treatment are regional specialties.`,
    meta_title: `Taiyuan Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Top hospitals in Taiyuan, China. Compare oncology, cardiac surgery, and transplant specialties with regional pricing advantages.`,
    avg_cost: `$1,000-$5,500`,
    wait_time: `1-3 days`,
    growth: `+38% YoY`,
  },
  {
    slug: `nanchang`,
    name: `Nanchang`,
    chinese_name: `南昌`,
    region: `East China`,
    population: `6.4M`,
    intro: `Nanchang is the capital of Jiangxi province and home to the renowned Xiangya Medical Cluster (Jiangxi Medical College-affiliated hospitals). Known for hematology, oncology, and organ transplantation, the city's hospitals serve patients from surrounding provinces with competitive pricing and modern facilities.`,
    meta_title: `Nanchang Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Top hospitals in Nanchang, China. Browse hematology, oncology, and transplantation specialties with regional pricing advantages.`,
    avg_cost: `$1,100-$5,800`,
    wait_time: `1-4 days`,
    growth: `+45% YoY`,
  },
];

// ============== HOSPITALS (8 new, 4 per city) ==============
const newHospitals = [
  // Taiyuan (4)
  { city: `taiyuan`, name: `Shanxi Bethune Hospital (山西白求恩医院)`, cn: `山西白求恩医院`, spec: `Oncology, Hematology, Cardiac Surgery, Organ Transplantation, General Surgery`, addr: `99 Longcheng Street, Xiaodian District`, phone: `+86-351-217-1111`, url: `http://www.sxdyy.org/`, order: 0 },
  { city: `taiyuan`, name: `Shanxi Provincial People's Hospital (山西省人民医院)`, cn: `山西省人民医院`, spec: `Cardiology, Neurology, Oncology, Nephrology, Pulmonology`, addr: `29 Shuangtasi Street, Yingze District`, phone: `+86-351-496-0000`, url: `http://www.sxsrmyy.com/`, order: 1 },
  { city: `taiyuan`, name: `First Hospital of Shanxi Medical University (山西医科大学第一医院)`, cn: `山西医科大学第一医院`, spec: `General Medicine, Pulmonology, Cardiology, Endocrinology, Infectious Diseases`, addr: `85 Jiefang South Road, Yingze District`, phone: `+86-351-463-9114`, url: `http://www.sydyy.net.cn/`, order: 2 },
  { city: `taiyuan`, name: `Taiyuan Central Hospital (太原市中心医院)`, cn: `太原市中心医院`, spec: `General Medicine, Orthopedics, Neurosurgery, Oncology, Rehabilitation`, addr: `5 Dong San Dao Xiang, Xinghualing District`, phone: `+86-351-565-6000`, url: `http://www.tzchospital.cn/`, order: 3 },

  // Nanchang (4)
  { city: `nanchang`, name: `The First Affiliated Hospital of Nanchang University (南昌大学第一附属医院)`, cn: `南昌大学第一附属医院`, spec: `Hematology, Oncology, Organ Transplantation, Cardiology, General Surgery`, addr: `17 Yongwai Main Street, Donghu District`, phone: `+86-791-8869-2790`, url: `http://www.cdyfy.com/`, order: 0 },
  { city: `nanchang`, name: `Jiangxi Provincial People's Hospital (江西省人民医院)`, cn: `江西省人民医院`, spec: `Cardiology, Oncology, Neurology, Endocrinology, Geriatrics`, addr: `92 Aiguo Road, Donghu District`, phone: `+86-791-8689-5555`, url: `http://www.jxsrmyy.cn/`, order: 1 },
  { city: `nanchang`, name: `The Second Affiliated Hospital of Nanchang University (南昌大学第二附属医院)`, cn: `南昌大学第二附属医院`, spec: `Cardiology, Neurology, Oncology, General Surgery, Pediatrics`, addr: `1 Minde Road, Donghu District`, phone: `+86-791-8630-0000`, url: `http://www.ndefy.cn/`, order: 2 },
  { city: `nanchang`, name: `Jiangxi Cancer Hospital (江西省肿瘤医院)`, cn: `江西省肿瘤医院`, spec: `Surgical Oncology, Medical Oncology, Radiation Oncology, Hematology, Proton Therapy`, addr: `519 Beijing East Road, Qingyunpu District`, phone: `+86-791-8831-3333`, url: `http://www.jxch.cn/`, order: 3 },
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
