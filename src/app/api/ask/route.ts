import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-state";
import { askFlightPulse } from "@/lib/agent";
import {
  clientIp,
  isAuthorized,
  rateLimit,
  globalRateLimit,
} from "@/lib/rate-limit";
import { incr } from "@/lib/observability";

export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 400;
// Global ceiling across all clients, independent of per-IP limits. The monthly
// budget (enforced in llm.ts) remains the hard cost ceiling.
const GLOBAL_ASK_PER_HOUR = 600;

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ask:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!globalRateLimit("ask:global", GLOBAL_ASK_PER_HOUR, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Service is busy, please try again shortly" },
      { status: 429 }
    );
  }

  let question: string;
  try {
    const body = (await req.json()) as { question?: string };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters)` },
      { status: 400 }
    );
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
  incr("api.ask");
  return NextResponse.json(answer);
}
