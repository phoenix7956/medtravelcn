// scripts/init-sqlite-intl.mjs
// 数据库化补齐：把 init-postgres.mjs 的 12 个国际患者字段
// 用 SQLite ADD COLUMN IF NOT EXISTS 等价语义补进本地 SQLite hospitals 表。
// 幂等：可重复执行。运行前自动备份 DB 到 data/backups/。
//
// 背景：本地 dev 走 SQLite，Vercel 走 Postgres（DATABASE_URL），无 DB 时走 snapshot.json。
// 之前 12 个字段只在 Postgres DDL 里，本地 SQLite 缺失，导致国际患者信息无法入库。
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');

if (!existsSync(DB_PATH)) {
  console.error('❌ DB 不存在：', DB_PATH);
  process.exit(1);
}

// ---- 备份（踩坑硬规则：大改动前必 backup 到 backups/<ts>/）----
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakDir = join(ROOT, 'data', 'backups');
mkdirSync(bakDir, { recursive: true });
// 保留最近 5 份备份，避免无限增长
const existing = readdirSync(bakDir).filter(f => f.startsWith('medtravelcn.db.bak-')).sort();
for (const f of existing.slice(0, Math.max(0, existing.length - 4))) {
  unlinkSync(join(bakDir, f));
  console.log(`  清理旧备份 ${f}`);
}
const bakPath = join(bakDir, `medtravelcn.db.bak-${ts}`);
copyFileSync(DB_PATH, bakPath);
console.log(`✅ 已备份 -> data/backups/${bakPath.split('/').pop()}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 与 init-postgres.mjs 的 ALTER 段完全一致
const ALTERS = [
  `ALTER TABLE hospitals ADD COLUMN jci_certified       BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN accepts_international BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN english_departments  TEXT`,
  `ALTER TABLE hospitals ADD COLUMN booking_method       TEXT`,
  `ALTER TABLE hospitals ADD COLUMN visa_assist          BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN inpatient_standard   TEXT`,
  `ALTER TABLE hospitals ADD COLUMN payment_methods      TEXT`,
  `ALTER TABLE hospitals ADD COLUMN insurance_direct     BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN interpreter_on_site  BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN verified             BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE hospitals ADD COLUMN source_url           TEXT`,
  `ALTER TABLE hospitals ADD COLUMN updated_at            TEXT`,
];

const tx = db.transaction(() => {
  for (const sql of ALTERS) {
    const col = sql.match(/ADD COLUMN (\w+)/)[1];
    const exists = db.prepare(`SELECT 1 FROM pragma_table_info('hospitals') WHERE name = ?`).get(col);
    if (exists) {
      console.log(`  skip（已存在）: ${col}`);
    } else {
      db.exec(sql);
      console.log(`  + ${col}`);
    }
  }
});
tx();

// 校验
const cols = db.prepare(`SELECT name FROM pragma_table_info('hospitals') ORDER BY cid`).all().map(r => r.name);
console.log(`\n✅ hospitals 现有 ${cols.length} 列：`);
console.log(cols.join(', '));
db.close();
console.log('DONE.（Postgres 端对应 DDL 不变，init-postgres.mjs 已有 ADD COLUMN IF NOT EXISTS）');
