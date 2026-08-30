import test from "node:test";
import assert from "node:assert/strict";

import type { NormalizedDeal, NormalizedWorkOrder } from "@/types/domain";
import {
  getOperationalSummary,
  getPipelineSummary,
  getRevenueSummary,
  getRiskSummary,
  getSectorPerformance,
} from "./index";

const deals: NormalizedDeal[] = [
  {
    itemId: "d1",
    dealName: "Alpha",
    ownerCode: "OWNER_1",
    clientCode: "CUST_1",
    dealStatus: "Won",
    actualCloseDate: "2026-01-15",
    closureProbability: "90%",
    dealValue: 150000,
    tentativeCloseDate: "2026-01-20",
    dealStage: "Proposal",
    productDeal: "Mining",
    sector: "Mining",
    createdDate: "2025-11-01",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
  {
    itemId: "d2",
    dealName: "Beta",
    ownerCode: "OWNER_2",
    clientCode: "CUST_2",
    dealStatus: "Open",
    actualCloseDate: null,
    closureProbability: "60%",
    dealValue: 120000,
    tentativeCloseDate: "2026-02-10",
    dealStage: "Negotiation",
    productDeal: "Construction",
    sector: "Construction",
    createdDate: "2025-12-05",
    qualityFlags: [],
    isUsableForValueCalc: true,
    isUsableForDateCalc: true,
  },
  {
    itemId: "d3",
    dealName: "Gamma",
    ownerCode: "OWNER_3",
    clientCode: "CUST_3",
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

const workOrders: NormalizedWorkOrder[] = [
  {
    itemId: "w1",
    dealNameMasked: "Alpha",
    customerNameCode: "CUST_1",
    serialNumber: "SN-1",
    natureOfWork: "Maintenance",
    executionStatus: "Completed",
    dataDeliveryDate: "2026-01-10",
    poDate: "2025-12-01",
    documentType: "Invoice",
    probableStartDate: "2025-12-15",
    probableEndDate: "2026-01-10",
    ownerCode: "OWNER_1",
    sector: "Mining",
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
    dealNameMasked: "Beta",
    customerNameCode: "CUST_2",
    serialNumber: "SN-2",
    natureOfWork: "Inspection",
    executionStatus: "Delayed",
    dataDeliveryDate: "2026-02-15",
    poDate: "2025-12-12",
    documentType: "PO",
    probableStartDate: "2026-01-02",
    probableEndDate: "2026-02-01",
    ownerCode: "OWNER_2",
    sector: "Construction",
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

const fullDateRange = {
  label: "custom",
  start: "2024-01-01",
  end: "2028-12-31",
};

test("pipeline summary uses deterministic deal arithmetic", () => {
  const result = getPipelineSummary(deals, { rawQuestion: "What is the pipeline?", type: "pipeline_analysis", timePeriod: fullDateRange });

  assert.equal(result.data.totalPipelineValue, 350000);
  assert.equal(result.data.weightedPipelineValue, 150000 * 0.9 + 120000 * 0.6);
  assert.equal(result.data.numberOfDeals, 3);
  assert.equal(result.data.closedWonDeals, 1);
  assert.equal(result.data.closedLostDeals, 1);
  assert.equal(result.data.activeOpenDeals, 1);
  assert.equal(result.data.averageDealValue, 116666.67);
  assert.equal(result.data.winRate, 50);
});

test("revenue summary respects missing probability data", () => {
  const result = getRevenueSummary(deals, { rawQuestion: "What is revenue?", type: "revenue_analysis", timePeriod: fullDateRange });
  const data = result.data as Record<string, any>;
  assert.equal(data.revenueSummary.totalPipelineValue, 350000);
  assert.equal(data.notAvailable, null);
});

test("sector performance groups value by normalized sector", () => {
  const result = getSectorPerformance(deals, workOrders, { rawQuestion: "Sector performance?", type: "sector_analysis", timePeriod: fullDateRange });
  const data = result.data as Record<string, any>;
  assert.ok(data.sectors.some((sector: any) => sector.sector === "Mining"));
  assert.ok(data.sectors.some((sector: any) => sector.sector === "Construction"));
});

test("operational summary counts status and at-risk work orders", () => {
  const result = getOperationalSummary(workOrders, { rawQuestion: "Work order status?", type: "work_order_analysis", timePeriod: fullDateRange });
  const data = result.data as Record<string, any>;
  assert.equal(data.totalWorkOrders, 2);
  assert.equal(data.completedWorkOrders, 1);
  assert.equal(data.delayedWorkOrders, 1);
  assert.equal(data.workOrdersByStatus["Completed"], 1);
});

test("risk summary flags delayed exposure without guessing", () => {
  const result = getRiskSummary(deals, workOrders, { rawQuestion: "Risk summary", type: "risk_identification", timePeriod: fullDateRange });
  assert.equal(result.data.atRiskDeals, 0);
  assert.equal(result.data.delayedWorkOrders, 1);
});
