import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleUserQuestion } from "@/services/agent/orchestrator";

const requestSchema = z.object({
  question: z.string().min(1, "question is required").max(2000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const result = await handleUserQuestion(parsed.data.question, [], {
      deals: [],
      workOrders: [],
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: message,
        code: "AGENT_ERROR",
      },
      { status: 500 },
    );
  }
}
