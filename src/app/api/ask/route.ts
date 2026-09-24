import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-state";
import { askFlightPulse } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let question: string;
  try {
    const body = (await req.json()) as { question?: string };
    question = (body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const ctx = await getAppContext();
  const answer = await askFlightPulse(
    {
      overview: ctx.overview,
      airports: ctx.airports,
      airlines: ctx.airlines,
      baselineSource: ctx.baselineSource,
      baselinePeriod: ctx.baselinePeriod,
      demo: ctx.demo,
    },
    question
  );
  return NextResponse.json(answer);
}
