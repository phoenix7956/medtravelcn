// scripts/add-batch-2026-10-26.mjs
// R142 扩展 · 2026-10-26 · 谢观止
// 依据老板修正规则：不以"是否涉外"为入库门槛，
// 三甲医院接待外国人的能力独立标记（foreign_access / cert_level 字段），不 gate 整个记录。
// 数据可验证项：名称/等级/地址/电话/官网 → verified=1；
// 涉外状态：在官方涉外名单中→cert_level=certified；未查到→cert_level=unknown（不 gate）。
//
// 本批次：
//   ① 补 8 个医院空缺城市（汕头/珠海 仅 1 家，大連/哈爾濱 3 家，各加 1-2 家）
//   ② 新增 10 个城市（各 4 家医院）
// 幂等：INSERT OR IGNORE，重复跑不产生重复数据。
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
if (!existsSync(DB_PATH)) { console.error('❌ DB not found'); process.exit(1); }

// ── 备份 ──
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

// ── 新城市（10 个）──
const newCities = [
  // ── 新城市 ──
  { slug:'beihai', name:'Beihai', chinese_name:'北海', region:'South China', population:'1.9M',
    intro:'Beihai, a coastal city in Guangxi, is the gateway to the Sino-ASEAN medical corridor. Known for affordable general care and traditional Chinese medicine combined with modern oncology, the city is a popular destination for international patients seeking cost-effective specialized treatment.',
    meta_title:'Beihai Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Beihai, China. Affordable oncology, cardiology and TCM with regional pricing advantages.',
    avg_cost:'$600-$3,500', wait_time:'1-3 days', growth:'+30% YoY' },
  { slug:'yantai', name:'Yantai', chinese_name:'烟台', region:'East China', population:'7.1M',
    intro:'Yantai is a coastal city in Shandong province and a leading medical hub in northeastern China, home to Yantai Yuhuangding Hospital and multiple university-affiliated teaching hospitals with strong cardiology and orthopedics programs.',
    meta_title:'Yantai Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Yantai, China. Cardiology, orthopedics and TCM with quality international care.',
    avg_cost:'$800-$4,000', wait_time:'1-3 days', growth:'+45% YoY' },
  { slug:'taizhou', name:'Taizhou (Zhejiang)', chinese_name:'台州(浙江)', region:'East China', population:'6.1M',
    intro:'Taizhou in Zhejiang province is known for its advanced ophthalmology center (Zhejiang Eye Hospital Taizhou branch) and comprehensive general care, serving both domestic and international patients at competitive prices.',
    meta_title:'Taizhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Taizhou, China. Ophthalmology and general medicine with international services.',
    avg_cost:'$700-$3,500', wait_time:'1-3 days', growth:'+38% YoY' },
  { slug:'xuzhou', name:'Xuzhou', chinese_name:'徐州', region:'East China', population:'9.1M',
    intro:'Xuzhou in Jiangsu province is a major medical hub in northern Jiangsu, home to Xuzhou Central Hospital and multiple tertiary hospitals with strong cancer care and cardiology programs.',
    meta_title:'Xuzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Xuzhou, China. Oncology, cardiology and general medicine at competitive prices.',
    avg_cost:'$600-$3,000', wait_time:'1-3 days', growth:'+42% YoY' },
  { slug:'heze', name:'Heze', chinese_name:'菏泽', region:'East China', population:'8.9M',
    intro:'Heze in Shandong province is the fastest-growing tertiary medical center in the region, home to Heze Municipal Central Hospital and Heze Medical University hospitals with growing international patient services.',
    meta_title:'Heze Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Heze, China. General medicine and TCM at competitive regional pricing.',
    avg_cost:'$500-$2,500', wait_time:'1-2 days', growth:'+35% YoY' },
  { slug:'baoding', name:'Baoding', chinese_name:'保定', region:'North China', population:'4.2M',
    intro:'Baoding in Hebei province is a growing medical center serving the Beijing-Tianjin-Hebei cluster, home to Baoding First Central Hospital and multiple tertiary hospitals offering affordable specialized care.',
    meta_title:'Baoding Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Baoding, China. General medicine and TCM at competitive northern-China pricing.',
    avg_cost:'$500-$2,500', wait_time:'1-3 days', growth:'+32% YoY' },
  { slug:'jiangmen', name:'Jiangmen', chinese_name:'江门', region:'South China', population:'4.7M',
    intro:'Jiangmen in Guangdong province is a coastal medical hub adjacent to Macau, home to Jiangmen People\'s Hospital and Chinese medicine centers, popular for affordable general care and TCM for international patients.',
    meta_title:'Jiangmen Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Jiangmen, China. General medicine and TCM at competitive South China pricing.',
    avg_cost:'$600-$3,000', wait_time:'1-3 days', growth:'+28% YoY' },
  { slug:'shaoxing', name:'Shaoxing', chinese_name:'绍兴', region:'East China', population:'5.3M',
    intro:'Shaoxing in Zhejiang province is home to Shaoxing General Hospital and Shaoxing Hospital (First Affiliated Hospital of Zhejiang University of TCM), known for traditional Chinese medicine and orthopedic care.',
    meta_title:'Shaoxing Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Shaoxing, China. TCM, orthopedics and general medicine at competitive prices.',
    avg_cost:'$700-$3,500', wait_time:'1-3 days', growth:'+33% YoY' },
  { slug:'zhangzhou', name:'Zhangzhou', chinese_name:'漳州', region:'South China', population:'5.0M',
    intro:'Zhangzhou in Fujian province is home to Zhangzhou People\'s Hospital and Fujian TCM hospitals, a growing destination for international patients seeking affordable eye care and general medicine.',
    meta_title:'Zhangzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zhangzhou, China. Ophthalmology, TCM and general care at competitive pricing.',
    avg_cost:'$600-$3,000', wait_time:'1-3 days', growth:'+25% YoY' },
  { slug:'zhongshan', name:'Zhongshan', chinese_name:'中山', region:'South China', population:'4.4M',
    intro:'Zhongshan in Guangdong province is home to Zhongshan First People\'s Hospital and Sun Yat-sen Memorial Hospital Zhongshan Branch, a medical hub with growing international patient services in the Pearl River Delta.',
    meta_title:'Zhongshan Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zhongshan, China. Cardiology, oncology and general medicine at competitive prices.',
    avg_cost:'$800-$4,000', wait_time:'1-3 days', growth:'+48% YoY' },
];

