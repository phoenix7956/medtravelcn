// src/pages/api/stats.ts
// Dashboard stats - Vercel KV in prod, SQLite in dev
import type { APIRoute } from 'astro';
import { viewsOf, storeMode } from '~/lib/store';

export const GET: APIRoute = async () => {
  const pages = (await viewsOf()) as Record<string, number>;
  const total = Object.values(pages).reduce((a, b) => a + b, 0);
  return new Response(JSON.stringify({ mode: storeMode(), pages, total }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
