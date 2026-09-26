import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Read at runtime (not build time) because Railway's build environment does not
// expose NEXT_PUBLIC_* variables — same reason Mapbox is loaded via /api/config.
export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  const now = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${base}/</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1</priority></url>
<url><loc>${base}/methodology</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
</urlset>`;
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
