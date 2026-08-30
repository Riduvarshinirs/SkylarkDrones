import test from "node:test";
import assert from "node:assert/strict";

import { fetchDealsBoard, fetchWorkOrdersBoard, getMondayConfig, MondayConfigError } from "./client";

test("getMondayConfig requires all server-side env vars", () => {
  const previous = {
    MONDAY_API_TOKEN: process.env.MONDAY_API_TOKEN,
    MONDAY_DEALS_BOARD_ID: process.env.MONDAY_DEALS_BOARD_ID,
    MONDAY_WORK_ORDERS_BOARD_ID: process.env.MONDAY_WORK_ORDERS_BOARD_ID,
  };

  delete process.env.MONDAY_API_TOKEN;
  delete process.env.MONDAY_DEALS_BOARD_ID;
  delete process.env.MONDAY_WORK_ORDERS_BOARD_ID;

  try {
    assert.throws(() => getMondayConfig(), (error: unknown) => error instanceof MondayConfigError);
  } finally {
    Object.assign(process.env, previous);
  }
});

test("fetchDealsBoard parses monday GraphQL pagination and keeps live metadata", async () => {
  const previousFetch = globalThis.fetch;
  const originalToken = process.env.MONDAY_API_TOKEN;
  const originalBoardId = process.env.MONDAY_DEALS_BOARD_ID;
  process.env.MONDAY_API_TOKEN = "token-123";
  process.env.MONDAY_DEALS_BOARD_ID = "deals-board";

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        data: {
          boards: [
            {
              items_page: {
                cursor: calls > 1 ? null : "next-cursor",
                items: calls > 1 ? [] : [
                  {
                    id: "d1",
                    name: "Deal A",
                    column_values: [
                      { id: "status", text: "Open", value: "\"Open\"", type: "text" },
                      { id: "dealvalue", text: "₹1,000", value: "\"₹1,000\"", type: "numeric" },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    };
  }) as unknown as typeof fetch;

  try {
    const result = await fetchDealsBoard({ apiToken: "token-123", dealsBoardId: "deals-board", workOrdersBoardId: "wo-board" });
    assert.equal(result.boardId, "deals-board");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, "Deal A");
    assert.ok(result.fetchedAt.length > 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (originalToken === undefined) delete process.env.MONDAY_API_TOKEN; else process.env.MONDAY_API_TOKEN = originalToken;
    if (originalBoardId === undefined) delete process.env.MONDAY_DEALS_BOARD_ID; else process.env.MONDAY_DEALS_BOARD_ID = originalBoardId;
  }
});

test("fetchDealsBoard rejects repeated pagination cursors to prevent infinite loops", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      data: {
        boards: [
          {
            items_page: {
              cursor: "repeat-cursor",
              items: [{ id: "d1", name: "Deal A", column_values: [] }],
            },
          },
        ],
      },
    }),
  })) as unknown as typeof fetch;

  try {
    await assert.rejects(
      () => fetchDealsBoard({ apiToken: "token-123", dealsBoardId: "deals-board", workOrdersBoardId: "wo-board" }),
      (error: unknown) => error instanceof Error && /pagination loop|same cursor|monday/i.test(error.message),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("fetchWorkOrdersBoard handles API errors without fabricating data", async () => {
  const previousFetch = globalThis.fetch;
  const originalToken = process.env.MONDAY_API_TOKEN;
  const originalBoardId = process.env.MONDAY_WORK_ORDERS_BOARD_ID;
  process.env.MONDAY_API_TOKEN = "token-123";
  process.env.MONDAY_WORK_ORDERS_BOARD_ID = "wo-board";

  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    json: async () => ({ errors: [{ message: "Unauthorized" }] }),
  })) as unknown as typeof fetch;

  try {
    await assert.rejects(
      () => fetchWorkOrdersBoard({ apiToken: "token-123", dealsBoardId: "deals-board", workOrdersBoardId: "wo-board" }),
      (error: unknown) => error instanceof Error && /Unauthorized|token|monday/i.test(error.message),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (originalToken === undefined) delete process.env.MONDAY_API_TOKEN; else process.env.MONDAY_API_TOKEN = originalToken;
    if (originalBoardId === undefined) delete process.env.MONDAY_WORK_ORDERS_BOARD_ID; else process.env.MONDAY_WORK_ORDERS_BOARD_ID = originalBoardId;
  }
});
