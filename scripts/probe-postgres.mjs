// Dry-run probe of Postgres init path. Usage:
//   DATABASE_URL='postgresql://...' node scripts/probe-postgres.mjs
import { Client } from 'pg';
const url = process.env.DATABASE_URL;
if (!url) { console.error('need DATABASE_URL'); process.exit(1); }
const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1|\.local/.test(url) ? false : { rejectUnauthorized: false } });
try {
  await c.connect();
  const { rows } = await c.query('SELECT current_database() db, version()');
  console.log('connected:', rows[0]);
  const t = await c.query(`SELECT to_regclass('public.hospitals') AS has_hospitals, to_regclass('public.cities') AS has_cities, to_regclass('public.reviews') AS has_reviews`);
  console.log('tables:', JSON.stringify(t.rows[0]));
  if (t.rows[0].has_hospitals) {
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='hospitals' ORDER BY ordinal_position`);
    console.log('hospitals cols:', cols.rows.map(r=>r.column_name).join(', '));
    const n = await c.query('SELECT COUNT(*)::int n FROM hospitals');
    const nc = await c.query('SELECT COUNT(*)::int n FROM cities');
    console.log(`DB: cities=${nc.rows[0].n} hospitals=${n.rows[0].n}`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(2);
} finally { await c.end(); }
