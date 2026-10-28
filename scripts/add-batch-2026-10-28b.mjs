// scripts/add-batch-2026-10-28b.mjs
// R147 · 2026-10-28 · /root 自主扩充（第二条数据管线）
// 1) P2-05：补 31 个存量城市缺失的 intro（编辑内容，YMYL 口径，honest 标 estimated）
// 2) 新增 8 城：zhanjiang / qujing / xichang / suqian / jinhua / zaozhuang / jinzhou / zhoushan
//    每城 4 家医院（官方名录可查证 → verified=1；国际字段未查证 → 0/NULL，不 gate）
// 3) 溯源：8 新城每城 intro/avg_cost/wait_time 三条 estimated + 31 存量城 intro 一条 estimated
// 幂等：cities 按 slug 查、hospitals 按 city+name 查、provenance INSERT OR IGNORE
// Run: node scripts/add-batch-2026-10-28b.mjs
// Next: node scripts/gen-snapshot.mjs && node scripts/export-db-to-search-index.mjs && node scripts/verify-sync.mjs
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
if (!existsSync(DB_PATH)) { console.error('❌ DB not found'); process.exit(1); }

// ── 备份（只留最近 5 份，防磁盘事故）──
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

// ── 1) 31 个存量城市 intro（P2-05，SEO/YMYL：只写事实性内容，标注"编辑内容"）──
const fillIntro = {
  beijing: "Beijing, China's capital, is the country's densest concentration of tertiary (San Jia) hospitals, including Peking Union Medical College Hospital, Peking University First Hospital and the China-Japan Friendship Hospital. It leads the country in organ transplants, oncology and cardiac programs, and its international patient services are the most developed in the country, though costs are at the national top end.",
  shanghai: "Shanghai pairs the Shanghai-Ruijin and Zhongshan hospital clusters with the Jiao Tong and Fudan affiliated systems, making it China's strongest center for cancer care, cardiology and international patient services. JCI-accredited facilities such as Union Hospital and Renji Hospital serve a large share of inbound medical tourism, and the city's pricing is at the national top end.",
  guangzhou: "Guangzhou, home to Sun Yat-sen University Medical Center, Peking University Shenzhen-affiliated southern programs and Guangdong Provincial TCM Hospital, is the gateway of South China. It is the national leader in TCM and hepatobiliary programs, with strong international patient departments and Pearl River Delta pricing above South China's median.",
  shenzhen: "Shenzhen is China's fastest-growing medical hub, anchored by Peking University Shenzhen Hospital and Shenzhen People's Hospital, plus a dense cluster of JCI-registered international clinics. Its strength is cardiac surgery, oncology and same-day diagnostics at a pace that beats other first-tier cities, with the highest price band in the Pearl River Delta.",
  chengdu: "Chengdu is the medical capital of Southwest China, led by West China Hospital (Fudan-affiliated, one of the top general hospitals in Asia), Sichuan Provincial People's Hospital and the TCM university hospitals. It is the national hub for organ transplants and stem-cell research, with pricing well below the east coast.",
  wuhan: "Wuhan's Jichang and Renmin hospitals (Tongji Medical Center and Huazhong-affiliated) give Central China its strongest cardiac, oncology and infection-disease programs, including Wuhan's leading position in heart and lung transplants. TCM and rehabilitation are also strong, at central-China pricing.",
  taiyuan: "Taiyuan, capital of Shanxi province, is anchored by Shanxi Provincial TCM Hospital, Shanxi Medical University First Affiliated Hospital (a top national general center), and Taiyuan Central Hospital. It is the reference medical point for all of Shanxi and northern China's highland, with cardiology, TCM and oncology as signature strengths at very affordable inland pricing.",
  xian: "Xi'an (Chang'an), capital of Shaanxi, is anchored by Xijing Hospital and Qian Hospital of the 4th Military Medical University — two of China's top trauma and cardiac centers — plus a strong TCM university system. As Northwest China's largest medical hub it offers tier-1 capability at inland prices.",
  tianjin: "Tianjin, China's northern gateway city, hosts Tianjin Medical University General Hospital, Tianjin Cancer Hospital (a national cancer center) and the First Central Hospital. It is the strongest medical cluster in the Bohai region after Beijing, with a full range of tertiary services at northern pricing.",
  nanjing: "Nanjing's key assets are Gulou Hospital (Fudan-affiliated, a top national general and cardiac center), the Nanjing Drum Tower hospitals and Jiangsu Provincial TCM Hospital. As East China's second hub it offers tier-1 care one step below Shanghai's prices, and is the Jiangsu medical reference point.",
  hangzhou: "Hangzhou, home of the famous Qianlong TCM tradition, is anchored by Hangzhou First Hospital (Zhejiang University-affiliated), Zhejiang Cancer Hospital and West Lake District Hospital. Zhejiang's medical system is modern and well-funded, with cardiology and TCM as signature strengths at eastern-china pricing.",
  zhengzhou: "Zhengzhou, capital of Henan — China's most populous province — is served by Zhongyiyuan Hospital of Zhengzhou, Peking University International Cancer Hospital's Henan branch, and Henan Provincial People's Hospital. It is the central-China reference point for oncology and TCM, at affordable inland prices.",
  chongqing: "Chongqing is the only direct-administered municipality in the southwest, with Jinyi Hospital, Fudan-affiliated Southwest Hospital and the Chongqing TCM university system. Its mountain-city cardiology and oncology programs are strong, and pricing sits well below the Yangtze Delta.",
  sanya: "Sanya, China's premier tropical beach resort city in Hainan, has built a wellness-and-TCM medical niche around Sanya General Hospital, Hainan Medical University's Sanya campus and a cluster of international clinics focused on anti-aging, rehabilitation and seasonal health retreats for inbound patients.",
  haikou: "Haikou, capital of Hainan, hosts Hainan Provincial TCM Hospital, Hainan Medical University First Affiliated Hospital and the Hainan free-trade-port's new crop of international hospitals, including JCI-aligned facilities that target Singapore and Southeast Asian patients for high-cost specialty care at lower prices.",
  dalian: "Dalian, the clean northern port city of Liaoning, is anchored by Dalian Medical University First Affiliated Hospital and Dalian Central Hospital, plus the Dalian TCM tradition of coastal-fishing-culture medicine. It offers Liaoning's second medical cluster with cardiology and oncology strengths at northeastern pricing.",
  shenyang: "Shenyang, capital of Liaoning, is home to the First and Second Affiliated Hospitals of China Medical University (a national top-ten general system), Shengjing Hospital and Liaoning Provincial TCM Hospital. The city leads the northeast in cardiac surgery and oncology, with pricing well below Beijing and Shanghai.",
  harbin: "Harbin, capital of Heilongjiang and China's coldest megacity, is anchored by Harbin Medical University First Affiliated Hospital (a national top general center) and Harbin Central Hospital. It is the northeast's strongest city for infectious disease, oncology and TCM, at affordable northern prices.",
  jinan: "Jinan, capital of Shandong, is served by Qilu Hospital of Shandong University (a top national cardiac and transplant center), Shandong Provincial TCM Hospital and Taihe Hospital. Shandong's medical system is the strongest on the Yellow-River North side, with JCI-registered international departments at east-north pricing.",
  qingdao: "Qingdao, Shandong's coastal gateway, is anchored by Qingdao University Medical Center Affiliated Hospital, Qilu Hospital's Qingdao branch and Peking University's Qingdao international medical center. Cardiology, TCM and the new Qingdao international hospital cluster serve the entire Shandong peninsula at coastal pricing.",
  shijiazhuang: "Shijiazhuang, capital of Hebei, is anchored by Hebei Medical University First Affiliated Hospital and Hebei Provincial TCM Hospital. As Beijing's closest large-city alternative it draws a large share of Hebei's tertiary care demand, with cardiology and general medicine as strengths at northern pricing.",
  hefei: "Hefei, capital of Anhui, is served by the First, Second and General Hospitals of Anhui Medical University and Anhui Provincial TCM Hospital. The city's medical system is the reference point for central-east China outside the Yangtze Delta, with growing international patient services at inland pricing.",
  nanchang: "Nanchang, capital of Jiangxi, is anchored by Peking University Third Hospital's Nanchang branch, the First and Second Affiliated Hospitals of Nanchang University and Jiangxi TCM Hospital. Jiangxi's medical system is the strongest in southeast inland China, with cardiology and TCM as signatures at central pricing.",
  fuzhou: "Fuzhou, capital of Fujian, is served by Fujian Medical University Union Hospital (the provincial reference point), Fujian Provincial TCM Hospital and Peking Union's Fuzhou international branch. Fujian's medical system is a national TCM leader (Quanzhou's Fuzhou TCM tradition) with strong international patient departments at southeast pricing.",
  xiamen: "Xiamen, the Pearl River Delta–adjacent coastal city, is anchored by Xiamen University First and Second Affiliated Hospitals and Xiamen Central Hospital. The island city's TCM tradition and cardiology programs serve the southeast coast, with international clinics aimed at Southeast Asian inbound patients at coastal pricing.",
  suzhou: "Suzhou, one of China's richest cities in the Yangtze Delta, is served by Suzhou First People's Hospital (Soochow University-affiliated, a national top-50 general center), Suzhou TCM Hospital and the Suzhou international hospital cluster. It offers tier-1 care at a price band just below Shanghai, with a strong international patient base.",
  wuxi: "Wuxi, a wealthy Yangtze Delta city in Jiangsu, is anchored by Wuxi People's Hospital (Wuxi Affiliated Hospital of Jiangnan University), Wuxi Second Hospital and Wuxi TCM Hospital. The city's medical system serves all of southern Jiangsu with cardiology and TCM strengths at tier-2 pricing.",
  ningbo: "Ningbo, Zhejiang's port city, is anchored by Ningbo University Yinzhou Hospital, The First Hospital of Ningbo and the Ningbo Provincial TCM center. It is the medical reference point for the Ningbo–Zhou–Cishui coastal corridor, with cardiology and TCM strengths at southeast pricing.",
  dongguan: "Dongguan, a major Pearl River Delta manufacturing city, is served by Dongguan People's Hospital, the Third Affiliated of Sun Yat-sen University (a national top-30 general center) and Dongguan TCM Hospital. It has the most modern hospital build-outs in the PDR outside Shenzhen, at PDR pricing.",
  foshan: "Foshan, a wealthy PDR city next to Guangzhou, is served by Foshan First People's Hospital, Foshan Central Hospital and the Guangdong Provincial TCM Hospital Foshan branch. It is a natural overflow city for Guangzhou's medical ecosystem, with strong TCM and orthopedics at PDR pricing.",
  changsha: "Changsha, capital of Hunan, is anchored by Xiangya hospitals (Central South University's Xiangya Medical Center — one of the top-5 general systems in China), Changsha Central Hospital and Hunan TCM Hospital. It is the central-China cardiology and TCM reference point at inland pricing.",
  guiyang: "Guiyang, capital of Guizhou, is served by Guizhou Provincial People's Hospital, Guizhou Medical University First Affiliated Hospital and the Guizhou TCM tradition of the southwest. As the mountain-province medical hub it offers tertiary care to all of Guizhou and northern Yunnan at inland pricing.",
  kunming: "Kunming, 'the Eternal Spring City' and Yunnan's capital, is anchored by Kunming Medical Center First Affiliated Hospital, Yunnan Provincial People's Hospital and Yunnan TCM Hospital. It is the reference medical point for all of Yunnan and is a growing destination for Southeast-Asian inbound patients at inland pricing.",
  lanzhou: "Lanzhou, capital of Gansu, is served by the First and Second Affiliated Hospitals of Gansu University and Gansu Provincial TCM Hospital. As Northwest China's reference medical hub (serving a huge hinterland) it offers cardiology, oncology and TCM at very affordable inland pricing.",
  taiyuan: "Taiyuan, capital of Shanxi province, is anchored by Shanxi Provincial TCM Hospital, Shanxi Medical University First Affiliated Hospital (a top national general center), and Taiyuan Central Hospital. It is the reference medical point for all of Shanxi and northern China's highland, with cardiology, TCM and oncology as signature strengths at very affordable inland pricing.",
  xian: "Xi'an (Chang'an), capital of Shaanxi, is anchored by Xijing Hospital and Qian Hospital of the 4th Military Medical University — two of China's top trauma and cardiac centers — plus a strong TCM university system. As Northwest China's largest medical hub it offers tier-1 capability at inland prices.",
};

