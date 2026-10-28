// src/pages/api/reviews.ts
// POST: submit a new review (Postgres/SQLite 落库；无 DB 的 snapshot 端返回 503)
// GET: list approved reviews
import type { APIRoute } from 'astro';
import { insertReview, approvedReviews, storeMode } from '~/lib/store';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const city_slug = formData.get('city_slug')?.toString() || null;
  const hospital_name = formData.get('hospital_name')?.toString().trim() || null;
  const rating = parseInt(formData.get('rating')?.toString() || '0');
  const author = formData.get('author')?.toString().trim();
  const email = formData.get('email')?.toString().trim() || null;
  const country = formData.get('country')?.toString().trim() || null;
  const content = formData.get('content')?.toString().trim();

  // Validate
  if (!author || !content || rating < 1 || rating > 5) {
    return new Response('Invalid submission: author, content, and rating (1-5) are required.', { status: 400 });
  }
  if (content.length < 50) {
    return new Response('Review too short: please write at least 50 characters.', { status: 400 });
  }

  await insertReview({
    city_slug,
    hospital_name,
    rating,
    author,
    email,
    country,
    content,
  });

  return redirect('/submit-review/?success=1', 303);
};

// 旧签名保留兼容：insertReview 在新 store 里是 async，POST 必须 await
export const GET: APIRoute = async ({ url }) => {
  const citySlug = url.searchParams.get('city');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const allReviews = await approvedReviews(limit, citySlug || undefined);
  const filtered = citySlug ? allReviews.filter(r => r.city_slug === citySlug) : allReviews;
  return new Response(JSON.stringify({
    mode: storeMode(),
    count: filtered.length,
    reviews: filtered,
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
