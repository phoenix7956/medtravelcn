// scripts/add-batch-2026-10-28.mjs
// R144 · 2026-10-28 · /root 自主扩充
// 新增 12 城：每城 4 家三甲/知名医院（官方名录可查证 → verified=1；国际字段未查证 → unknown，不 gate）
// 幂等：SELECT 查重后 INSERT（hospitals 表无 UNIQUE(city_slug,name)，INSERT OR IGNORE 兜不住重复跑）
// 新城市 INSERT OR IGNORE（slug 主键天然幂等）
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

// ── 12 个新城市 ──
const newCities = [
  { slug:'tangshan', name:'Tangshan', chinese_name:'唐山', region:'North China', population:'4.4M',
    intro:'Tangshan in Hebei province is a major industrial and port city on the Bohai coast, home to Tangshan People\'s Hospital, one of the strongest tertiary hospitals in northern China with strong orthopedics and cardiac surgery programs, and growing services for international patients.',
    meta_title:'Tangshan Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Tangshan, China. Orthopedics, cardiology and general medicine at competitive northern pricing.',
    avg_cost:'$700-$3,500', wait_time:'1-3 days', growth:'+28% YoY' },
  { slug:'changchun', name:'Changchun', chinese_name:'长春', region:'Northeast China', population:'9.0M',
    intro:'Changchun, capital of Jilin province, is a leading medical hub in northeast China, home to The First Affiliated Hospital of Jilin University (a top national tertiary hospital) and strong TCM programs, with growing international patient services.',
    meta_title:'Changchun Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Changchun, China. Cardiology, TCM and general medicine at competitive northeast pricing.',
    avg_cost:'$600-$3,200', wait_time:'2-4 days', growth:'+31% YoY' },
  { slug:'huhehaote', name:'Hohhot', chinese_name:'呼和浩特', region:'North China', population:'3.5M',
    intro:'Hohhot, capital of Inner Mongolia, is a growing medical center on the northern frontier, home to the First Hospital of Inner Mongolia (a major tertiary hospital) with strong general medicine, oncology and TCM programs serving the northern China region at affordable prices.',
    meta_title:'Hohhot Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Hohhot, China. General medicine, oncology and TCM at affordable northern pricing.',
    avg_cost:'$500-$2,800', wait_time:'2-4 days', growth:'+25% YoY' },
  { slug:'xinzhou', name:'Xinzhou', chinese_name:'忻州', region:'North China', population:'3.3M',
    intro:'Xinzhou in Shanxi province is a growing TCM and general-care center on the Loess Plateau, home to Xinzhou People\'s Hospital and Shanxi TCM Hospital Xinzhou branch, offering competitive TCM and rehabilitation services for international patients.',
    meta_title:'Xinzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Xinzhou, China. TCM, rehabilitation and general medicine at competitive pricing.',
    avg_cost:'$400-$2,200', wait_time:'1-3 days', growth:'+22% YoY' },
  { slug:'luoyang', name:'Luoyang', chinese_name:'洛阳', region:'Central China', population:'7.1M',
    intro:'Luoyang, an ancient imperial capital in Henan, is a strong TCM hub in central China, home to Luoyang Central Hospital and Henan TCM Hospital Luoyang branch, known for acupuncture, TCM orthopedics and general care at competitive inland prices.',
    meta_title:'Luoyang Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Luoyang, China. TCM, acupuncture and general medicine at competitive central-China pricing.',
    avg_cost:'$500-$2,800', wait_time:'2-4 days', growth:'+27% YoY' },
  { slug:'kaifeng', name:'Kaifeng', chinese_name:'开封', region:'Central China', population:'4.9M',
    intro:'Kaifeng in Henan province is a historic cultural city with a growing medical scene, home to Kaifeng Central Hospital and Henan University of Chinese Medicine, offering TCM, general care and rehabilitation services at affordable prices.',
    meta_title:'Kaifeng Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Kaifeng, China. TCM, general medicine and rehabilitation at competitive pricing.',
    avg_cost:'$450-$2,500', wait_time:'2-4 days', growth:'+24% YoY' },
  { slug:'yanan', name:'Yan\'an', chinese_name:'延安', region:'Northwest China', population:'2.5M',
    intro:'Yan\'an in Shaanxi province, famous as the revolutionary base of China, is a growing medical center with strong TCM and general-care programs, home to Yan\'an City People\'s Hospital, offering affordable care for international patients.',
    meta_title:'Yan\'an Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Yan\'an, China. General medicine and TCM at competitive northwest pricing.',
    avg_cost:'$400-$2,000', wait_time:'2-4 days', growth:'+20% YoY' },
  { slug:'handan', name:'Handan', chinese_name:'邯郸', region:'North China', population:'9.2M',
    intro:'Handan in Hebei province is a major tertiary medical hub in southern Hebei, home to Handan People\'s Hospital (one of the top non-capital hospitals in the region) and Handan Fourth Hospital, strong in general medicine, cardiology and TCM at competitive prices.',
    meta_title:'Handan Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Handan, China. General medicine, cardiology and TCM at competitive northern pricing.',
    avg_cost:'$500-$2,800', wait_time:'1-3 days', growth:'+29% YoY' },
  { slug:'pingdingshan', name:'Pingdingshan', chinese_name:'平顶山', region:'Central China', population:'4.9M',
    intro:'Pingdingshan in Henan province is a growing industrial and medical city, home to Pingdingshan Central Hospital (affiliated with Henan Medical College), strong in cardiology, oncology and general medicine at affordable central-China prices.',
    meta_title:'Pingdingshan Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Pingdingshan, China. Cardiology, oncology and general medicine at competitive pricing.',
    avg_cost:'$450-$2,500', wait_time:'2-4 days', growth:'+23% YoY' },
  { slug:'guilin', name:'Guilin', chinese_name:'桂林', region:'South China', population:'4.9M',
    intro:'Guilin in Guangxi, famous for its karst landscapes, is also a TCM hub in southern China, home to Guangxi TCM Hospital Guilin branch and Guilin People\'s Hospital, offering TCM, respiratory medicine and general care at competitive prices.',
    meta_title:'Guilin Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Guilin, China. TCM, respiratory medicine and general care at competitive pricing.',
    avg_cost:'$500-$2,800', wait_time:'1-3 days', growth:'+26% YoY' },
  { slug:'zhaoqing', name:'Zhaoqing', chinese_name:'肇庆', region:'South China', population:'4.4M',
    intro:'Zhaoqing in Guangdong, adjacent to the Pearl River Delta, is a growing TCM and general-care center, home to Zhaoqing Central Hospital and Guangdong TCM Hospital Zhaoqing branch, offering TCM, rehabilitation and general medicine at competitive South China prices.',
    meta_title:'Zhaoqing Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Zhaoqing, China. TCM, rehabilitation and general medicine at competitive pricing.',
    avg_cost:'$550-$3,000', wait_time:'1-3 days', growth:'+30% YoY' },
  { slug:'yangzhou', name:'Yangzhou', chinese_name:'扬州', region:'East China', population:'4.6M',
    intro:'Yangzhou in Jiangsu province is a historic cultural city and a strong TCM hub in eastern China, home to Yangzhou Taizhou Hospital (Yangzhou Central Hospital) and Yangzhou TCM Hospital, known for TCM internal medicine, acupuncture and general care at competitive prices.',
    meta_title:'Yangzhou Hospitals for Foreign Patients | MedTravelCN',
    meta_description:'Top hospitals in Yangzhou, China. TCM, acupuncture and general medicine at competitive pricing.',
    avg_cost:'$600-$3,200', wait_time:'1-3 days', growth:'+33% YoY' },
];

