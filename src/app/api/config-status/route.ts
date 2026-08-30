import { NextResponse } from "next/server";
import { isMondayConfigured } from "@/services/monday/client";

/**
 * GET /api/config-status
 *
 * Lets the frontend show an accurate "not configured yet" state
 * instead of silently pretending the app is production-ready.
 * Never returns secret values, only booleans.
 */
export async function GET() {
  return NextResponse.json({
    mondayConfigured: isMondayConfigured(),
    agentImplemented: false,
  });
}
