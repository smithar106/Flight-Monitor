import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-state";
import { buildOperationsBrief } from "@/lib/brief";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAppContext();
  const brief = await buildOperationsBrief({
    overview: ctx.overview,
    airports: ctx.airports,
    airlines: ctx.airlines,
    baselineSource: ctx.baselineSource,
    baselinePeriod: ctx.baselinePeriod,
  });
  return NextResponse.json(brief);
}
