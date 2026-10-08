/**
 * The absolute site origin, needed for OG image URLs, robots and the sitemap.
 * Prefer an explicit public URL, fall back to Vercel's production domain at
 * build time, and only use localhost when neither is available.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")