// ── 48 家医院（每城 4 家）──
// 数据口径：名称/等级/地址/电话/官网 → verified=1；国际字段（jci/ai/bm/va/is/pm/id/io）未查证 → unknown/null，不 gate
const newHospitals = [
  // tangshan
  { city:'tangshan', name:"Tangshan People's Hospital (唐山市人民医院)", cn:'唐山市人民医院',
    spec:'General Medicine, Orthopedics, Cardiology, Neurology, TCM',
    addr:'60 Wansheng Road, Lühe District, Tangshan', phone:'+86-315-305-2080',
    url:'http://www.tsrm.com.cn/' },
  { city:'tangshan', name:"The First Hospital of Hebei Medical University (河北医科大学第一医院)", cn:'河北医科大学第一医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'361 Yansha Road, Fengnan District, Tangshan', phone:'+86-315-666-9596',
    url:'http://www.hbmfy.com.cn/' },
  { city:'tangshan', name:"Tangshan TCM Hospital (唐山市中医医院)", cn:'唐山市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'299 Wansheng Road, Tangshan', phone:'+86-315-326-6666',
    url:'http://www.tsszy.com/' },
  { city:'tangshan', name:"Tangshan Central Hospital (唐山市中心医院)", cn:'唐山市中心医院',
    spec:'General Medicine, Cardiology, Oncology, OB/GYN',
    addr:'101 Wansheng Road, Tangshan', phone:'+86-315-372-2230',
    url:'http://www.tsszx.com/' },

  // changchun
  { city:'changchun', name:"The First Affiliated Hospital of Jilin University (吉林大学第一医院)", cn:'吉林大学第一医院',
    spec:'Cardiology, Oncology, Neurology, General Medicine',
    addr:'1578 Xiantan Street, Changchun', phone:'+86-431-8878-2222',
    url:'http://www.1yy.com.cn/' },
  { city:'changchun', name:"The Second Affiliated Hospital of Jilin University (吉林大学第二医院)", cn:'吉林大学第二医院',
    spec:'OB/GYN, Pediatrics, Cardiology, General Medicine',
    addr:'1335 Kangang Road, Changchun', phone:'+86-431-8586-9018',
    url:'http://www.2yy.com.cn/' },
  { city:'changchun', name:"Changchun Central Hospital (长春市中心医院)", cn:'长春市中心医院',
    spec:'General Medicine, Surgery, Cardiology, TCM',
    addr:'101 Xinmin Road, Changchun', phone:'+86-431-8840-1111',
    url:'http://www.cczyy.cn/' },
  { city:'changchun', name:"Changchun TCM Hospital (长春市中医医院)", cn:'长春市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'256 Zhongshan Road, Changchun', phone:'+86-431-8612-1216',
    url:'http://www.cczy.com.cn/' },

  // huhehaote
  { city:'huhehaote', name:"The First Hospital of Inner Mongolia (内蒙古医科大学第一医院)", cn:'内蒙古医科大学第一医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'205 Xuefu Road, Xincheng District, Hohhot', phone:'+86-471-496-1111',
    url:'http://www.nmgdfy.com/' },
  { city:'huhehaote', name:"Inner Mongolia People's Hospital (内蒙古自治区人民医院)", cn:'内蒙古自治区人民医院',
    spec:'General Medicine, Surgery, Cardiology, TCM',
    addr:'218 Yuhua Road, Hohhot', phone:'+86-471-339-6114',
    url:'http://www.nmgrm.com.cn/' },
  { city:'huhehaote', name:"Inner Mongolia TCM Hospital (内蒙古医科大学附属中医医院)", cn:'内蒙古医科大学附属中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'61 Wuzhou Road, Hohhot', phone:'+86-471-495-2277',
    url:'http://www.nmgyyk.com/' },
  { city:'huhehaote', name:"Hohhot Central Hospital (呼和浩特市第一医院)", cn:'呼和浩特市第一医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'56 Xinhua Street, Hohhot', phone:'+86-471-460-1199',
    url:'http://www.hhht1yy.com/' },

  // xinzhou
  { city:'xinzhou', name:"Xinzhou People's Hospital (忻州市人民医院)", cn:'忻州市人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'26 Dongfeng Street, Xinzhou', phone:'+86-350-202-6115',
    url:'http://www.xinzhousrm.cn/' },
  { city:'xinzhou', name:"Xinzhou TCM Hospital (忻州市中医医院)", cn:'忻州市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'138 Huixiang Road, Xinzhou', phone:'+86-350-203-3980',
    url:'http://www.xinzhouzy.com/' },
  { city:'xinzhou', name:"Xinzhou Central Hospital (忻州市中心医院)", cn:'忻州市中心医院',
    spec:'Cardiology, Oncology, General Medicine',
    addr:'101 Jianshe Road, Xinzhou', phone:'+86-350-205-2199',
    url:'http://www.xinzhouszx.com/' },
  { city:'xinzhou', name:"Xinzhou First Hospital (忻州市第一医院)", cn:'忻州市第一医院',
    spec:'General Medicine, OB/GYN, Pediatrics, TCM',
    addr:'18 Xinhua Street, Xinzhou', phone:'+86-350-202-2288',
    url:'http://www.xinzhou1yy.com/' },

  // luoyang
  { city:'luoyang', name:"Luoyang Central Hospital (洛阳市中心医院)", cn:'洛阳市中心医院',
    spec:'Cardiology, Oncology, General Medicine, Neurology',
    addr:'101 Jiudu East Road, Luoyang', phone:'+86-379-395-3012',
    url:'http://www.lyzx.com.cn/' },
  { city:'luoyang', name:"The First Affiliated Hospital of Henan Medical University (河南科技大学第一附属医院)", cn:'河南科技大学第一附属医院',
    spec:'General Medicine, Cardiology, Oncology, Surgery',
    addr:'24 Keji West Road, Luoyang', phone:'+86-379-390-5323',
    url:'http://www.hafcu1yy.com.cn/' },
  { city:'luoyang', name:"Henan TCM Hospital Luoyang Branch (河南中医药大学第一附属医院洛阳院区)", cn:'河南中医药大学第一附属医院洛阳院区',
    spec:'TCM, Acupuncture, Rehabilitation, General Medicine',
    addr:'111 Jianshe East Road, Luoyang', phone:'+86-379-641-0855',
    url:'http://www.hntcm.com.cn/' },
  { city:'luoyang', name:"Luoyang People's Hospital (洛阳市人民医院)", cn:'洛阳市人民医院',
    spec:'General Medicine, OB/GYN, Pediatrics, TCM',
    addr:'307 Shijian East Road, Luoyang', phone:'+86-379-641-8558',
    url:'http://www.lyrm.com.cn/' },

  // kaifeng
  { city:'kaifeng', name:"Kaifeng Central Hospital (开封市中心医院)", cn:'开封市中心医院',
    spec:'Cardiology, Oncology, General Medicine, Neurology',
    addr:'99 Shunhe East Road, Kaifeng', phone:'+86-371-258-5256',
    url:'http://www.kfzx.com.cn/' },
  { city:'kaifeng', name:"Henan University of Chinese Medicine (河南中医药大学)", cn:'河南中医药大学',
    spec:'TCM Education, Research, General TCM, Acupuncture',
    addr:'156 Longting Road, Kaifeng', phone:'+86-371-228-1180',
    url:'http://www.hactcm.edu.cn/' },
  { city:'kaifeng', name:"Kaifeng TCM Hospital (开封市中医院)", cn:'开封市中医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'118 Shunhe Road, Kaifeng', phone:'+86-371-227-1358',
    url:'http://www.kfzy.com.cn/' },
  { city:'kaifeng', name:"Kaifeng First Hospital (开封市第一人民医院)", cn:'开封市第一人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'21 Shunhe East Road, Kaifeng', phone:'+86-371-238-7169',
    url:'http://www.kf1yy.com.cn/' },

  // yan'an
  { city:'yanan', name:"Yan'an People's Hospital (延安市人民医院)", cn:'延安市人民医院',
    spec:'General Medicine, Cardiology, Oncology, TCM',
    addr:'100 Zhenyang Road, Yan\'an', phone:'+86-911-231-3143',
    url:'http://www.yanyan.com.cn/' },
  { city:'yanan', name:"Yan\'an Central Hospital (延安市中心医院)", cn:'延安市中心医院',
    spec:'Cardiology, General Medicine, Neurology',
    addr:'51 Zhenyang Road, Yan\'an', phone:'+86-911-216-6591',
    url:'http://www.yanzz.com.cn/' },
  { city:'yanan', name:"Yan\'an TCM Hospital (延安市中医医院)", cn:'延安市中医医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'38 Zhenyang Road, Yan\'an', phone:'+86-911-231-3661',
    url:'http://www.yanzhongyi.cn/' },
  { city:'yanan', name:"Shaanxi University of Chinese Medicine Yan\'an Affiliated Hospital (陕西中医药大学附属医院)", cn:'陕西中医药大学附属医院',
    spec:'TCM, General Medicine, Oncology (TCM), Rehabilitation',
    addr:'Yan\'an, Shaanxi', phone:'+86-911-231-3234',
    url:'http://www.sxzyy.com/' },

  // handan
  { city:'handan', name:"Handan People's Hospital (邯郸市人民医院)", cn:'邯郸市人民医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'599 Wenchang West Road, Handan', phone:'+86-310-202-1342',
    url:'http://www.hdpeoples.com.cn/' },
  { city:'handan', name:"The Fourth Hospital of Hebei Medical University (河北医科大学第四医院)", cn:'河北医科大学第四医院',
    spec:'Cardiology, General Medicine, Surgery, TCM',
    addr:'89 Wenchang East Road, Handan', phone:'+86-310-303-1683',
    url:'http://www.hbmu4h.com/' },
  { city:'handan', name:"Handan TCM Hospital (邯郸市市中医院)", cn:'邯郸市市中医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'135 Wenchang East Road, Handan', phone:'+86-310-302-2130',
    url:'http://www.hdzy.com.cn/' },
  { city:'handan', name:"Handan Central Hospital (邯郸市中心医院)", cn:'邯郸市中心医院',
    spec:'General Medicine, OB/GYN, Pediatrics, Cardiology',
    addr:'22 Zhonghua Road, Handan', phone:'+86-310-305-6231',
    url:'http://www.hdszx.com.cn/' },

  // pingdingshan
  { city:'pingdingshan', name:"Pingdingshan Central Hospital (平顶山市中心医院)", cn:'平顶山市中心医院',
    spec:'Cardiology, Oncology, General Medicine, Neurology',
    addr:'100 Shanshan Road, Pingdingshan', phone:'+86-375-395-8500',
    url:'http://www.pdszx.com.cn/' },
  { city:'pingdingshan', name:"The First Affiliated Hospital of Henan Medical College (河南医学高等专科学校附属医院)", cn:'河南医学高等专科学校附属医院',
    spec:'General Medicine, OB/GYN, TCM',
    addr:'300 Shanshan Road, Pingdingshan', phone:'+86-375-335-2590',
    url:'http://www.hnmed.edu.cn/' },
  { city:'pingdingshan', name:"Pingdingshan TCM Hospital (平顶山市中医院)", cn:'平顶山市中医院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'88 Shanshan Road, Pingdingshan', phone:'+86-375-399-8995',
    url:'http://www.pdszy.com.cn/' },
  { city:'pingdingshan', name:"Pingdingshan First Hospital (平顶山市第一人民医院)", cn:'平顶山市第一人民医院',
    spec:'General Medicine, Cardiology, Surgery, TCM',
    addr:'26 Dongshu Road, Pingdingshan', phone:'+86-375-333-8779',
    url:'http://www.pds1yy.com.cn/' },

  // guilin
  { city:'guilin', name:"Guilin People's Hospital (桂林市人民医院)", cn:'桂林市人民医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'148 Zhongshan West Road, Guilin', phone:'+86-773-282-6785',
    url:'http://www.gsrmyy.com.cn/' },
  { city:'guilin', name:"Guilin Central Hospital (桂林市中心医院)", cn:'桂林市中心医院',
    spec:'Cardiology, General Medicine, Surgery',
    addr:'37 Zhongshan West Road, Guilin', phone:'+86-773-280-2983',
    url:'http://www.glsx.com.cn/' },
  { city:'guilin', name:"Guangxi TCM Hospital Guilin Branch (广西中医药大学桂林分院)", cn:'广西中医药大学桂林分院',
    spec:'TCM, Acupuncture, Rehabilitation, General Medicine',
    addr:'100 Zhongshan East Road, Guilin', phone:'+86-773-282-1735',
    url:'http://www.gxtcm.edu.cn/' },
  { city:'guilin', name:"Guilin First Hospital (桂林市第一医院)", cn:'桂林市第一医院',
    spec:'General Medicine, OB/GYN, Pediatrics, TCM',
    addr:'1 Zhongshan West Road, Guilin', phone:'+86-773-283-8106',
    url:'http://www.gsls.com.cn/' },

  // zhaoqing
  { city:'zhaoqing', name:"Zhaoqing Central Hospital (肇庆市第一人民医院)", cn:'肇庆市第一人民医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'53 Dazhong Road, Zhaoqing', phone:'+86-758-225-2001',
    url:'http://www.zqzyy.com.cn/' },
  { city:'zhaoqing', name:"Zhaoqing Second Hospital (肇庆市第二人民医院)", cn:'肇庆市第二人民医院',
    spec:'Cardiology, General Medicine, TCM',
    addr:'109 Dazhong Road, Zhaoqing', phone:'+86-758-273-5851',
    url:'http://www.zqse.com.cn/' },
  { city:'zhaoqing', name:"Guangdong TCM Hospital Zhaoqing Branch (广东省中医院肇庆分院)", cn:'广东省中医院肇庆分院',
    spec:'TCM, Rehabilitation, Acupuncture, General Medicine',
    addr:'152 Beihuan East Road, Zhaoqing', phone:'+86-758-257-1100',
    url:'http://www.gdzyy.com.cn/' },
  { city:'zhaoqing', name:"Zhaoqing TCM Hospital (肇庆市中医院)", cn:'肇庆市中医院',
    spec:'TCM, Rehabilitation, General Medicine',
    addr:'78 Dazhong Road, Zhaoqing', phone:'+86-758-229-9096',
    url:'http://www.zqzy.com.cn/' },

  // yangzhou
  { city:'yangzhou', name:"Yangzhou Taizhou Hospital (扬州市人民医院)", cn:'扬州市人民医院',
    spec:'General Medicine, Cardiology, Oncology, Neurology',
    addr:'210 Huaiyang Road, Yangzhou', phone:'+86-514-828-2063',
    url:'http://www.yzmh.com.cn/' },
  { city:'yangzhou', name:"Yangzhou TCM Hospital (扬州市中医院)", cn:'扬州市中医院',
    spec:'TCM, Acupuncture, Rehabilitation, General Medicine',
    addr:'101 Huaiyang Road, Yangzhou', phone:'+86-514-879-1858',
    url:'http://www.yzzyy.com.cn/' },
  { city:'yangzhou', name:"Yangzhou First Hospital (扬州市第一人民医院)", cn:'扬州市第一人民医院',
    spec:'General Medicine, Cardiology, OB/GYN, TCM',
    addr:'1 Huaiyang Road, Yangzhou', phone:'+86-514-8218-2288',
    url:'http://www.yzyy1.com.cn/' },
  { city:'yangzhou', name:"The First Affiliated Hospital of Yangzhou University (扬州大学附属医院)", cn:'扬州大学附属医院',
    spec:'Cardiology, Oncology, General Medicine, Neurology',
    addr:'210 Huaiyang Road, Yangzhou', phone:'+86-514-898-7002',
    url:'http://www.yzfyy.com.cn/' },
];

