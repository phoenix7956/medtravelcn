// src/pages/api/search.ts
// GET: search hospitals by name, specialty, or city
import type { APIRoute } from 'astro';
import { searchHospitals } from '~/lib/store';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() || '';
  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ error: 'Query too short (min 2 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const results = await searchHospitals(query);
  return new Response(JSON.stringify({ query, count: results.length, results }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
