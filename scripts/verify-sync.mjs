// scripts/verify-sync.mjs
// R142 数据治理：DB ↔ search_index.json 一致性校验
// 背景：migrate.mjs 是破坏性的（DELETE FROM hospitals/cities 后从 search_index.json 重灌），
//       一旦 search_index.json 落后于 DB 并单独执行 db:migrate，就会静默丢数据。
//       本脚本把「是否同步」变成可核验的显式检查，而不是靠肉眼看 git。
//
// Run: node scripts/verify-sync.mjs   （退出码 0 = 同步，1 = 不一致）

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, 'data', 'medtravelcn.db');
const IDX = join(ROOT, 'search_index.json');

if (!existsSync(DB_PATH) || !existsSync(IDX)) {
  console.error('❌ 缺少 data/medtravelcn.db 或 search_index.json');
  process.exit(1);
}

// better-sqlite3 + Node 24 的 cleanup-hook 断言崩溃（Statement GC 析构时
// 触发 env==null assertion），解法：把 DB 查询结果在 db.close() 前都取出来，
// 且不在 close 之后还留着任何 prepared statement 的引用。
// Node 24 + better-sqlite3 cleanup-hook bug：
// 任何 Statement 在 GC 析构时若 env 为 null 就会触发 Assertion failed: (env) != nullptr。
// 根因：模块顶层的 import 持有 statement 引用，close 之后 GC 时 env 已销毁。
// 解法：把所有查询包进 try/finally，先 close db，再 delete 掉所有 local 引用。
function dbCounts() {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const c = db.prepare('SELECT COUNT(*) n FROM cities').get().n;
    const h = db.prepare('SELECT COUNT(*) n FROM hospitals').get().n;
    let prov = null;
    try { prov = db.prepare('SELECT COUNT(*) n FROM data_provenance').get().n; }
    catch { console.warn('⚠️  data_provenance 表不存在，先跑: npm run db:provenance'); }
    return { c, h, prov };
  } finally {
    db.close();
  }
}
const { c, h, prov } = dbCounts();

const idx = JSON.parse(readFileSync(IDX, 'utf8'));
const ih = idx.reduce((a, x) => a + (x.hospitals?.length || 0), 0);

const ok = c === idx.length && h === ih;

console.log(`DB              : ${c} cities / ${h} hospitals` + (prov !== null ? ` / ${prov} provenance` : ''));
console.log(`search_index.json: ${idx.length} cities / ${ih} hospitals`);

if (ok) {
  console.log('✅ IN SYNC — db:migrate 可安全执行');
  process.exit(0);
}

console.error('❌ MISMATCH — 不要执行 npm run db:migrate（会丢数据）');
console.error(`   先跑: npm run db:export`);
process.exit(1);
