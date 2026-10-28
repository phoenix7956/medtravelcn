import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
const src = readFileSync('scripts/add-batch-2026-10-28b.mjs','utf8');
// Extract fillIntro keys
const fillIntroM = src.match(/fillIntro = \{([\s\S]*?)\n\};/);
const fillIntroKeys = fillIntroM[1].match(/^[ ]+(\w+):/gm).map(s=>s.trim().replace(':','').trim());
// Extract newCities slugs
const ncM = src.match(/newCities = \[([\s\S]*?)\n\];/);
const newCitySlugs = ncM[1].match(/slug:'(\w+)'/g).map(s=>s.match(/'(\w+)'/)[1]);
// Extract newHospitals city slugs
const nhM = src.match(/newHospitals = \[([\s\S]*?)\n\];/);
const hospCities = [...nhM[1].matchAll(/\{ city:'(\w+)'/g)].map(m=>m[1]);
const hospCitySet = new Set(hospCities);
// Check fillIntro keys against existing DB cities
const db = new Database('data/medtravelcn.db',{readonly:true});
const existingSlugs = new Set(db.prepare('SELECT slug FROM cities').all().map(r=>r.slug));
const missingInDb = fillIntroKeys.filter(k=>!existingSlugs.has(k));
console.log('fillIntro keys not in DB:', missingInDb);
// Check newCity slugs not already in DB
const existingNew = newCitySlugs.filter(s=>existingSlugs.has(s));
console.log('newCity slugs already in DB:', existingNew);
// Check all hosp cities are in newCitySlugs
const badHosp = [...hospCitySet].filter(c=>!newCitySlugs.includes(c));
console.log('hosp cities not in newCities:', badHosp);
// Check no duplicate hosp within newHospitals
const names = [...nhM[1].matchAll(/name:"([^"]+)"/g)].map(m=>m[1]);
const nameSet = new Set(names);
console.log('hosp total:', names.length, 'unique:', nameSet.size);
console.log("validation complete");
