// scripts/gen-sitemap.mjs
// R146 数据库化：build 时从 snapshot 生成 public/sitemap.xml（61 城全量，替代旧写死 11 城版）
// 旧根目录 sitemap.xml 已归档删除。域名用 SITE env，缺省 medtravelcn.net（待老板绑域后可改）。
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const snapPath = join(ROOT, 'src', 'data', 'snapshot.json');
if (!existsSync(snapPath)) {
  console.error('❌ snapshot.json 不存在，先跑 node scripts/gen-snapshot.mjs');
  process.exit(1);
}
const snap = JSON.parse(readFileSync(snapPath, 'utf-8'));
const base = process.env.SITE || 'https://medtravelcn.net';

const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${base}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${base}/reviews/`, priority: '0.8', changefreq: 'daily' },
  { loc: `${base}/faq/`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${base}/how-it-works/`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${base}/submit-review/`, priority: '0.5', changefreq: 'monthly' },
];

for (const c of snap.cities) {
  urls.push({
    loc: `${base}/cities/${c.slug}/`,
    priority: '0.9',
    changefreq: 'weekly',
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const outDir = join(ROOT, 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sitemap.xml'), xml, 'utf-8');
console.log(`✅ public/sitemap.xml written: ${urls.length} urls (${snap.cities.length} cities)`);
