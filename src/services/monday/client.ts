/**
 * monday.com API service layer.
 *
 * This module is the server-side boundary to monday.com. It validates the
 * required environment settings, calls the monday.com GraphQL API with
 * pagination, and transforms the raw response into the app's typed board data.
 */

import type { MondayBoardData, MondayColumnValue, MondayItem } from "@/types/domain";

const MONDAY_GRAPHQL_URL = "https://api.monday.com/v2";

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
      `Missing required environment variable(s): ${missing.join(", ")}. Set them on the server before using live monday.com data.`,
    );
  }

  const resolvedApiToken = String(apiToken).trim();
  const resolvedDealsBoardId = String(dealsBoardId).trim();
  const resolvedWorkOrdersBoardId = String(workOrdersBoardId).trim();

  return {
    apiToken: resolvedApiToken,
    dealsBoardId: resolvedDealsBoardId,
    workOrdersBoardId: resolvedWorkOrdersBoardId,
  };
}

function safeExtractMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "The monday.com request failed.";

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  const errors = candidate.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (first && typeof first === "object" && "message" in first && typeof first.message === "string") {
      return first.message;
    }
  }

  return "The monday.com request failed.";
}

function mapColumnValue(raw: Record<string, unknown>): MondayColumnValue {
  const value = typeof raw.value === "string" ? raw.value : null;
  return {
    id: typeof raw.id === "string" ? raw.id : "unknown",
    text: typeof raw.text === "string" ? raw.text : null,
    value,
    type: typeof raw.type === "string" ? raw.type : undefined,
  };
}

function mapBoardItem(raw: Record<string, unknown>): MondayItem {
  const columnValues = Array.isArray(raw.column_values)
    ? raw.column_values
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
        .map(mapColumnValue)
    : [];

  return {
    id: typeof raw.id === "string" ? raw.id : String(raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : "",
    column_values: columnValues,
  };
}

async function fetchBoardPage(
  config: MondayClientConfig,
  boardId: string,
  boardName: string,
  cursor: string | null,
): Promise<{ boardId: string; boardName: string; items: MondayItem[]; nextCursor: string | null }> {
  const query = `
    query BoardItems($boardId: ID!, $cursor: String) {
      boards(ids: [$boardId]) {
        id
        name
        items_page(limit: 500, cursor: $cursor) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
              type
            }
          }
        }
      }
    }
  `;

  const response = await fetch(MONDAY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { boardId, cursor },
    }),
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Response body may be empty; the HTTP status already tells us the failure.
    }
    const message = safeExtractMessage(payload).replace(/\s+/g, " ").trim();
    throw new MondayApiError(
      `monday.com API request failed for board ${boardId}: ${message}`,
      response.status,
    );
  }

  const payload = (await response.json()) as { data?: { boards?: Array<Record<string, unknown>> } };
  const board = Array.isArray(payload.data?.boards)
    ? payload.data.boards[0]
    : undefined;

  if (!board) {
    throw new MondayApiError(
      `monday.com returned no board data for board ${boardId}. Check the board ID and permission scope.`,
      404,
    );
  }

  const page = board.items_page as Record<string, unknown> | undefined;
  const items = Array.isArray(page?.items)
    ? page.items
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
        .map(mapBoardItem)
    : [];

  const nextCursor = typeof page?.cursor === "string" ? page.cursor : null;
  return {
    boardId,
    boardName: typeof board.name === "string" ? board.name : boardName,
    items,
    nextCursor,
  };
}

async function fetchBoard(
  config: MondayClientConfig,
  boardId: string,
  boardName: string,
): Promise<MondayBoardData> {
  let cursor: string | null = null;
  const items: MondayItem[] = [];

  do {
    const page = await fetchBoardPage(config, boardId, boardName, cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return {
    boardId,
    boardName,
    items,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchDealsBoard(
  config: MondayClientConfig,
): Promise<MondayBoardData> {
  return fetchBoard(config, config.dealsBoardId, "Deals");
}

export async function fetchWorkOrdersBoard(
  config: MondayClientConfig,
): Promise<MondayBoardData> {
  return fetchBoard(config, config.workOrdersBoardId, "Work Orders");
}

export function isMondayConfigured(): boolean {
  try {
    getMondayConfig();
    return true;
  } catch {
    return false;
  }
}
