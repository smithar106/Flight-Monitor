import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-state";
import { buildOperationsBrief } from "@/lib/brief";
import {
  clientIp,
  isAuthorized,
  rateLimit,
  globalRateLimit,
} from "@/lib/rate-limit";
import { incr } from "@/lib/observability";

export const dynamic = "force-dynamic";

// Global ceiling across all clients (the brief is auto-loaded on every page
// view, so its global budget is higher than ask's).
const GLOBAL_BRIEF_PER_HOUR = 3000;

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`brief:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!globalRateLimit("brief:global", GLOBAL_BRIEF_PER_HOUR, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Service is busy, please try again shortly" },
      { status: 429 }
    );
  }

  const ctx = await getAppContext();
  const brief = await buildOperationsBrief({
    overview: ctx.overview,
    airports: ctx.airports,
    airlines: ctx.airlines,
    baselineSource: ctx.baselineSource,
    baselinePeriod: ctx.baselinePeriod,
    demo: ctx.demo,
  });
  incr("api.brief");
  return NextResponse.json(brief);
}
