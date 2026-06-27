// src/pages/api/stats.ts
// Dashboard stats - reads from views table (replaces existing api/stats.ts)
import type { APIRoute } from 'astro';
import { getViews } from '~/lib/db';

export const GET: APIRoute = async () => {
  const pages = getViews() as Record<string, number>;
  const total = Object.values(pages).reduce((a, b) => a + b, 0);
  return new Response(JSON.stringify({ pages, total }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};