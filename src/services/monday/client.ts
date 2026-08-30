/**
 * monday.com API service layer.
 *
 * STATUS: Not yet implemented (scaffolded in this stage).
 * This module will be responsible for:
 *   - authenticating against the monday.com GraphQL API using
 *     MONDAY_API_TOKEN
 *   - fetching all items from the Work Orders and Deals boards
 *     (MONDAY_WORK_ORDERS_BOARD_ID / MONDAY_DEALS_BOARD_ID)
 *   - paginating through large boards
 *   - handling and classifying API errors (auth, rate limit, network,
 *     malformed response) without crashing the app
 *
 * Nothing in this file should ever run in the browser - it is imported
 * only from server-side code (API routes / server actions).
 */

import type { MondayBoardData } from "@/types/domain";

export class MondayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MondayConfigError";
  }
}

export class MondayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "MondayApiError";
  }
}

export interface MondayClientConfig {
  apiToken: string;
  dealsBoardId: string;
  workOrdersBoardId: string;
}

/**
 * Reads and validates the monday.com configuration from environment
 * variables. Throws MondayConfigError with a user-facing message when
 * something required is missing, rather than allowing the app to fall
 * back to fake data.
 */
export function getMondayConfig(): MondayClientConfig {
  const apiToken = process.env.MONDAY_API_TOKEN;
  const dealsBoardId = process.env.MONDAY_DEALS_BOARD_ID;
  const workOrdersBoardId = process.env.MONDAY_WORK_ORDERS_BOARD_ID;

  const missing: string[] = [];
  if (!apiToken) missing.push("MONDAY_API_TOKEN");
  if (!dealsBoardId) missing.push("MONDAY_DEALS_BOARD_ID");
  if (!workOrdersBoardId) missing.push("MONDAY_WORK_ORDERS_BOARD_ID");

  if (missing.length > 0) {
    throw new MondayConfigError(
      `Missing required environment variable(s): ${missing.join(", ")}`,
    );
  }

  return {
    apiToken: apiToken!,
    dealsBoardId: dealsBoardId!,
    workOrdersBoardId: workOrdersBoardId!,
  };
}

/**
 * Fetches all items from the configured Deals board.
 * TODO(next stage): implement GraphQL query + pagination + error handling.
 */
export async function fetchDealsBoard(
  _config: MondayClientConfig,
): Promise<MondayBoardData> {
  throw new Error("fetchDealsBoard is not implemented yet");
}

/**
 * Fetches all items from the configured Work Orders board.
 * TODO(next stage): implement GraphQL query + pagination + error handling.
 */
export async function fetchWorkOrdersBoard(
  _config: MondayClientConfig,
): Promise<MondayBoardData> {
  throw new Error("fetchWorkOrdersBoard is not implemented yet");
}

/**
 * Reports whether the monday.com integration is configured, without
 * making a network call. Used by the UI to show a setup/config state.
 */
export function isMondayConfigured(): boolean {
  try {
    getMondayConfig();
    return true;
  } catch {
    return false;
  }
}