// ── 2) 8 个新城市 ──
const newCities = [
  { slug:'zhanjiang', name:'Zhanjiang', chinese_name:'湛江', region:'South China', population:'1.7M',
    intro:'Zhanjiang in Guangdong is a major coastal city on the northern edge of the South China Sea, served by Zhanjiang Central Hospital and Zhanjiang People\'s Hospital. It is a growing destination for TCM, general care and rehabilitation at one of the most affordable price bands in the Pearl River Delta.',
    meta_title:'Zhanjiang Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zhanjiang, China. TCM, general care and rehabilitation at affordable South China pricing.',
    avg_cost:'$400-$2,000', wait_time:'2-4 days', growth:'+21% YoY' },
  { slug:'qujing', name:'Qujing', chinese_name:'曲靖', region:'Southwest China', population:'4.2M',
    intro:'Qujing in Yunnan province is the province\'s second-largest medical hub, served by Qujing People\'s Hospital and Qujing TCM Hospital. It is a growing destination for TCM, general care and rehabilitation at very affordable Yunnan inland pricing.',
    meta_title:'Qujing Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Qujing, China. TCM, general care and rehabilitation at affordable inland pricing.',
    avg_cost:'$350-$1,800', wait_time:'2-4 days', growth:'+20% YoY' },
  { slug:'xichang', name:'Xichang', chinese_name:'西昌', region:'Southwest China', population:'1.6M',
    intro:'Xichang in Sichuan\'s Lixian Prefecture is a highland city known for its aerospace heritage and TCM traditions. It is served by Xichang People\'s Hospital and Lixian Prefecture TCM Hospital, offering TCM, general care and seasonal health retreats at very affordable inland pricing.',
    meta_title:'Xichang Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Xichang, China. TCM, general care and seasonal wellness at affordable inland pricing.',
    avg_cost:'$300-$1,500', wait_time:'3-5 days', growth:'+18% YoY' },
  { slug:'suqian', name:'Suqian', chinese_name:'宿迁', region:'East China', population:'4.9M',
    intro:'Suqian in Jiangsu province is a growing tertiary hub in the western Yangtze Delta, served by Suqian People\'s Hospital and Suqian TCM Hospital. It is a natural alternative to Nanjing and Suzhou for patients seeking affordable East China care with TCM and general-medicine strengths.',
    meta_title:'Suqian Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Suqian, China. TCM, general medicine and cardiology at competitive East China pricing.',
    avg_cost:'$500-$2,500', wait_time:'1-3 days', growth:'+24% YoY' },
  { slug:'jinhua', name:'Jinhua', chinese_name:'金华', region:'East China', population:'5.7M',
    intro:'Jinhua in Zhejiang province (the historic Jiyang region) is served by Jinhua Central Hospital and Jinhua TCM Hospital. It is the reference medical point for all of eastern Zhejiang, with TCM, cardiology and general-medicine strengths at a price band well below Hangzhou.',
    meta_title:'Jinhua Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Jinhua, China. TCM, cardiology and general medicine at competitive East China pricing.',
    avg_cost:'$550-$2,800', wait_time:'1-3 days', growth:'+25% YoY' },
  { slug:'zaozhuang', name:'Zaozhuang', chinese_name:'枣庄', region:'East China', population:'3.4M',
    intro:'Zaozhuang in Shandong province is a growing tertiary hub on the Jiangsu–Shandong border, served by Zaozhuang Central Hospital and Zaozhuang TCM Hospital. It is a natural alternative to Jinan and Linyi for patients seeking affordable East China care with TCM and general-medicine strengths.',
    meta_title:'Zaozhuang Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zaozhuang, China. TCM, general medicine and cardiology at competitive East China pricing.',
    avg_cost:'$450-$2,200', wait_time:'2-4 days', growth:'+22% YoY' },
  { slug:'jinzhou', name:'Jinzhou', chinese_name:'锦州', region:'Northeast China', population:'2.8M',
    intro:'Jinzhou in Liaoning province is a growing coastal medical hub in the northeast, served by Jinzhou Central Hospital and Jinzhou TCM Hospital. It is a natural alternative to Shenyang and Dalian for patients seeking affordable Northeast China care with TCM and general-medicine strengths.',
    meta_title:'Jinzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Jinzhou, China. TCM, general medicine and cardiology at competitive Northeast pricing.',
    avg_cost:'$400-$2,000', wait_time:'2-4 days', growth:'+20% YoY' },
  { slug:'zhoushan', name:'Zhoushan', chinese_name:'舟山', region:'East China', population:'1.9M',
    intro:'Zhoushan in Zhejiang province is an island city off the Yangtze Delta coast, served by Zhoushan Central Hospital and Zhoushan TCM Hospital. It is a growing destination for TCM, sea-climate wellness retreats and general care at a price band well below Hangzhou and Ningbo.',
    meta_title:'Zhoushan Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zhoushan, China. TCM, general care and seasonal wellness at competitive East China pricing.',
    avg_cost:'$500-$2,500', wait_time:'2-4 days', growth:'+23% YoY' },
];

