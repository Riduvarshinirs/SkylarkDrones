import test from "node:test";
import assert from "node:assert/strict";

import type { NormalizedDeal, NormalizedWorkOrder } from "@/types/domain";
import {
  generateLeadershipUpdateData,
  getOperationalSummary,
  getExecutiveKpis,
  getOperationsIntelligenceSummary,
  getPipelineSummary,
  getRevenueSummary,
  getRiskSummary,
  getSectorPerformance,
  getWorkOrderRiskAssessment,
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
    priority: "High",
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
    priority: "High",
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

test("pipeline summary uses deterministic deal arithmetic and active-only pipeline reporting", () => {
  const result = getPipelineSummary(deals, { rawQuestion: "What is the pipeline?", type: "pipeline_analysis", timePeriod: fullDateRange });

  assert.equal(result.data.totalPipelineValue, 120000);
  assert.equal(result.data.activePipelineValue, 120000);
  assert.equal(result.data.closedWonValue, 150000);
  assert.equal(result.data.closedLostValue, 80000);
  assert.equal(result.data.weightedPipelineValue, 120000 * 0.6);
  assert.equal(result.data.numberOfDeals, 3);
  assert.equal(result.data.closedWonDeals, 1);
  assert.equal(result.data.closedLostDeals, 1);
  assert.equal(result.data.activeOpenDeals, 1);
  assert.equal(result.data.averageDealValue, 120000);
  assert.equal(result.data.winRate, 50);
});

test("revenue summary respects missing probability data", () => {
  const result = getRevenueSummary(deals, { rawQuestion: "What is revenue?", type: "revenue_analysis", timePeriod: fullDateRange });
  const data = result.data as Record<string, unknown> & { revenueSummary?: { totalPipelineValue?: number | null }; notAvailable?: string | null };
  assert.equal(data.revenueSummary?.totalPipelineValue, 120000);
  assert.equal(data.notAvailable, null);
});

test("sector performance groups value by normalized sector", () => {
  const result = getSectorPerformance(deals, workOrders, { rawQuestion: "Sector performance?", type: "sector_analysis", timePeriod: fullDateRange });
  const data = result.data as { sectors: Array<{ sector: string }> };
  assert.ok(data.sectors.some((sector) => sector.sector === "Mining"));
  assert.ok(data.sectors.some((sector) => sector.sector === "Construction"));
});

test("operational summary counts status and at-risk work orders", () => {
  const result = getOperationalSummary(workOrders, { rawQuestion: "Work order status?", type: "work_order_analysis", timePeriod: fullDateRange });
  const data = result.data as { totalWorkOrders: number; completedWorkOrders: number; delayedWorkOrders: number; workOrdersByStatus: Record<string, number> };
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

test("work order risk assessment uses deterministic signals and transparent scoring", () => {
  const delayed = getWorkOrderRiskAssessment(workOrders[1]);
  assert.equal(delayed.riskLevel, "High");
  assert.equal(delayed.riskScore, 80);
  assert.ok(delayed.reasons.some((reason) => reason.toLowerCase().includes("overdue") || reason.toLowerCase().includes("date has passed")));

  const lowRisk = getWorkOrderRiskAssessment(workOrders[0]);
  assert.equal(lowRisk.riskLevel, "Low");
  assert.equal(lowRisk.riskScore, 0);
  assert.deepEqual(lowRisk.reasons, ["No material risk signals were identified from the available status and date fields."]);
});

test("operations intelligence summarizes status, completion rate, and at-risk work orders deterministically", () => {
  const result = getOperationsIntelligenceSummary(workOrders, { rawQuestion: "What is the operational status?", type: "work_order_analysis", timePeriod: fullDateRange });
  const data = result.data as {
    statusOverview: { completed: number; ongoing: number; notStarted: number; otherStatuses: Array<{ status: string; count: number }> };
    completionRate: number | null;
    atRiskWorkOrders: { high: number; medium: number; low: number; items: Array<{ riskLevel: string }> };
    executiveInsight: string;
  };

  assert.equal(data.statusOverview.completed, 1);
  assert.equal(data.statusOverview.ongoing, 1);
  assert.equal(data.statusOverview.notStarted, 0);
  assert.equal(data.completionRate, 50);
  assert.equal(data.atRiskWorkOrders.high, 1);
  assert.equal(data.atRiskWorkOrders.medium, 0);
  assert.equal(data.atRiskWorkOrders.low, 0);
  assert.match(data.executiveInsight, /attention|high-risk/i);
});

test("active pipeline excludes closed won and lost deals and measures work-order completion deterministically", () => {
  const pipeline = getPipelineSummary(deals, { rawQuestion: "What is the active pipeline?", type: "pipeline_analysis", timePeriod: fullDateRange });
  const operational = getOperationalSummary(workOrders, { rawQuestion: "Work order status?", type: "work_order_analysis", timePeriod: fullDateRange });

  const pipelineData = pipeline.data as { totalPipelineValue: number; activePipelineValue: number; closedWonValue: number; closedLostValue: number; largestActiveOpportunity: number | null };
  const operationalData = operational.data as { totalWorkOrders: number; completedWorkOrders: number; ongoingWorkOrders: number; notStartedWorkOrders: number; completionPercentage: number | null };

  assert.equal(pipelineData.totalPipelineValue, 120000);
  assert.equal(pipelineData.activePipelineValue, 120000);
  assert.equal(pipelineData.closedWonValue, 150000);
  assert.equal(pipelineData.closedLostValue, 80000);
  assert.equal(pipelineData.largestActiveOpportunity, 120000);
  assert.equal(operationalData.totalWorkOrders, 2);
  assert.equal(operationalData.completedWorkOrders, 1);
  assert.equal(operationalData.ongoingWorkOrders, 1);
  assert.equal(operationalData.notStartedWorkOrders, 0);
  assert.equal(operationalData.completionPercentage, 50);
});

test("leadership brief uses deterministic metrics and clearly marks unavailable signals", () => {
  const brief = generateLeadershipUpdateData(deals, workOrders).data as {
    executiveBrief?: {
      title: string;
      summary: string[];
      sales: Record<string, unknown>;
      operations: Record<string, unknown>;
      risks: string[];
      recommendedActions: string[];
    };
  };

  assert.ok(brief.executiveBrief);
  assert.equal(brief.executiveBrief?.title, "WEEKLY LEADERSHIP BRIEF");
  assert.equal(brief.executiveBrief?.summary.length >= 2, true);
  assert.equal(brief.executiveBrief?.sales.pipelineValue, "$120,000");
  assert.equal(brief.executiveBrief?.sales.activeOpportunities, 1);
  assert.equal(brief.executiveBrief?.operations.totalWorkOrders, 2);
  assert.equal(brief.executiveBrief?.operations.completionRate, "50.0%");
  assert.ok(!brief.executiveBrief?.summary.some((sentence) => /week-over-week|w\/w|trend/i.test(sentence)));
  assert.ok(Array.isArray(brief.executiveBrief?.recommendedActions));
});

test("executive KPI snapshot updates when source data changes", () => {
  const baseKpis = getExecutiveKpis(deals, workOrders, { rawQuestion: "Executive KPI summary", type: "leadership_summary", timePeriod: fullDateRange });

  assert.equal(baseKpis.totalPipeline, 120000);
  assert.equal(baseKpis.openDeals, 1);
  assert.equal(baseKpis.winRate, 50);
  assert.equal(baseKpis.atRiskWorkOrders, 1);
  assert.equal(baseKpis.closedWon, 1);
  assert.equal(baseKpis.completionRate, 50);

  const expandedDeals = [
    ...deals,
    {
      ...deals[1],
      itemId: "d4",
      dealName: "Delta",
      dealStatus: "Open",
      dealValue: 200000,
      closureProbability: "80%",
      sector: "Energy",
      clientCode: "CUST_4",
    },
  ];

  const updatedKpis = getExecutiveKpis(expandedDeals, workOrders, { rawQuestion: "Executive KPI summary", type: "leadership_summary", timePeriod: fullDateRange });

  assert.equal(updatedKpis.totalPipeline, 320000);
  assert.equal(updatedKpis.openDeals, 2);
  assert.equal(updatedKpis.winRate, 50);
  assert.equal(updatedKpis.atRiskWorkOrders, 1);
  assert.equal(updatedKpis.closedWon, 1);
  assert.equal(updatedKpis.completionRate, 50);
});
