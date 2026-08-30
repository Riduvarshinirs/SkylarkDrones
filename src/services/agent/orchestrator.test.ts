import test from "node:test";
import assert from "node:assert/strict";

import {
  buildToolPlan,
  classifyQuestion,
  handleUserQuestion,
} from "./orchestrator";

const baseDeals = [
  {
    itemId: "d1",
    dealName: "Northwind Energy",
    ownerCode: "O1",
    clientCode: "C1",
    dealStatus: "Won",
    actualCloseDate: "2026-01-15",
    closureProbability: "90%",
    dealValue: 150000,
    tentativeCloseDate: "2026-01-20",
    dealStage: "Proposal",
    productDeal: "Energy",
    sector: "Energy",
    createdDate: "2025-11-01",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
  {
    itemId: "d2",
    dealName: "BluePeak Ops",
    ownerCode: "O2",
    clientCode: "C2",
    dealStatus: "Open",
    actualCloseDate: null,
    closureProbability: "60%",
    dealValue: 120000,
    tentativeCloseDate: "2026-02-10",
    dealStage: "Negotiation",
    productDeal: "Infrastructure",
    sector: "Infrastructure",
    createdDate: "2025-12-05",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
  {
    itemId: "d3",
    dealName: "Harbor Logistics",
    ownerCode: "O3",
    clientCode: "C3",
    dealStatus: "Lost",
    actualCloseDate: "2025-12-20",
    closureProbability: null,
    dealValue: 80000,
    tentativeCloseDate: null,
    dealStage: "Closed",
    productDeal: "Logistics",
    sector: "Logistics",
    createdDate: "2025-09-02",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
];

const baseWorkOrders = [
  {
    itemId: "w1",
    dealNameMasked: "Northwind Energy",
    customerNameCode: "C1",
    serialNumber: "SN-1",
    natureOfWork: "Maintenance",
    executionStatus: "Completed",
    dataDeliveryDate: "2026-01-10",
    poDate: "2025-12-01",
    documentType: "Invoice",
    probableStartDate: "2025-12-15",
    probableEndDate: "2026-01-10",
    ownerCode: "O1",
    sector: "Energy",
    typeOfWork: "Repair",
    amountExclGst: 70000,
    amountInclGst: 77000,
    billedValueExclGst: 70000,
    billedValueInclGst: 77000,
    collectedAmountInclGst: 70000,
    amountReceivable: 0,
    invoiceStatus: "Paid",
    woStatusBilled: "Completed",
    billingStatus: "Paid",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
  {
    itemId: "w2",
    dealNameMasked: "BluePeak Ops",
    customerNameCode: "C2",
    serialNumber: "SN-2",
    natureOfWork: "Inspection",
    executionStatus: "Delayed",
    dataDeliveryDate: "2026-02-15",
    poDate: "2025-12-12",
    documentType: "PO",
    probableStartDate: "2026-01-02",
    probableEndDate: "2026-02-01",
    ownerCode: "O2",
    sector: "Infrastructure",
    typeOfWork: "Inspection",
    amountExclGst: 52000,
    amountInclGst: 57000,
    billedValueExclGst: 20000,
    billedValueInclGst: 22000,
    collectedAmountInclGst: 15000,
    amountReceivable: 5000,
    invoiceStatus: "Pending",
    woStatusBilled: "Delayed",
    billingStatus: "Open",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
];

function mockOpenAIResponse(payload: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
  } as Response)) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

for (const [question, expectedType] of [
  ["How is our pipeline looking this quarter?", "pipeline_analysis"],
  ["What is our total pipeline?", "pipeline_analysis"],
  ["Which sector has the strongest pipeline?", "sector_analysis"],
  ["Show me the energy sector.", "sector_analysis"],
  ["What are our biggest opportunities?", "pipeline_analysis"],
  ["Which deals are at risk?", "risk_identification"],
  ["What is our revenue?", "revenue_analysis"],
  ["How many work orders are delayed?", "work_order_analysis"],
  ["What is our operational performance?", "work_order_analysis"],
  ["Compare sales pipeline and work-order activity.", "cross_board_analysis"],
  ["Give me a leadership update.", "leadership_summary"],
] as const) {
  test(`classifies "${question}" as ${expectedType}`, () => {
    const intent = classifyQuestion(question);
    assert.equal(intent.type, expectedType);
  });
}

test("buildToolPlan includes required analytics tools for a pipeline question", () => {
  const plan = buildToolPlan(classifyQuestion("How is our pipeline looking this quarter?"));
  assert.ok(plan.includes("getPipelineSummary"));
  assert.ok(plan.includes("getDataQualitySummary"));
});

test("ambiguous performance question asks for clarification", () => {
  const intent = classifyQuestion("Show me performance.");
  assert.equal(intent.type, "clarification_needed");
  assert.ok(intent.clarificationQuestion?.length ?? 0 > 0);
});

test("handleUserQuestion returns a structured response with key metrics", async () => {
  const restoreFetch = mockOpenAIResponse({
    answer: "The pipeline remains healthy.",
    key_metrics: [{ label: "Total pipeline", value: "$350K" }],
    insights: ["Energy remains the strongest sector."],
    data_quality: { coveragePercent: 100 },
    sources_context: ["Deals board", "Work orders board"],
  });

  try {
    const result = await handleUserQuestion("How is our pipeline?", [], {
      deals: baseDeals,
      workOrders: baseWorkOrders,
    });

    assert.equal(result.answer.length > 0, true);
    assert.ok(Array.isArray(result.key_metrics));
    assert.ok(Array.isArray(result.insights));
    assert.ok(result.data_quality);
  } finally {
    restoreFetch();
  }
});

test("handleUserQuestion explains when data is missing", async () => {
  const restoreFetch = mockOpenAIResponse({
    answer: "I do not have enough data to provide a reliable pipeline number.",
    key_metrics: [],
    insights: ["No data was available for this analysis."],
    data_quality: { coveragePercent: 0 },
    sources_context: ["No source data"],
  });

  try {
    const result = await handleUserQuestion("What is our total pipeline?", [], { deals: [], workOrders: [] });
    assert.ok(result.answer.toLowerCase().includes("data") || result.answer.toLowerCase().includes("not") || result.answer.toLowerCase().includes("enough"));
  } finally {
    restoreFetch();
  }
});

test("handleUserQuestion survives OpenAI API failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("API unavailable");
  };

  try {
    const result = await handleUserQuestion("What is our revenue?", [], {
      deals: baseDeals,
      workOrders: baseWorkOrders,
    });
    assert.ok(result.answer.length > 0);
    assert.ok(result.data_quality);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