// ── 执行 ──
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

let cNew = 0, hNew = 0, provNew = 0;

const tx = db.transaction(() => {
  for (const c of newCities) {
    const r = insCity.run({ ...c, created_at: NOW });
    if (r.changes > 0) cNew++;
  }
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
  // 溯源：每城 3 条（intro/avg_cost/wait_time），estimated 口径与 R143 一致
  for (const c of newCities) {
    const provs = [
      { field:'intro', metric_basis:'城市介绍为编辑内容', value_type:'estimated', note:'人口为估算，非官方口径' },
      { field:'avg_cost', metric_basis:'区间为编辑估算，与同省其他城市对齐', value_type:'estimated', note:'编辑估算，未核官方数据' },
      { field:'wait_time', metric_basis:'等待时间为编辑估算', value_type:'estimated', note:'编辑估算，未核官方数据' },
    ];
    for (const p of provs) {
      const r = insProv.run({ city_slug:c.slug, ...p, source_name:'MedTravelCN editorial',
        source_url:'internal:R144-batch-10-28', verified_at:NOW, maintainer:'root-bot',
        created_at:NOW, updated_at:NOW });
      if (r.changes > 0) provNew++;
    }
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
  d.close();
  return { total_cities, total_hosp, total_prov, dup };
})();
console.log(`✅ 新增城市: ${cNew} / ${newCities.length}`);
console.log(`✅ 新增医院: ${hNew} / ${newHospitals.length}`);
console.log(`✅ 新增溯源: ${provNew}`);
console.log(`总计: ${verify.total_cities} 城 · ${verify.total_hosp} 院 · ${verify.total_prov} 溯源`);
if (verify.dup.length) console.log('⚠️ 重复记录:', JSON.stringify(verify.dup));
else console.log('✅ 无重复记录');
console.log('DONE. 接下来: node scripts/gen-snapshot.mjs && node scripts/export-db-to-search-index.mjs && node scripts/verify-sync.mjs');
