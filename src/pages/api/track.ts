// src/pages/api/track.ts
// View tracking (replaces existing api/track.ts)
import type { APIRoute } from 'astro';
import { incrementView, getViews } from '~/lib/db';

export const GET: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  if (!/^[a-z0-9-]+$/.test(page)) {
    return new Response('Invalid page', { status: 400 });
  }
  const count = incrementView(page);
  return new Response(JSON.stringify({ page, views: count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ url }) => {
  const page = url.searchParams.get('page') || 'home';
  const count = incrementView(page);
  return new Response(JSON.stringify({ page, views: count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};