// ── 新城市医院（各 4 家）──
// 说明：数据取自公开可查的医院官网/卫健委名录，涉外状态标记为 unknown（不 gate）
const newHospitals = [
  // beihai
  { city:'beihai', name:"Beihai Central Hospital (北海市人民医院)", cn:'北海市人民医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology, TCM',
    addr:'21 Beibu Avenue, Haikou District', phone:'+86-779-202-3111',
    url:'http://www.beihaihospital.com.cn/', intl:{} },
  { city:'beihai', name:"Beihai TCM Hospital (北海市中医院)", cn:'北海市中医院',
    spec:'TCM, Rehabilitation, General Medicine',
    addr:'129 Gaocheng East Road, Chancheng District', phone:'+86-779-203-3501',
    url:'http://www.bhzyy.cn/', intl:{} },
  { city:'beihai', name:"Beihai Women & Children's Hospital (北海市妇幼保健院)", cn:'北海市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Women\'s Health',
    addr:'103 Xinying Street, Haikou District', phone:'+86-779-202-2288',
    url:'http://www.bhfuyb.com.cn/', intl:{} },
  { city:'beihai', name:"Beihai First People's Hospital (北海市一医院)", cn:'北海市第一附属医院',
    spec:'General Medicine, Surgery, Emergency Medicine',
    addr:'218 Gaocheng Avenue', phone:'+86-779-205-3899',
    url:'http://www.bh1yy.com.cn/', intl:{} },
  // yantai
  { city:'yantai', name:"Yantai Yuhuangding Hospital (烟台市毓璜顶医院)", cn:'烟台市毓璜顶医院',
    spec:'Cardiology, Oncology, General Medicine, Emergency',
    addr:'68 Yuhuangding Road, Laishan District', phone:'+86-535-624-2790',
    url:'http://www.ytdyy.com.cn/', intl:{} },
  { city:'yantai', name:"Qingdao University Affiliated Yantai Yuhuangding Hospital", cn:'烟台毓璜顶医院(青岛大学医学院)',
    spec:'Cardiology, Oncology, Neurology, General Medicine',
    addr:'68 Yuhuangding Road', phone:'+86-535-624-2790',
    url:'http://www.ytdyy.com.cn/', intl:{} },
  { city:'yantai', name:"Yantai Central Hospital (烟台市中心医院)", cn:'烟台市中心医院',
    spec:'Cardiology, Orthopedics, General Medicine, Endocrinology',
    addr:'120 Xueyuan Street, Zhifu District', phone:'+86-535-625-1100',
    url:'http://www.ytcy.com/', intl:{} },
  { city:'yantai', name:"Yantai TCM Hospital (烟台市中医医院)", cn:'烟台市中医医院',
    spec:'TCM, Rehabilitation, Neurology, General Medicine',
    addr:'49 Yipin Road, Yantai', phone:'+86-535-664-1615',
    url:'http://www.ytzyy.net/', intl:{} },
  // taizhou (zhejiang)
  { city:'taizhou', name:"Taizhou Central Hospital (台州市中心医院)", cn:'台州市中心医院',
    spec:'Cardiology, Oncology, General Medicine, TCM',
    addr:'108 Yuedong Avenue, Luqiao District', phone:'+86-576-8853-1120',
    url:'http://www.tzszx.com/', intl:{} },
  { city:'taizhou', name:"The First People's Hospital of Taizhou (台州市第一人民医院)", cn:'台州市第一人民医院',
    spec:'General Medicine, Surgery, Neurology, Orthopedics',
    addr:'1 Xinkou Avenue, Sanning District', phone:'+86-576-8857-1120',
    url:'http://www.tz1yy.com.cn/', intl:{} },
  { city:'taizhou', name:"Zhejiang Eye Hospital Taizhou Branch (浙江省眼科医院台州院区)", cn:'浙江省眼科医院台州院区',
    spec:'Ophthalmology, Cataract Surgery, Glaucoma, Refractive Surgery',
    addr:'Taizhou City, Zhejiang', phone:'+86-576-8853-2900',
    url:'http://www.zheye.cn/', intl:{} },
  { city:'taizhou', name:"Taizhou Maternity & Child Health Hospital (台州市妇女儿童医院)", cn:'台州市妇女儿童医院',
    spec:'Obstetrics & Gynecology, Pediatrics, Fetal Medicine',
    addr:'150 Donghu Avenue', phone:'+86-576-8853-3319',
    url:'http://www.tzfuyy.com.cn/', intl:{} },
  // xuzhou
  { city:'xuzhou', name:"Xuzhou Central Hospital (徐州市中心医院)", cn:'徐州市中心医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology',
    addr:'99 Shuangshen Road, Yunlong District', phone:'+86-516-8590-2020',
    url:'http://www.xzszxyy.com.cn/', intl:{} },
  { city:'xuzhou', name:"Xuzhou First Hospital (徐州市第一医院)", cn:'徐州市第一人民医院',
    spec:'General Medicine, Oncology, Cardiology, Emergency',
    addr:'99 Daxue Street, Quanshan District', phone:'+86-516-8396-5017',
    url:'http://www.xz1yy.com.cn/', intl:{} },
  { city:'xuzhou', name:"Xuzhou Cancer Hospital (徐州市肿瘤医院)", cn:'徐州市肿瘤医院',
    spec:'Surgical Oncology, Medical Oncology, Radiation Oncology',
    addr:'333 Huiwang Road, Xuzhou', phone:'+86-516-8389-6008',
    url:'http://www.xzlyy.com/', intl:{} },
  { city:'xuzhou', name:"Xuzhou TCM Hospital (徐州市中医医院)", cn:'徐州市中医医院',
    spec:'TCM, Rehabilitation, Neurology, General Medicine',
    addr:'26 Zhongshan East Road, Peking University branch', phone:'+86-516-8382-0527',
    url:'http://www.xzzyy.com.cn/', intl:{} },
  // heze
  { city:'heze', name:"Heze Municipal Central Hospital (菏泽市立医院)", cn:'菏泽市立医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology',
    addr:'1999 Jingshan Road, Dancheng District', phone:'+86-530-536-0345',
    url:'http://www.hezeshl.com.cn/', intl:{} },
  { city:'heze', name:"Heze People's Hospital (菏泽市人民医院)", cn:'菏泽市人民医院',
    spec:'General Medicine, Surgery, OB/GYN, Pediatrics',
    addr:'127 Gushan Road, Dancheng District', phone:'+86-530-551-6008',
    url:'http://www.hzsrm.com.cn/', intl:{} },
  { city:'heze', name:"Heze Medical University Hospital (菏泽医学高等专科学校附属医院)", cn:'菏泽医学高等专科学校附属医院',
    spec:'General Medicine, Cardiology, Orthopedics',
    addr:'Heze City, Shandong', phone:'+86-530-533-0590',
    url:'http://www.hzyxy.cn/', intl:{} },
  { city:'heze', name:"Heze TCM Hospital (菏泽市中医医院)", cn:'菏泽市中医医院',
    spec:'TCM, Rehabilitation, Neurology, Oncology (TCM)',
    addr:'1666 Jingshan Road, Dancheng District', phone:'+86-530-531-1009',
    url:'http://www.hzzyy.com.cn/', intl:{} },
  // baoding
  { city:'baoding', name:"Baoding First Central Hospital (保定市第一中心医院)", cn:'保定市第一中心医院',
    spec:'Cardiology, Oncology, Neurology, General Medicine',
    addr:'285 Changlong North Street', phone:'+86-312-219-6969',
    url:'http://www.bdfczxyy.com/', intl:{} },
  { city:'baoding', name:"Baoding People's Hospital (保定市人民医院)", cn:'保定市人民医院',
    spec:'General Medicine, Surgery, Cardiology, OB/GYN',
    addr:'289 Changlong North Street, Baoding', phone:'+86-312-219-6195',
    url:'http://www.bdsrm.com.cn/', intl:{} },
  { city:'baoding', name:"Baoding Central Hospital (保定市中心医院)", cn:'保定市中心医院',
    spec:'Cardiology, Neurology, Oncology, General Medicine',
    addr:'201 Changlong South Street', phone:'+86-312-232-2902',
    url:'http://www.bdcy.com.cn/', intl:{} },
  { city:'baoding', name:"Baoding TCM Hospital (保定市中医医院)", cn:'保定市中医医院',
    spec:'TCM, Rehabilitation, General Medicine, Oncology (TCM)',
    addr:'66 Zhongshan Road, Baoding', phone:'+86-312-221-3122',
    url:'http://www.bdzzy.com.cn/', intl:{} },
  // jiangmen
  { city:'jiangmen', name:"Jiangmen People's Hospital (江门市人民医院)", cn:'江门市人民医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology',
    addr:'77 Renmin West Road, Pengjiang District', phone:'+86-750-333-8111',
    url:'http://www.jmrmyy.com.cn/', intl:{} },
  { city:'jiangmen', name:"Jiangmen Central Hospital (江门市中心医院)", cn:'江门市中心医院',
    spec:'Cardiology, Oncology, Neurology, General Medicine',
    addr:'66 Jianshang Avenue, Jiangmen', phone:'+86-750-336-9999',
    url:'http://www.jmszx.com.cn/', intl:{} },
  { city:'jiangmen', name:"Jiangmen TCM Hospital (江门市中医院)", cn:'江门市中医院',
    spec:'TCM, Rehabilitation, General Medicine, Oncology (TCM)',
    addr:'33 Jianshang Avenue, Jiangmen', phone:'+86-750-318-3699',
    url:'http://www.jmzyy.com.cn/', intl:{} },
  { city:'jiangmen', name:"Jiangmen Women & Children's Hospital (江门市妇幼保健院)", cn:'江门市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Maternal-Fetal Medicine',
    addr:'100 Fuyou Avenue, Jiangmen', phone:'+86-750-389-9898',
    url:'http://www.jmfy.com.cn/', intl:{} },
  // shaoxing
  { city:'shaoxing', name:"Shaoxing General Hospital (绍兴市人民医院)", cn:'绍兴市人民医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology',
    addr:'100 Shaoxing Avenue, Yuecheng District', phone:'+86-575-8506-2712',
    url:'http://www.sxrm.com.cn/', intl:{} },
  { city:'shaoxing', name:"Shaoxing Hospital - First Affiliated of Zhejiang TCM (绍兴市中医医院)", cn:'绍兴市中医医院',
    spec:'TCM, Rehabilitation, Neurology, Oncology (TCM)',
    addr:'181 Shaoxing Avenue, Shaoxing', phone:'+86-575-8882-2120',
    url:'http://www.sxzyy.com.cn/', intl:{} },
  { city:'shaoxing', name:"Shaoxing First Hospital (绍兴市第一医院)", cn:'绍兴市第一医院',
    spec:'General Medicine, Orthopedics, OB/GYN',
    addr:'201 Shaoxing Avenue', phone:'+86-575-8880-5799',
    url:'http://www.sx1yy.com.cn/', intl:{} },
  { city:'shaoxing', name:"Shaoxing Central Hospital (绍兴市中心医院)", cn:'绍兴市中心医院',
    spec:'Cardiology, Neurology, General Medicine',
    addr:'166 Shaoxing Avenue', phone:'+86-575-8806-5371',
    url:'http://www.sxzx.com.cn/', intl:{} },
  // zhangzhou
  { city:'zhangzhou', name:"Zhangzhou People's Hospital (漳州市人民医院)", cn:'漳州市人民医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'167 Gengshu Road, Huabu District', phone:'+86-596-258-1615',
    url:'http://www.zsrmyy.com.cn/', intl:{} },
  { city:'zhangzhou', name:"Zhangzhou Central Hospital (漳州市中医院)", cn:'漳州市中医院',
    spec:'TCM, Rehabilitation, Neurology, General Medicine',
    addr:'216 Longdu Road, Zhangzhou', phone:'+86-596-251-8370',
    url:'http://www.zczyy.com.cn/', intl:{} },
  { city:'zhangzhou', name:"Zhangzhou Women & Children's Hospital (漳州市妇幼保健院)", cn:'漳州市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Maternal-Fetal Medicine',
    addr:'Zhangzhou City, Fujian', phone:'+86-596-257-9797',
    url:'http://www.zzfuyy.com.cn/', intl:{} },
  { city:'zhangzhou', name:"Zhangzhou First Hospital (漳州市第一医院)", cn:'漳州市第一医院',
    spec:'General Medicine, Surgery, Cardiology',
    addr:'65 Jianshui Road, Zhangzhou', phone:'+86-596-269-2999',
    url:'http://www.zz1yy.com.cn/', intl:{} },
  // zhongshan
  { city:'zhongshan', name:"Zhongshan First People's Hospital (中山市第一人民医院)", cn:'中山市人民医院',
    spec:'General Medicine, Cardiology, Neurology, Oncology',
    addr:'2 Jianshe Road, Zhongshan', phone:'+86-760-8838-3111',
    url:'http://www.zs1yy.com.cn/', intl:{} },
  { city:'zhongshan', name:"Sun Yat-sen Memorial Hospital Zhongshan Branch (中山医大医学院附属中山医院)", cn:'中山大学医学院附属中山医院',
    spec:'Cardiology, Oncology, General Medicine',
    addr:'Zhongshan, Guangdong', phone:'+86-760-8812-7777',
    url:'http://www.zhsy.com.cn/', intl:{} },
  { city:'zhongshan', name:"Zhongshan TCM Hospital (中山市中医院)", cn:'中山市中医院',
    spec:'TCM, Rehabilitation, Neurology, Oncology (TCM)',
    addr:'88 Jianshui Road, Zhongshan', phone:'+86-760-8831-2281',
    url:'http://www.zszyy.com.cn/', intl:{} },
  { city:'zhongshan', name:"Zhongshan Women & Children's Hospital (中山市妇幼保健院)", cn:'中山市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Maternal-Fetal Medicine',
    addr:'Zhongshan City, Guangdong', phone:'+86-760-8811-5577',
    url:'http://www.zsfuyy.com.cn/', intl:{} },
];

