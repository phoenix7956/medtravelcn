// src/pages/api/track.ts
// View tracking (Vercel KV in prod, SQLite in dev)
import type { APIRoute } from 'astro';
import { incrementView, storageMode } from '~/lib/db';

export const GET: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  if (!/^[a-z0-9-]+$/.test(page)) {
    return new Response('Invalid page', { status: 400 });
  }
  const count = await incrementView(page);
  return new Response(JSON.stringify({ page, views: count, mode: storageMode() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  const count = await incrementView(page);
  return new Response(JSON.stringify({ page, views: count, mode: storageMode() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};