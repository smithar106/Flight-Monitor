import { NextResponse } from "next/server";
import { metrics } from "@/lib/observability";
import { isAuthorized } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(metrics(), {
    headers: { "Cache-Control": "no-store" },
  });
}
