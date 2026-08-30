/**
 * Data normalization layer.
 *
 * STATUS: Not yet implemented (scaffolded in this stage).
 *
 * This is where raw monday.com board data gets turned into
 * NormalizedDeal[] / NormalizedWorkOrder[], based on the concrete
 * data-quality issues found during dataset inspection:
 *   - junk/duplicate rows
 *   - inconsistent status/sector vocabulary (casing, synonyms)
 *   - dates in mixed formats
 *   - numeric values stored as strings, with units embedded
 *   - missing values that must be preserved as "missing", never guessed
 *   - the Deals<->Work Orders join key transform
 *     (WOCOMPANY_NNN -> COMPANYNNN)
 *
 * Every normalization function should attach DataQualityIssue entries
 * to the record rather than silently dropping or inventing data.
 */

import type {
  MondayBoardData,
  NormalizedDeal,
  NormalizedWorkOrder,
} from "@/types/domain";

/**
 * Converts raw Deals board items into normalized deal records,
 * tagging data-quality issues along the way.
 * TODO(next stage): implement column mapping + cleaning rules.
 */
export function normalizeDeals(_board: MondayBoardData): NormalizedDeal[] {
  throw new Error("normalizeDeals is not implemented yet");
}

/**
 * Converts raw Work Orders board items into normalized work order
 * records, tagging data-quality issues along the way.
 * TODO(next stage): implement column mapping + cleaning rules.
 */
export function normalizeWorkOrders(
  _board: MondayBoardData,
): NormalizedWorkOrder[] {
  throw new Error("normalizeWorkOrders is not implemented yet");
}

/**
 * Derives the shared customer key used to join a deal and a work
 * order (e.g. "COMPANY002" from either "COMPANY002" or
 * "WOCOMPANY_002"). Returns null when no key can be derived.
 * TODO(next stage): implement + unit test against known formats.
 */
export function deriveCustomerKey(_rawCode: string | null): string | null {
  throw new Error("deriveCustomerKey is not implemented yet");
}
