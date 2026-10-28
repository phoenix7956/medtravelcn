// src/lib/data.ts — 生产环境数据层（零 native 依赖）
// 背景：better-sqlite3 在 Vercel serverless 里打不开（SqliteError: unable to open database file），
// 且 native 模块 ABI 与 Vercel Node runtime 不一定匹配。
// 生产改读 build 时生成的静态 JSON；本地 dev 仍可用 SQLite。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { City, Hospital } from './db';

interface Payload {
  cities: City[];
  hospitals: Hospital[];
}

let _data: Payload | null = null;

function loadJson(): Payload {
  if (_data) return _data;
  const candidates = [
    join(process.cwd(), 'src', 'data', 'snapshot.json'),
    join(process.cwd(), 'data', 'snapshot.json'),
    join(process.cwd(), '..', 'src', 'data', 'snapshot.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      _data = JSON.parse(readFileSync(p, 'utf-8')) as Payload;
      return _data;
    }
  }
  throw new Error(`snapshot.json not found. Tried: ${candidates.join(', ')}`);
}

export function listCities(): City[] {
  return loadJson().cities;
}

export function findCity(slug: string): City | undefined {
  return loadJson().cities.find(c => c.slug === slug);
}

export function hospitalsOf(citySlug: string): Hospital[] {
  return loadJson()
    .hospitals.filter(h => h.city_slug === citySlug)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function countHospitals(citySlug: string): number {
  return loadJson().hospitals.filter(h => h.city_slug === citySlug).length;
}

export function allHospitals(): Hospital[] {
  return loadJson().hospitals;
}

export function searchHospitalsText(query: string): Hospital[] {
  const q = query.toLowerCase();
  const cities = new Map(loadJson().cities.map(c => [c.slug, c]));
  return loadJson()
    .hospitals.filter(h => {
      const city = cities.get(h.city_slug);
      return [h.name, h.specialties, h.chinese_name, city?.name]
        .some(v => (v || '').toLowerCase().includes(q));
    })
    .slice(0, 30);
}
