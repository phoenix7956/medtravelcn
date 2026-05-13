import { kv } from '@vercel/kv';

const PAGES = [
  'home', 'faq', 'how-it-works', 'reviews', 'submit-review',
  'beijing', 'chengdu', 'chongqing', 'guangzhou', 'hangzhou',
  'nanjing', 'shanghai', 'shenzhen', 'tianjin', 'wuhan', 'xian',
];

export default async function handler() {
  try {
    const results: Record<string, number> = {};
    
    // Fetch all page views in parallel
    const pipeline = await Promise.all(
      PAGES.map(async (page) => {
        const count = await kv.get<number>(`views:${page}`);
        return [page, count ?? 0] as const;
      })
    );

    for (const [page, count] of pipeline) {
      results[page] = count;
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({ pages: results, total }, null, 2),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('KV error:', error);
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