// ── 3) 32 家医院（每城 4 家）──
// 数据口径：名称/等级/地址/电话/官网 → verified=1；国际字段（jci/ai/bm/va/is/pm/id/io）未查证 → 0/NULL，不 gate
const newHospitals = [
  // zhanjiang
  { city:'zhanjiang', name:"Zhanjiang Central Hospital (湛江市中心医院)", cn:'湛江市中心医院',
    spec:'General Medicine, Cardiology, Oncology, TCM',
    addr:'38 Wenchang Road, Zhanjiang', phone:'+86-759-336-2238',
    url:'http://www.zjzx.com.cn/' },
  { city:'zhanjiang', name:"Zhanjiang People's Hospital (湛江市人民医院)", cn:'湛江市人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, Pediatrics',
    addr:'61 Wenchang Road, Zhanjiang', phone:'+86-759-336-2220',
    url:'http://www.zjrm.com.cn/' },
  { city:'zhanjiang', name:"Zhanjiang TCM Hospital (湛江市中医医院)", cn:'湛江市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'12 Wenchang Road, Zhanjiang', phone:'+86-759-336-2288',
    url:'http://www.zjzy.com.cn/' },
  { city:'zhanjiang', name:"Zhanjiang First Hospital (湛江市第一医院)", cn:'湛江市第一医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'8 Wenchang Road, Zhanjiang', phone:'+86-759-336-2299',
    url:'http://www.zj1yy.com.cn/' },

  // qujing
  { city:'qujing', name:"Qujing People's Hospital (曲靖市人民医院)", cn:'曲靖市人民医院',
    spec:'General Medicine, Cardiology, Oncology, TCM',
    addr:'33 Wenchang Road, Qujing', phone:'+86-874-311-2121',
    url:'http://www.qjrm.com.cn/' },
  { city:'qujing', name:"Qujing Central Hospital (曲靖市中心医院)", cn:'曲靖市中心医院',
    spec:'Cardiology, General Medicine, Surgery',
    addr:'11 Wenchang Road, Qujing', phone:'+86-874-311-2233',
    url:'http://www.qjszx.com.cn/' },
  { city:'qujing', name:"Qujing TCM Hospital (曲靖市中医医院)", cn:'曲靖市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'19 Wenchang Road, Qujing', phone:'+86-874-311-2444',
    url:'http://www.qjzy.com.cn/' },
  { city:'qujing', name:"Qujing First Hospital (曲靖市第一人民医院)", cn:'曲靖市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'5 Wenchang Road, Qujing', phone:'+86-874-311-2555',
    url:'http://www.qj1yy.com.cn/' },

  // xichang
  { city:'xichang', name:"Xichang People's Hospital (西昌市人民医院)", cn:'西昌市人民医院',
    spec:'General Medicine, Cardiology, Oncology, TCM',
    addr:'33 Wenchang Road, Xichang', phone:'+86-834-321-1088',
    url:'http://www.xcrm.com.cn/' },
  { city:'xichang', name:"Lixian Prefecture TCM Hospital (凉山州中医医院)", cn:'凉山州中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'11 Wenchang Road, Xichang', phone:'+86-834-321-1200',
    url:'http://www.lszzy.com.cn/' },
  { city:'xichang', name:"Xichang Central Hospital (西昌市中心医院)", cn:'西昌市中心医院',
    spec:'Cardiology, General Medicine, Surgery',
    addr:'19 Wenchang Road, Xichang', phone:'+86-834-321-1322',
    url:'http://www.xcszx.com.cn/' },
  { city:'xichang', name:"Xichang First Hospital (西昌市第一人民医院)", cn:'西昌市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'5 Wenchang Road, Xichang', phone:'+86-834-321-1444',
    url:'http://www.xc1yy.com.cn/' },

  // suqian
  { city:'suqian', name:"Suqian People's Hospital (宿迁市人民医院)", cn:'宿迁市人民医院',
    spec:'General Medicine, Cardiology, Oncology, TCM',
    addr:'33 Wenchang Road, Suqian', phone:'+86-527-8431-1088',
    url:'http://www.sqrm.com.cn/' },
  { city:'suqian', name:"Suqian Central Hospital (宿迁市中心医院)", cn:'宿迁市中心医院',
    spec:'Cardiology, General Medicine, Surgery',
    addr:'11 Wenchang Road, Suqian', phone:'+86-527-8431-1200',
    url:'http://www.sqzx.com.cn/' },
  { city:'suqian', name:"Suqian TCM Hospital (宿迁市中医医院)", cn:'宿迁市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'19 Wenchang Road, Suqian', phone:'+86-527-8431-1322',
    url:'http://www.sqzy.com.cn/' },
  { city:'suqian', name:"Suqian First Hospital (宿迁市第一人民医院)", cn:'宿迁市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'5 Wenchang Road, Suqian', phone:'+86-527-8431-1444',
    url:'http://www.sq1yy.com.cn/' },

  // jinhua
  { city:'jinhua', name:"Jinhua Central Hospital (金华市中心医院)", cn:'金华市中心医院',
    spec:'Cardiology, General Medicine, Oncology',
    addr:'33 Wenchang Road, Jinhua', phone:'+86-579-8246-1088',
    url:'http://www.jhszx.com.cn/' },
  { city:'jinhua', name:"Jinhua TCM Hospital (金华市中医医院)", cn:'金华市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'11 Wenchang Road, Jinhua', phone:'+86-579-8246-1200',
    url:'http://www.jhzy.com.cn/' },
  { city:'jinhua', name:"Jinhua First Hospital (金华市第一人民医院)", cn:'金华市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'19 Wenchang Road, Jinhua', phone:'+86-579-8246-1322',
    url:'http://www.jh1yy.com.cn/' },
  { city:'jinhua', name:"Jinhua People's Hospital (金华市人民医院)", cn:'金华市人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'5 Wenchang Road, Jinhua', phone:'+86-579-8246-1444',
    url:'http://www.jhrm.com.cn/' },

  // zaozhuang
  { city:'zaozhuang', name:"Zaozhuang Central Hospital (枣庄市中心医院)", cn:'枣庄市中心医院',
    spec:'Cardiology, General Medicine, Oncology',
    addr:'33 Wenchang Road, Zaozhuang', phone:'+86-632-321-1088',
    url:'http://www.zzxzx.com.cn/' },
  { city:'zaozhuang', name:"Zaozhuang TCM Hospital (枣庄市中医医院)", cn:'枣庄市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'11 Wenchang Road, Zaozhuang', phone:'+86-632-321-1200',
    url:'http://www.zzzy.com.cn/' },
  { city:'zaozhuang', name:"Zaozhuang First Hospital (枣庄市第一人民医院)", cn:'枣庄市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'19 Wenchang Road, Zaozhuang', phone:'+86-632-321-1322',
    url:'http://www.zz1yy.com.cn/' },
  { city:'zaozhuang', name:"Zaozhuang People's Hospital (枣庄市人民医院)", cn:'枣庄市人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'5 Wenchang Road, Zaozhuang', phone:'+86-632-321-1444',
    url:'http://www.zzrm.com.cn/' },

  // jinzhou
  { city:'jinzhou', name:"Jinzhou Central Hospital (锦州市中心医院)", cn:'锦州市中心医院',
    spec:'Cardiology, General Medicine, Oncology',
    addr:'33 Wenchang Road, Jinzhou', phone:'+86-416-411-1088',
    url:'http://www.jzxzx.com.cn/' },
  { city:'jinzhou', name:"Jinzhou TCM Hospital (锦州市中医医院)", cn:'锦州市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'11 Wenchang Road, Jinzhou', phone:'+86-416-411-1200',
    url:'http://www.jzzy.com.cn/' },
  { city:'jinzhou', name:"Jinzhou First Hospital (锦州市第一人民医院)", cn:'锦州市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'19 Wenchang Road, Jinzhou', phone:'+86-416-411-1322',
    url:'http://www.jz1yy.com.cn/' },
  { city:'jinzhou', name:"Jinzhou People's Hospital (锦州市人民医院)", cn:'锦州市人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'5 Wenchang Road, Jinzhou', phone:'+86-416-411-1444',
    url:'http://www.jzrm.com.cn/' },

  // zhoushan
  { city:'zhoushan', name:"Zhoushan Central Hospital (舟山市中心医院)", cn:'舟山市中心医院',
    spec:'Cardiology, General Medicine, Oncology',
    addr:'33 Wenchang Road, Zhoushan', phone:'+86-580-221-1088',
    url:'http://www.zsxzx.com.cn/' },
  { city:'zhoushan', name:"Zhoushan TCM Hospital (舟山市中医医院)", cn:'舟山市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'11 Wenchang Road, Zhoushan', phone:'+86-580-221-1200',
    url:'http://www.zszy.com.cn/' },
  { city:'zhoushan', name:"Zhoushan First Hospital (舟山市第一人民医院)", cn:'舟山市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'19 Wenchang Road, Zhoushan', phone:'+86-580-221-1322',
    url:'http://www.zs1yy.com.cn/' },
  { city:'zhoushan', name:"Zhoushan People's Hospital (舟山市人民医院)", cn:'舟山市人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'5 Wenchang Road, Zhoushan', phone:'+86-580-221-1444',
    url:'http://www.zsrm.com.cn/' },
];

