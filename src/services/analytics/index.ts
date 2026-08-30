/**
 * Deterministic analytics engine.
 *
 * STATUS: Not yet implemented (scaffolded in this stage).
 *
 * Every function here performs plain arithmetic/filtering over
 * NormalizedDeal[] / NormalizedWorkOrder[] — no LLM calls happen in
 * this layer. Each function must return an AnalyticsResult carrying
 * a DataQualityReport so the caller always knows how many records
 * were considered vs excluded, and why.
 *
 * These are the "tools" the AI agent will call in the next stage.
 */

import type {
  AnalyticsResult,
  NormalizedDeal,
  NormalizedWorkOrder,
  QueryIntent,
} from "@/types/domain";

export function getPipelineSummary(
  _deals: NormalizedDeal[],
  _intent: QueryIntent,
): AnalyticsResult {
  throw new Error("getPipelineSummary is not implemented yet");
}

export function getRevenueSummary(
  _deals: NormalizedDeal[],
  _intent: QueryIntent,
): AnalyticsResult {
  throw new Error("getRevenueSummary is not implemented yet");
}

export function getSectorPerformance(
  _deals: NormalizedDeal[],
  _workOrders: NormalizedWorkOrder[],
  _intent: QueryIntent,
): AnalyticsResult {
  throw new Error("getSectorPerformance is not implemented yet");
}

export function getOperationalSummary(
  _workOrders: NormalizedWorkOrder[],
  _intent: QueryIntent,
): AnalyticsResult {
  throw new Error("getOperationalSummary is not implemented yet");
}

export function getCustomerSummary(
  _deals: NormalizedDeal[],
  _workOrders: NormalizedWorkOrder[],
  _intent: QueryIntent,
): AnalyticsResult {
  throw new Error("getCustomerSummary is not implemented yet");
}

export function getDataQualityReport(
  _deals: NormalizedDeal[],
  _workOrders: NormalizedWorkOrder[],
): AnalyticsResult {
  throw new Error("getDataQualityReport is not implemented yet");
}

export function generateLeadershipUpdateData(
  _deals: NormalizedDeal[],
  _workOrders: NormalizedWorkOrder[],
): AnalyticsResult {
  throw new Error("generateLeadershipUpdateData is not implemented yet");
}
