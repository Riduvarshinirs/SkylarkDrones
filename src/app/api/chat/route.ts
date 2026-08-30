import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isMondayConfigured } from "@/services/monday/client";

/**
 * POST /api/chat
 *
 * This route will eventually delegate to
 * services/agent/orchestrator.handleUserQuestion(). For this stage
 * (project setup / UI shell only) it validates the request shape and
 * returns a clear, honest "not implemented" response so the frontend
 * can be built and tested against a real API contract without any
 * fabricated business answers.
 */

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

  if (!isMondayConfigured()) {
    return NextResponse.json(
      {
        error:
          "monday.com is not configured. Set MONDAY_API_TOKEN, " +
          "MONDAY_DEALS_BOARD_ID, and MONDAY_WORK_ORDERS_BOARD_ID to enable live data.",
        code: "MONDAY_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  // The agent pipeline (intent -> fetch -> normalize -> analyze -> LLM)
  // is implemented in a later stage.
  return NextResponse.json(
    {
      error: "The analytics agent is not implemented yet in this build.",
      code: "AGENT_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
}
