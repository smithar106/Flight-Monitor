import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Read at runtime (not build time) because Railway's build environment does not
// expose NEXT_PUBLIC_* variables — same reason Mapbox is loaded via /api/config.
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const sitemap = base ? `Sitemap: ${base}/sitemap.xml` : "";
  const body = `User-Agent: *\nAllow: /\n${sitemap}\n`;
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
