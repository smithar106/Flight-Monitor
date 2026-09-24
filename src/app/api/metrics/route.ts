import { NextResponse } from "next/server";
import { metrics } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(metrics());
}
