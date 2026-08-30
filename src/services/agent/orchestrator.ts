/**
 * AI agent orchestrator.
 *
 * STATUS: Not yet implemented (scaffolded in this stage).
 *
 * Planned pipeline for a single user question:
 *   1. classifyIntent(question)      -> QueryIntent          (LLM call #1)
 *   2. fetch relevant board(s) via services/monday
 *   3. normalize via services/data
 *   4. run deterministic analytics via services/analytics
 *   5. interpretResult(analyticsResult) -> AgentResponse      (LLM call #2)
 *
 * The LLM is never given raw board data to answer from directly; it
 * only ever sees the structured AnalyticsResult produced by step 4.
 */

import type { AgentResponse, ChatMessage } from "@/types/domain";

export async function handleUserQuestion(
  _question: string,
  _history: ChatMessage[],
): Promise<AgentResponse> {
  throw new Error("handleUserQuestion is not implemented yet");
}
