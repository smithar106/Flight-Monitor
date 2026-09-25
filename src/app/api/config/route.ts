import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public (client-safe) runtime config. The Mapbox token is public (`pk.`),
// so exposing it here is intended.
export async function GET() {
  return NextResponse.json({
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
  });
}
