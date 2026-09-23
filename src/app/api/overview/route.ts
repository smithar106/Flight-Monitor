import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAppContext();
  return NextResponse.json(ctx, {
    headers: { "Cache-Control": "public, max-age=45, s-maxage=45" },
  });
}
