// src/pages/api/track.ts
// View tracking (Postgres/SQLite 落库；snapshot 端内存兜底)
import type { APIRoute } from 'astro';
import { incrementView, storeMode } from '~/lib/store';

export const GET: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  if (!/^[a-z0-9-]+$/.test(page)) {
    return new Response('Invalid page', { status: 400 });
  }
  const count = await incrementView(page);
  return new Response(JSON.stringify({ page, views: count, mode: storeMode() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  const count = await incrementView(page);
  return new Response(JSON.stringify({ page, views: count, mode: storeMode() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