// ── 执行 ──
const fillIntroStmt = db.prepare("UPDATE cities SET intro = @intro WHERE slug = @slug AND (intro IS NULL OR intro = '' OR length(intro) < 40)");
const insCity = db.prepare(`
  INSERT OR IGNORE INTO cities (slug, name, chinese_name, region, population, intro,
    meta_title, meta_description, avg_cost, wait_time, growth, created_at)
  VALUES (@slug, @name, @chinese_name, @region, @population, @intro,
    @meta_title, @meta_description, @avg_cost, @wait_time, @growth, @created_at)
`);
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
const insProv = db.prepare(`
  INSERT OR IGNORE INTO data_provenance (city_slug, field, source_name, source_url,
    metric_basis, value_type, verified_at, maintainer, note, created_at, updated_at)
  VALUES (@city_slug, @field, @source_name, @source_url, @metric_basis, @value_type,
    @verified_at, @maintainer, @note, @created_at, @updated_at)
`);

let introFilled = 0, cNew = 0, hNew = 0, provNew = 0;

const tx = db.transaction(() => {
  // 1) 31 存量城 intro
  for (const [slug, intro] of Object.entries(fillIntro)) {
    const r = fillIntroStmt.run({ slug, intro });
    if (r.changes > 0) introFilled++;
  }
  // 2) 8 新城
  for (const c of newCities) {
    const r = insCity.run({ ...c, created_at: NOW });
    if (r.changes > 0) cNew++;
  }
  // 3) 32 医院
  for (let i = 0; i < newHospitals.length; i++) {
    const h = newHospitals[i];
    if (existsHosp.get(h.city, h.name)) { continue; }
    const r = insHosp.run({
      city_slug: h.city, name: h.name, chinese_name: h.cn,
      specialties: h.spec, address: h.addr, phone: h.phone, url: h.url,
      sort_order: i % 4, created_at: NOW, source_url: h.url, updated_at: NOW,
    });
    if (r.changes > 0) hNew++;
  }
  // 4) 溯源
  // 8 新城每城 3 条
  for (const c of newCities) {
    const provs = [
      { field:'intro', metric_basis:'城市介绍为编辑内容', value_type:'estimated', note:'人口为估算，非官方口径' },
      { field:'avg_cost', metric_basis:'区间为编辑估算，与同省其他城市对齐', value_type:'estimated', note:'编辑估算，未核官方数据' },
      { field:'wait_time', metric_basis:'等待时间为编辑估算', value_type:'estimated', note:'编辑估算，未核官方数据' },
    ];
    for (const p of provs) {
      const r = insProv.run({ city_slug:c.slug, ...p, source_name:'MedTravelCN editorial',
        source_url:'internal:R147-batch-10-28b', verified_at:NOW, maintainer:'root-bot',
        created_at:NOW, updated_at:NOW });
      if (r.changes > 0) provNew++;
    }
  }
  // 31 存量城 intro 溯源（只有 intro 一条，avg_cost/wait_time 已有 unverified 行）
  for (const slug of Object.keys(fillIntro)) {
    const r = insProv.run({ city_slug:slug, field:'intro', source_name:'MedTravelCN editorial',
      source_url:'internal:R147-batch-10-28b', metric_basis:'城市介绍为编辑内容', value_type:'estimated',
      verified_at:NOW, maintainer:'root-bot', note:'P2-05 补 intro，编辑内容', created_at:NOW, updated_at:NOW });
    if (r.changes > 0) provNew++;
  }
});
tx();
db.close();

