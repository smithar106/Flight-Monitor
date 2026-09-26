import { NextResponse } from "next/server";
import { mlflowEnabled } from "@/lib/mlflow";
import { llmAvailable, llmProvider, llmModel } from "@/lib/llm";
import { liveFlightsAvailable } from "@/lib/aviationstack";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      llm: { available: llmAvailable(), provider: llmProvider(), model: llmModel() },
      dataSource: liveFlightsAvailable() ? "aviationstack" : "synthetic",
      mlflow: mlflowEnabled(),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
