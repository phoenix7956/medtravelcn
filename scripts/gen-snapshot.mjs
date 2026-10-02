// scripts/gen-snapshot.mjs
// 从 SQLite 导出 cities/hospitals 为 src/data/snapshot.json
// 生产环境（Vercel serverless）读此文件，绕开 better-sqlite3 native 依赖。
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(join(ROOT, 'data', 'medtravelcn.db'), { readonly: true });

const cities = db.prepare('SELECT * FROM cities ORDER BY name').all();
const hospitals = db
  .prepare('SELECT * FROM hospitals ORDER BY city_slug, sort_order, id')
  .all();

const outDir = join(ROOT, 'src', 'data');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'snapshot.json');
writeFileSync(outFile, JSON.stringify({ cities, hospitals }, null, 0), 'utf-8');

console.log(`✅ snapshot.json written: ${cities.length} cities, ${hospitals.length} hospitals`);
console.log(`   ${outFile}`);
