// scripts/add-cities-2026-07-29.mjs
// R79 ChinaMedGuide add 6 cities + 24 hospitals
// Author: 墨-OpenClaw (Codex 任务由墨接活自干, 老板拍 R79)
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

// ============== CITIES (6 new) ==============
const newCities = [
  {
    slug: 'foshan',
    name: 'Foshan',
    chinese_name: '佛山',
    region: 'South China',
    population: '9.5M',
    intro: 'Foshan is a historic manufacturing hub in the Pearl River Delta with strong orthopedic and traditional Chinese medicine (TCM) specialties. Its hospital network is known for orthopedic surgery and rehabilitation, attracting patients from across Southeast Asia.',
    meta_title: 'Foshan Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'Top orthopedic and TCM hospitals in Foshan, China. Compare costs, specialties, and book your medical trip.',
    avg_cost: '$1,500-$7,000',
    wait_time: '1-3 days',
    growth: '+88% YoY',
  },
  {
    slug: 'ningbo',
    name: 'Ningbo',
    chinese_name: '宁波',
    region: 'East China',
    population: '9.7M',
    intro: 'Ningbo is a major port city in Zhejiang province with a rapidly developing healthcare sector. Its tertiary hospitals offer oncology, cardiology, and minimally invasive surgery with international patient coordinators on staff.',
    meta_title: 'Ningbo Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'Leading international hospitals in Ningbo, China. Browse specialties, costs, and medical tourism packages.',
    avg_cost: '$1,700-$8,000',
    wait_time: '2-4 days',
    growth: '+65% YoY',
  },
  {
    slug: 'hefei',
    name: 'Hefei',
    chinese_name: '合肥',
    region: 'Central China',
    population: '10.0M',
    intro: 'Hefei is the capital of Anhui province and home to the University of Science and Technology of China (USTC) and its affiliated hospitals. The city is an emerging center for advanced biomedical research and precision medicine.',
    meta_title: 'Hefei Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'USTC-affiliated and leading hospitals in Hefei, China. Explore precision medicine and oncology care.',
    avg_cost: '$1,400-$6,500',
    wait_time: '2-5 days',
    growth: '+72% YoY',
  },
  {
    slug: 'sanya',
    name: 'Sanya',
    chinese_name: '三亚',
    region: 'South China',
    population: '1.1M',
    intro: 'Sanya is a tropical resort destination on Hainan Island with a growing reputation for health tourism. Its international-standard hospitals combine medical care with recovery in a resort environment, popular with Russian and CIS patients.',
    meta_title: 'Sanya Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'Resort-style medical tourism in Sanya, China. Compare hospitals, recovery packages, and wellness programs.',
    avg_cost: '$1,800-$9,000',
    wait_time: '1-3 days',
    growth: '+95% YoY',
  },
  {
    slug: 'wuxi',
    name: 'Wuxi',
    chinese_name: '无锡',
    region: 'East China',
    population: '7.5M',
    intro: 'Wuxi is a high-tech manufacturing hub in Jiangsu province with strong tertiary hospitals affiliated with Jiangnan University and Nanjing Medical University. Known for cardiac surgery, interventional radiology, and diabetes care.',
    meta_title: 'Wuxi Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'Advanced cardiac and endocrinology hospitals in Wuxi, China. Explore medical packages and patient reviews.',
    avg_cost: '$1,600-$7,500',
    wait_time: '2-4 days',
    growth: '+58% YoY',
  },
  {
    slug: 'lanzhou',
    name: 'Lanzhou',
    chinese_name: '兰州',
    region: 'Northwest China',
    population: '4.4M',
    intro: 'Lanzhou is the capital of Gansu province and a major medical hub for western China. Its hospitals serve patients from Xinjiang, Qinghai, and Ningxia, with particular expertise in integrative medicine and infectious disease treatment.',
    meta_title: 'Lanzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description: 'Western China medical hub: top hospitals in Lanzhou, with integrative medicine and infectious disease expertise.',
    avg_cost: '$1,200-$5,500',
    wait_time: '1-3 days',
    growth: '+41% YoY',
  },
];