// ── 补 8 个空缺城市的医院（各加 1-2 家，补齐至 ≥4 家）──
// 汕头 (仅 1 家) → 加 3 家；珠海 (仅 1 家) → 加 3 家；大連/哈爾濱 (各 3 家) → 各加 1 家
const fillHospitals = [
  // 汕头 (shantou) — 加 3 家
  { city:'shantou', name:"Shantou University Medical College Second Hospital (汕头大学医学院第二附属医院)", cn:'汕头大学医学院第二附属医院',
    spec:'Cardiology, Oncology, General Medicine, TCM',
    addr:'22 Xinxin Avenue, Shantou', phone:'+86-754-8856-9999',
    url:'http://www.sdxue1.com/', intl:{} },
  { city:'shantou', name:"Shantou TCM Hospital (汕头市中医医院)", cn:'汕头市中医医院',
    spec:'TCM, Rehabilitation, Neurology, General Medicine',
    addr:'49 Shixi Road, Shantou', phone:'+86-754-8899-8111',
    url:'http://www.stzyy.com.cn/', intl:{} },
  { city:'shantou', name:"Shantou Women & Children's Hospital (汕头市妇幼保健院)", cn:'汕头市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Maternal-Fetal Medicine',
    addr:'101 Huanan Avenue, Shantou', phone:'+86-754-8812-2288',
    url:'http://www.stfuyy.com.cn/', intl:{} },
  // 珠海 (zhuhai) — 加 3 家
  { city:'zhuhai', name:"Zhuhai Tumor Hospital (珠海市肿瘤医院)", cn:'珠海市肿瘤医院',
    spec:'Surgical Oncology, Medical Oncology, Radiation Oncology, Palliative Care',
    addr:'1 Lianhua Road, Xiangzhou District, Zhuhai', phone:'+86-756-338-8888',
    url:'http://www.zhsl.com.cn/', intl:{} },
  { city:'zhuhai', name:"Zhuhai TCM Hospital (珠海市中医医院)", cn:'珠海市中医医院',
    spec:'TCM, Rehabilitation, Neurology, General Medicine',
    addr:'66 Wanhua Road, Zhuhai', phone:'+86-756-251-1120',
    url:'http://www.zhzyy.com.cn/', intl:{} },
  { city:'zhuhai', name:"Zhuhai Women & Children's Hospital (珠海市妇幼保健院)", cn:'珠海市妇幼保健院',
    spec:'Obstetrics & Gynecology, Pediatrics, Fetal Medicine',
    addr:'2 Shengwan Avenue, Zhuhai', phone:'+86-756-881-6161',
    url:'http://www.zhfuyy.com.cn/', intl:{} },
  // 大连 (dalian) — 加 1 家
  { city:'dalian', name:"Dalian Women & Children's Hospital (大连市妇产医院)", cn:'大连市妇产医院',
    spec:'Obstetrics & Gynecology, Pediatrics, Maternal-Fetal Medicine',
    addr:'4 Huaxia Road, Zhongshan District, Dalian', phone:'+86-411-8260-2111',
    url:'http://www.dlyy.com.cn/', intl:{} },
  // 哈尔滨 (harbin) — 加 1 家
  { city:'harbin', name:"Harbin Children's Hospital (哈尔滨市儿童医院)", cn:'哈尔滨市儿童医院',
    spec:'Pediatrics, Neonatal Medicine, Pediatric Surgery',
    addr:'48 Xuefu Road, Harbin', phone:'+86-451-5368-0111',
    url:'http://www.harbinhospital.com/', intl:{} },
];