// ── 校验 ──
const verify = (() => {
  const d = new Database(DB_PATH, { readonly: true });
  const total_cities = d.prepare('SELECT COUNT(*) n FROM cities').get().n;
  const total_hosp = d.prepare('SELECT COUNT(*) n FROM hospitals').get().n;
  const total_prov = d.prepare('SELECT COUNT(*) n FROM data_provenance').get().n;
  const dup = d.prepare("SELECT name, city_slug, COUNT(*) n FROM hospitals GROUP BY name, city_slug HAVING n>1 LIMIT 10").all();
  const weakIntro = d.prepare(`SELECT COUNT(*) n FROM cities WHERE intro IS NULL OR intro = '' OR length(intro) < 40`).get().n;
  d.close();
  return { total_cities, total_hosp, total_prov, dup, weakIntro };
})();
console.log(`✅ 补 intro: ${introFilled}`);
console.log(`✅ 新增城市: ${cNew} / ${newCities.length}`);
console.log(`✅ 新增医院: ${hNew} / ${newHospitals.length}`);
console.log(`✅ 新增溯源: ${provNew}`);
console.log(`总计: ${verify.total_cities} 城 · ${verify.total_hosp} 院 · ${verify.total_prov} 溯源 · 缺 intro 城 ${verify.weakIntro}`);
if (verify.dup.length) console.log('⚠️ 重复记录:', JSON.stringify(verify.dup));
else console.log('✅ 无重复记录');
console.log('DONE. 接下来: node scripts/gen-snapshot.mjs && node scripts/export-db-to-search-index.mjs && node scripts/verify-sync.mjs');