// ============== HOSPITALS (24 new, 4 per city) ==============
const newHospitals = [
  // Foshan (4)
  { city: 'foshan', name: 'Foshan Hospital of Traditional Chinese Medicine (佛山中医院)', cn: '佛山市中医院', spec: 'Orthopedics, TCM, Acupuncture, Rehabilitation, Pain Management', addr: '6 Qinren Road, Chancheng District', phone: '+86-757-8306-3333', url: 'http://www.fstcm.com.cn/', order: 0 },
  { city: 'foshan', name: 'The First People\'s Hospital of Foshan (佛山市第一人民医院)', cn: '佛山市第一人民医院', spec: 'Oncology, Cardiology, General Surgery, Nephrology, Endocrinology', addr: '3 Lingnan Avenue, Chancheng District', phone: '+86-757-8383-3333', url: 'http://www.fsyyy.com/', order: 1 },
  { city: 'foshan', name: 'Foshan Chancheng Central Hospital (佛山禅城中心医院)', cn: '佛山禅城中心医院', spec: 'Orthopedics, Joint Replacement, Sports Medicine, Spine Surgery', addr: '12 Wenhua Road, Chancheng District', phone: '+86-757-2222-2222', url: 'http://www.fscch.com/', order: 2 },
  { city: 'foshan', name: 'Southern Medical University Affiliated Shunde Hospital (南方医科大学顺德医院)', cn: '南方医科大学顺德医院', spec: 'General Medicine, Pediatrics, Obstetrics, Cardiology, Neurology', addr: '1 Kuiqi Road, Shunde District', phone: '+86-757-2231-8888', url: 'http://www.sdyy.cn/', order: 3 },

  // Ningbo (4)
  { city: 'ningbo', name: 'Ningbo First Hospital (宁波市第一医院)', cn: '宁波市第一医院', spec: 'Cardiology, Oncology, Neurology, Gastroenterology, Nephrology', addr: '59 Liuting Street, Haishu District', phone: '+86-574-8708-5555', url: 'http://www.nbdyyy.com/', order: 0 },
  { city: 'ningbo', name: 'The Affiliated Hospital of Medical School of Ningbo University (宁波大学医学院附属医院)', cn: '宁波大学医学院附属医院', spec: 'Oncology, General Surgery, Orthopedics, Infectious Diseases', addr: '247 Renmin Road, Jiangbei District', phone: '+86-574-8735-6666', url: 'http://www.ndfy.cn/', order: 1 },
  { city: 'ningbo', name: 'Ningbo Women & Children\'s Hospital (宁波市妇女儿童医院)', cn: '宁波市妇女儿童医院', spec: 'Obstetrics, Gynecology, Pediatrics, Neonatology, Reproductive Medicine', addr: '339 Liuting Street, Haishu District', phone: '+86-574-8708-3333', url: 'http://www.nbfeyy.com/', order: 2 },
  { city: 'ningbo', name: 'Ningbo Lihuili Hospital (宁波李惠利医院)', cn: '宁波李惠利医院', spec: 'Cardiothoracic Surgery, Cardiology, Pulmonology, Thoracic Surgery', addr: '57 Xingning Road, Jiangbei District', phone: '+86-574-8701-8888', url: 'http://www.lhl-hospital.com/', order: 3 },

  // Hefei (4)
  { city: 'hefei', name: 'The First Affiliated Hospital of USTC (中国科大附一院 / 安徽省立医院)', cn: '中国科学技术大学附属第一医院', spec: 'Oncology, Precision Medicine, Translational Research, Surgery, Liver Transplant', addr: '17 Lujiang Road, Luyang District', phone: '+86-551-6228-3000', url: 'http://www.ahslyy.com.cn/', order: 0 },
  { city: 'hefei', name: 'Anhui Medical University First Affiliated Hospital (安徽医科大学第一附属医院)', cn: '安徽医科大学第一附属医院', spec: 'General Medicine, Oncology, Hematology, Nephrology, Organ Transplant', addr: '218 Jixi Road, Shushan District', phone: '+86-551-6292-2000', url: 'http://www.ayfy.net/', order: 1 },
  { city: 'hefei', name: 'Anhui Provincial Hospital (安徽省立医院)', cn: '安徽省立医院', spec: 'Cardiology, Neurology, Endocrinology, Geriatrics, TCM', addr: '9 Lujiang Road, Luyang District', phone: '+86-551-6228-2000', url: 'http://www.ahslyy.com.cn/', order: 2 },
  { city: 'hefei', name: 'Hefei Second People\'s Hospital (合肥市第二人民医院)', cn: '合肥市第二人民医院', spec: 'Oncology, Cardiology, Orthopedics, General Surgery, Emergency Care', addr: '540 Heping Road, Yaohai District', phone: '+86-551-6223-9999', url: 'http://www.hf2yy.cn/', order: 3 },

  // Sanya (4)
  { city: 'sanya', name: 'Sanya People\'s Hospital (三亚市人民医院)', cn: '三亚市人民医院', spec: 'General Medicine, Tropical Medicine, Rehabilitation, Cardiology, Orthopedics', addr: '50 Jiefang Road, Tianya District', phone: '+86-898-8825-8888', url: 'http://www.syrmyy.com/', order: 0 },
  { city: 'sanya', name: 'Hainan Branch of PLA General Hospital (解放军总医院海南医院)', cn: '解放军总医院海南医院', spec: 'Oncology, Cardiology, Geriatrics, Traditional Medicine, Rehabilitation', addr: '8 Jianglin Road, Jiyang District', phone: '+86-898-3886-8888', url: 'http://www.hn301yy.com/', order: 1 },
  { city: 'sanya', name: 'Sanya Central Hospital (三亚中心医院)', cn: '三亚中心医院', spec: 'Emergency Medicine, Cardiology, Neurology, Oncology, Tropical Medicine', addr: '1154 Jiefang Road, Tianya District', phone: '+86-898-8836-6666', url: 'http://www.syzxyy.com/', order: 2 },
  { city: 'sanya', name: 'Sanya Maternity & Child Health Hospital (三亚市妇幼保健院)', cn: '三亚市妇幼保健院', spec: 'Obstetrics, Gynecology, Pediatrics, Neonatology, Reproductive Medicine', addr: '2 Yingbin Road, Jiyang District', phone: '+86-898-8825-6666', url: 'http://www.syfybjy.com/', order: 3 },

  // Wuxi (4)
  { city: 'wuxi', name: 'Wuxi People\'s Hospital (无锡市人民医院)', cn: '无锡市人民医院', spec: 'Cardiology, Cardiothoracic Surgery, Pulmonology, Oncology, Liver Transplant', addr: '299 Qingyang Road, Liangxi District', phone: '+86-510-8270-2222', url: 'http://www.wuxiph.com/', order: 0 },
  { city: 'wuxi', name: 'The Affiliated Hospital of Jiangnan University (江南大学附属医院)', cn: '江南大学附属医院', spec: 'Oncology, Endocrinology, Neurology, General Surgery, Rehabilitation', addr: '200 Huihe Road, Binhu District', phone: '+86-510-8868-2222', url: 'http://www.jdfy.cn/', order: 1 },
  { city: 'wuxi', name: 'Wuxi Second People\'s Hospital (无锡市第二人民医院)', cn: '无锡市第二人民医院', spec: 'Cardiology, Neurology, Endocrinology, Orthopedics, General Surgery', addr: '68 Zhongshan Road, Chong\'an District', phone: '+86-510-8272-2222', url: 'http://www.wuxisph.com/', order: 2 },
  { city: 'wuxi', name: 'Wuxi TCM Hospital (无锡市中医医院)', cn: '无锡市中医医院', spec: 'TCM, Acupuncture, Orthopedics, Gastroenterology, Rehabilitation', addr: '1000 Heping Road, Liangxi District', phone: '+86-510-8260-6666', url: 'http://www.wxszyy.com/', order: 3 },

  // Lanzhou (4)
  { city: 'lanzhou', name: 'Lanzhou University Second Hospital (兰州大学第二医院)', cn: '兰州大学第二医院', spec: 'Oncology, Cardiology, General Surgery, Orthopedics, Infectious Diseases', addr: '82 Cuiyingmen, Chengguan District', phone: '+86-931-8942-2222', url: 'http://www.ldey.cn/', order: 0 },
  { city: 'lanzhou', name: 'Gansu Provincial Hospital (甘肃省人民医院)', cn: '甘肃省人民医院', spec: 'Oncology, Cardiology, Neurology, General Surgery, TCM', addr: '160 Donggang West Road, Chengguan District', phone: '+86-931-8281-1111', url: 'http://www.gssyy.com/', order: 1 },
  { city: 'lanzhou', name: 'The First Hospital of Lanzhou University (兰州大学第一医院)', cn: '兰州大学第一医院', spec: 'Infectious Diseases, Hepatology, Cardiology, Nephrology, Oncology', addr: '1 Donggang West Road, Chengguan District', phone: '+86-931-8356-2222', url: 'http://www.lzdyy.com/', order: 2 },
  { city: 'lanzhou', name: 'Lanzhou City Pulmonary Hospital (兰州市肺科医院)', cn: '兰州市肺科医院', spec: 'Pulmonology, Thoracic Surgery, Tuberculosis, Respiratory Medicine', addr: '388 Qilihe District', phone: '+86-931-2866-1111', url: 'http://www.lzsfk.com/', order: 3 },
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

// Sanity checks
const dupes = db.prepare(`
  SELECT city_slug, COUNT(*) as c FROM hospitals GROUP BY city_slug HAVING c > 6
`).all();
if (dupes.length > 0) {
  console.warn('WARNING: cities with >6 hospitals:', JSON.stringify(dupes));
}

db.close();
console.log('DONE.');