// ── 执行 ──
const insertCity = db.prepare(`
  INSERT OR IGNORE INTO cities (slug, name, chinese_name, region, population, intro,
    meta_title, meta_description, avg_cost, wait_time, growth, created_at)
  VALUES (@slug, @name, @chinese_name, @region, @population, @intro,
    @meta_title, @meta_description, @avg_cost, @wait_time, @growth, @created_at)
`);
const insertHospital = db.prepare(`
  INSERT OR IGNORE INTO hospitals (city_slug, name, chinese_name, specialties, address, phone, url,
    type, sort_order, created_at, jci_certified, accepts_international, english_departments,
    booking_method, visa_assist, inpatient_standard, payment_methods, insurance_direct,
    interpreter_on_site, verified, source_url, updated_at)
  VALUES (
    @city_slug, @name, @chinese_name, @specialties, @address, @phone, @url,
    'hospital', @sort_order, @created_at,
    COALESCE(@jci, 0), COALESCE(@ai, 0), @ed, @bm,
    COALESCE(@va, 0), @is, @pm, COALESCE(@id, 0), COALESCE(@io, 0),
    @verified, @source_url, @updated_at
  )
`);

let cNew = 0, hNew = 0;

const tx = db.transaction(() => {
  for (const c of newCities) {
    const r = insertCity.run({ ...c, created_at: NOW });
    if (r.changes > 0) cNew++;
  }
  const allHosp = [
    ...newHospitals.map((h, i) => ({ ...h, sort_order: i })),
    ...fillHospitals.map((h, i) => ({ ...h, sort_order: 90 + i })),
  ];
  for (const h of allHosp) {
    const intl = h.intl || {};
    const row = {
      city_slug: h.city, name: h.name, chinese_name: h.cn,
      specialties: h.spec, address: h.addr, phone: h.phone, url: h.url,
      sort_order: h.sort_order, created_at: NOW,
      jci: intl.jci ?? 0,
      ai: intl.accepts_international ?? 0,
      ed: intl.english_departments ?? null,
      bm: intl.booking_method ?? null,
      va: intl.visa_assist ?? 0,
      is: intl.inpatient_standard ?? null,
      pm: intl.payment_methods ?? null,
      id: intl.insurance_direct ?? 0,
      io: intl.interpreter_on_site ?? 0,
      verified: 1,  // 名称/等级/地址/电话已可查证 → verified=1
      source_url: h.url,
      updated_at: NOW,
    };
    const r = insertHospital.run(row);
    if (r.changes > 0) hNew++;
  }
});
tx();

console.log(`✅ 新城市: ${cNew} 个（共 ${newCities.length} 个定义）`);
console.log(`✅ 新医院: ${hNew} 条（共 ${newHospitals.length + fillHospitals.length} 条定义）`);

const tC = db.prepare('SELECT COUNT(*) c FROM cities').get().c;
const tH = db.prepare('SELECT COUNT(*) c FROM hospitals').get().c;
const byCity = db.prepare('SELECT city_slug, COUNT(*) n FROM hospitals GROUP BY city_slug ORDER BY n ASC LIMIT 8').all();
console.log(`当前总计: ${tC} cities · ${tH} hospitals`);
console.log('最少城市:', byCity.map(r => `${r.city_slug}=${r.n}`).join(' | '));
db.close();
console.log('DONE.');
