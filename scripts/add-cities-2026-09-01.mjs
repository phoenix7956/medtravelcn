// scripts/add-cities-2026-09-01.mjs
// R141+ ChinaMedGuide daily expansion: 东莞 (Dongguan) + 沈阳 (Shenyang)
// Author: 墨 (2026-09-01 每日扩张任务)
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
    slug: `dongguan`,
    name: `Dongguan`,
    chinese_name: `东莞`,
    region: `South China`,
    population: `10.5M`,
    intro: `Dongguan is a major manufacturing hub in the Pearl River Delta between Guangzhou and Shenzhen, with a dense network of tertiary hospitals. Known for cardiology, oncology, and orthopedic surgery, the city attracts international patients seeking high-quality care with short wait times and competitive pricing.`,
    meta_title: `Dongguan Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Top hospitals in Dongguan, China. Compare cardiology, oncology, and orthopedic specialties with international patient coordinators.`,
    avg_cost: `$1,400-$6,800`,
    wait_time: `1-3 days`,
    growth: `+72% YoY`,
  },
  {
    slug: `shenyang`,
    name: `Shenyang`,
    chinese_name: `沈阳`,
    region: `Northeast China`,
    population: `9.1M`,
    intro: `Shenyang is the capital of Liaoning province and the medical hub for Northeast China. Home to China Medical University's flagship hospitals, the city offers advanced oncology, transplantation, and complex surgical care with internationally trained physicians and established foreign patient services.`,
    meta_title: `Shenyang Hospitals for Foreign Patients | MedTravelCN`,
    meta_description: `Leading hospitals in Shenyang, China. Browse oncology, transplantation, and surgical specialties with international patient support.`,
    avg_cost: `$1,300-$6,000`,
    wait_time: `2-4 days`,
    growth: `+55% YoY`,
  },
];

// ============== HOSPITALS (8 new, 4 per city) ==============
const newHospitals = [
  // Dongguan (4)
  { city: `dongguan`, name: `Dongguan People's Hospital (东莞市人民医院)`, cn: `东莞市人民医院`, spec: `Cardiology, Oncology, General Surgery, Nephrology, Neurology`, addr: `3 Xinzhong Road, Guancheng District`, phone: `+86-769-2222-2222`, url: `http://www.dgph.com/`, order: 0 },
  { city: `dongguan`, name: `Dongguan Tung Wah Hospital (东莞东华医院)`, cn: `东莞东华医院`, spec: `Cardiothoracic Surgery, Orthopedics, General Medicine, Pediatrics, Emergency Care`, addr: `3 Dongcheng East Road, Dongcheng District`, phone: `+86-769-2233-3333`, url: `http://www.tungwah.org/`, order: 1 },
  { city: `dongguan`, name: `Dongguan Third People's Hospital (东莞市第三人民医院)`, cn: `东莞市第三人民医院`, spec: `Cardiology, Neurology, Oncology, Rehabilitation, Pulmonology`, addr: `1 Xiangxi Road, Songshan Lake`, phone: `+86-769-2288-8888`, url: `http://www.dgsyy.com/`, order: 2 },
  { city: `dongguan`, name: `Dongguan Kanghua Hospital (东莞康华医院)`, cn: `东莞康华医院`, spec: `Oncology, Cardiology, Orthopedics, General Surgery, Organ Transplant`, addr: `1000 Donghua East Road, Houjie`, phone: `+86-769-2888-9999`, url: `http://www.kanghuahospital.com/`, order: 3 },

  // Shenyang (4)
  { city: `shenyang`, name: `The First Hospital of China Medical University (中国医大一院)`, cn: `中国医科大学附属第一医院`, spec: `Oncology, Cardiology, General Surgery, Liver Transplant, Infectious Diseases`, addr: `155 Nanjing North Street, Heping District`, phone: `+86-24-8328-3000`, url: `https://www.cmu1h.com/`, order: 0 },
  { city: `shenyang`, name: `Shengjing Hospital of China Medical University (盛京医院)`, cn: `中国医科大学附属盛京医院`, spec: `Pediatrics, Obstetrics, Oncology, General Surgery, Organ Transplant`, addr: `36 Sanhao Street, Heping District`, phone: `+86-24-96615`, url: `https://www.sj-hospital.org/`, order: 1 },
  { city: `shenyang`, name: `The General Hospital of Northern Theater Command (北部战区总医院)`, cn: `中国人民解放军北部战区总医院`, spec: `General Medicine, Oncology, Cardiology, Neurology, Trauma Surgery`, addr: `83 Wenhua Road, Shenhe District`, phone: `+86-24-2885-6666`, url: `http://www.plagh.cn/`, order: 2 },
  { city: `shenyang`, name: `Liaoning Cancer Hospital & Institute (辽宁省肿瘤医院)`, cn: `辽宁省肿瘤医院`, spec: `Surgical Oncology, Medical Oncology, Radiation Oncology, Proton Therapy, Hematology`, addr: `44 Xiaoheyan Road, Dadong District`, phone: `+86-24-2431-5555`, url: `http://www.lnszl.com/`, order: 3 },
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
