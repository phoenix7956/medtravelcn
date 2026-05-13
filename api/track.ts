import { kv } from '@vercel/kv';

export default async function handler(request: Request) {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const page = url.searchParams.get('page') || 'home';

  // Validate page name (alphanumeric + dash)
  if (!/^[a-z0-9-]+$/.test(page)) {
    return new Response('Invalid page', { status: 400 });
  }

  try {
    const key = `views:${page}`;
    const count = await kv.incr(key);
    return new Response(JSON.stringify({ page, views: count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('KV error:', error);
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
