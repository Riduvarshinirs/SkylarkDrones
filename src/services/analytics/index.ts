/**
 * Deterministic analytics engine.
 *
 * This layer only performs arithmetic, grouping, filtering, and
 * summarization over already-normalized monday.com datasets. It never
 * asks an LLM for calculations or invents values where the source data
 * is incomplete or missing.
 */

import type {
  AnalyticsResult,
  DataQualityIssue,
  DataQualityReport,
  NormalizedDeal,
  NormalizedWorkOrder,
  QueryIntent,
} from "@/types/domain";

type FilterKey = "today" | "this_week" | "this_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

interface TimeRange {
  label: string;
  start: Date | null;
  end: Date | null;
}

const EMPTY_REPORT: DataQualityReport = {
  recordsConsidered: 0,
  recordsExcluded: 0,
  exclusionReasons: {},
  coveragePercent: 0,
  caveats: ["No records were available for analysis."],
};

function safeRound(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(value.toFixed(2));
}

function toNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value;
}

function parseProbability(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) return normalized;
    return null;
  }

  const text = value.toString().trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower === "high") return 0.75;
  if (lower === "medium") return 0.5;
  if (lower === "low") return 0.25;

  const numeric = Number(text.replace(/%/g, ""));
  if (Number.isFinite(numeric)) {
    return numeric > 1 ? numeric / 100 : numeric;
  }

  return null;
}

function normalizeStatusText(status: string | null | undefined): string {
  return (status ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isClosedWon(status: string | null): boolean {
  if (!status) return false;
  const lower = normalizeStatusText(status);
  return ["won", "closed won", "closedwon", "closed-won", "closed_won"].includes(lower);
}

function isClosedLost(status: string | null): boolean {
  if (!status) return false;
  const lower = normalizeStatusText(status);
  return ["lost", "closed lost", "closedlost", "closed-lost", "closed_lost"].includes(lower);
}

function isOpenDeal(status: string | null): boolean {
  if (!status) return true;
  const lower = normalizeStatusText(status);
  return !isClosedWon(status) && !isClosedLost(status) && !["completed", "cancelled", "canceled", "archived"].includes(lower);
}

function isCompletedWorkOrder(status: string | null): boolean {
  const lower = normalizeStatusText(status);
  return ["completed", "complete", "done", "finished"].includes(lower);
}

function isOngoingWorkOrder(status: string | null): boolean {
  const lower = normalizeStatusText(status);
  return ["in progress", "inprogress", "ongoing", "started", "scheduled", "pending", "review", "open", "active", "delayed", "blocked", "at risk", "risk"].includes(lower);
}

function isNotStartedWorkOrder(status: string | null): boolean {
  const lower = normalizeStatusText(status);
  return ["not started", "notstarted", "new", "queued", "upcoming", "planned", "to do"].includes(lower);
}

function isDelayedWorkOrder(status: string | null, probableEndDate: string | null | undefined): boolean {
  const lower = normalizeStatusText(status);
  if (["delayed", "blocked", "at risk", "risk"].includes(lower)) return true;
  if (probableEndDate && parseDate(probableEndDate) && parseDate(probableEndDate)! < new Date() && !isCompletedWorkOrder(status)) {
    return true;
  }
  return false;
}

function normalizePriorityText(priority: string | null | undefined): string | null {
  const text = normalizeStatusText(priority ?? "");
  if (!text) return null;
  const mapping: Record<string, string> = {
    "high priority": "High",
    "urgent": "High",
    high: "High",
    medium: "Medium",
    "medium priority": "Medium",
    low: "Low",
    "low priority": "Low",
  };
  return mapping[text] ?? text.charAt(0).toUpperCase() + text.slice(1);
}

export interface WorkOrderRiskAssessment {
  workOrder: string | null;
  riskLevel: "High" | "Medium" | "Low";
  riskScore: number;
  reasons: string[];
}

export function getWorkOrderRiskAssessment(order: NormalizedWorkOrder): WorkOrderRiskAssessment {
  const status = order.executionStatus ?? "Unknown";
  const priority = normalizePriorityText(order.priority);
  const dueDate = order.probableEndDate ?? order.dataDeliveryDate ?? null;
  const startDate = order.probableStartDate ?? null;
  const statusText = normalizeStatusText(status);
  const incomplete = !isCompletedWorkOrder(status) && !["cancelled", "canceled", "closed", "won", "lost"].includes(statusText);
  const reasons: string[] = [];
  let score = 0;

  if (isDelayedWorkOrder(status, dueDate) || (dueDate && parseDate(dueDate)! !== null && parseDate(dueDate)! < new Date() && !isCompletedWorkOrder(status))) {
    score += 55;
    reasons.push("Overdue: the expected end date has passed and the work remains incomplete.");
  }

  if (dueDate) {
    const parsed = parseDate(dueDate);
    if (parsed && !isCompletedWorkOrder(status)) {
      const diffDays = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 7) {
        score += 25;
        reasons.push(`Deadline approaching: the due date is ${diffDays} day${diffDays === 1 ? "" : "s"} away while the work is still open.`);
      }
    }
  }

  if (priority === "High") {
    score += 15;
    reasons.push("High priority: this work requires close attention from operations and leadership.");
  }

  if (isNotStartedWorkOrder(status)) {
    score += 20;
    reasons.push("Not started: this work has not yet begun despite being scheduled or active.");
  }

  if (isOngoingWorkOrder(status) && startDate) {
    const parsedStart = parseDate(startDate);
    if (parsedStart) {
      const diffDays = Math.ceil((Date.now() - parsedStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        score += 20;
        reasons.push(`Ongoing for too long: the work started ${diffDays} days ago and is still active.`);
      }
    }
  }

  if (incomplete) {
    score += 10;
    reasons.push("Incomplete work order: this record is not marked complete.");
  }

  const dedupedReasons = [...new Set(reasons)];
  const normalizedScore = Math.min(score, 100);
  const riskLevel: "High" | "Medium" | "Low" = normalizedScore >= 80 ? "High" : normalizedScore >= 40 ? "Medium" : "Low";

  return {
    workOrder: order.dealNameMasked ?? order.serialNumber ?? "Unnamed work order",
    riskLevel,
    riskScore: normalizedScore,
    reasons: dedupedReasons.length > 0 ? dedupedReasons : ["No material risk signals were identified from the available status and date fields."],
  };
}

function getRiskReason(order: NormalizedWorkOrder): string {
  return getWorkOrderRiskAssessment(order).reasons[0] ?? "No material risk signals were identified from the available status and date fields.";
}

function getWorkOrderRiskLevel(order: NormalizedWorkOrder): "High" | "Medium" | "Low" {
  return getWorkOrderRiskAssessment(order).riskLevel;
}

function sum(values: Array<number | null | undefined>): number {
  return values
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value))
    .reduce((total, value) => total + value, 0);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthBucket(dateValue: string | null | undefined): string | null {
  const date = parseDate(dateValue);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateInRange(dateValue: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!dateValue) return false;
  const date = parseDate(dateValue);
  if (!date || !start || !end) return !!date;
  return date >= start && date <= end;
}

function getQuarterStartMonth(month: number): number {
  return Math.floor(month / 3) * 3;
}

function buildTimeRange(intent: QueryIntent | undefined, fallbackLabel: FilterKey = "this_year"): TimeRange {
  const explicitTimePeriod = intent?.timePeriod;
  if (!explicitTimePeriod) {
    return {
      label: "all_available_data",
      start: null,
      end: null,
    };
  }

  const label = explicitTimePeriod.label ?? fallbackLabel;
  const today = new Date();
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth();

  if (explicitTimePeriod.start || explicitTimePeriod.end) {
    return {
      label: explicitTimePeriod.label ?? "custom",
      start: explicitTimePeriod.start ? new Date(explicitTimePeriod.start) : null,
      end: explicitTimePeriod.end ? new Date(explicitTimePeriod.end) : null,
    };
  }

  switch (label) {
    case "today": {
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      const end = new Date(today); end.setHours(23, 59, 59, 999);
      return { label: "today", start, end };
    }
    case "this_week": {
      const start = new Date(today);
      const day = start.getDay();
      const diffToMonday = (day + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { label: "this_week", start, end };
    }
    case "this_month": {
      const start = new Date(nowYear, nowMonth, 1);
      const end = new Date(nowYear, nowMonth + 1, 0, 23, 59, 59, 999);
      return { label: "this_month", start, end };
    }
    case "this_quarter": {
      const qStart = getQuarterStartMonth(nowMonth);
      const start = new Date(nowYear, qStart, 1);
      const end = new Date(nowYear, qStart + 3, 0, 23, 59, 59, 999);
      return { label: "this_quarter", start, end };
    }
    case "last_quarter": {
      const currentQuarterStart = getQuarterStartMonth(nowMonth);
      const start = new Date(nowYear, currentQuarterStart - 3, 1);
      const end = new Date(nowYear, currentQuarterStart, 0, 23, 59, 59, 999);
      return { label: "last_quarter", start, end };
    }
    case "this_year": {
      const start = new Date(nowYear, 0, 1);
      const end = new Date(nowYear, 11, 31, 23, 59, 59, 999);
      return { label: "this_year", start, end };
    }
    case "last_year": {
      const start = new Date(nowYear - 1, 0, 1);
      const end = new Date(nowYear - 1, 11, 31, 23, 59, 59, 999);
      return { label: "last_year", start, end };
    }
    default: {
      const start = new Date(nowYear, 0, 1);
      const end = new Date(nowYear, 11, 31, 23, 59, 59, 999);
      return { label: label || fallbackLabel, start, end };
    }
  }
}

function buildDataQualityReport(
  total: number,
  analyzed: number,
  exclusionReasons: Partial<Record<DataQualityIssue["issue"], number>>,
  caveats: string[],
): DataQualityReport {
  if (total === 0) {
    return { ...EMPTY_REPORT, caveats };
  }

  return {
    recordsConsidered: analyzed,
    recordsExcluded: Math.max(total - analyzed, 0),
    exclusionReasons,
    coveragePercent: Number(((analyzed / total) * 100).toFixed(2)),
    caveats,
  };
}

function getIssueCounts(records: Array<{ qualityFlags: DataQualityIssue[] }>): Partial<Record<DataQualityIssue["issue"], number>> {
  const counts: Partial<Record<DataQualityIssue["issue"], number>> = {};
  for (const record of records) {
    for (const issue of record.qualityFlags) {
      counts[issue.issue] = (counts[issue.issue] ?? 0) + 1;
    }
  }
  return counts;
}

function filterDealsByTimeRange(deals: NormalizedDeal[], intent?: QueryIntent): NormalizedDeal[] {
  if (!intent?.timePeriod) return deals;
  const range = buildTimeRange(intent, "this_year");
  if (!range.start || !range.end) return deals;

  return deals.filter((deal) => {
    const target = deal.actualCloseDate ?? deal.tentativeCloseDate ?? deal.createdDate;
    return dateInRange(target, range.start, range.end);
  });
}

function filterOrdersByTimeRange(workOrders: NormalizedWorkOrder[], intent?: QueryIntent): NormalizedWorkOrder[] {
  if (!intent?.timePeriod) return workOrders;
  const range = buildTimeRange(intent, "this_year");
  if (!range.start || !range.end) return workOrders;

  return workOrders.filter((order) => {
    const target = order.probableStartDate ?? order.probableEndDate ?? order.dataDeliveryDate ?? order.poDate;
    return dateInRange(target, range.start, range.end);
  });
}

function summarizeDealQuality(deals: NormalizedDeal[]): DataQualityReport {
  const total = deals.length;
  const issues = getIssueCounts(deals);
  const caveats = [
    "Deal values are included only when a valid numeric value exists.",
    "Probability-weighted value is calculated only for deals with a valid probability entry.",
  ];

  const analyzed = deals.filter((deal) => deal.dealName !== null || deal.dealValue !== null || deal.dealStatus !== null).length;
  return buildDataQualityReport(total, analyzed, issues, caveats);
}

function summarizeOrderQuality(workOrders: NormalizedWorkOrder[]): DataQualityReport {
  const total = workOrders.length;
  const issues = getIssueCounts(workOrders);
  const caveats = [
    "Work-order operational metrics are computed only when status or date values are valid.",
    "Delayed or at-risk orders require explicit status or date fields to be present.",
  ];

  const analyzed = workOrders.filter((order) => order.executionStatus !== null || order.amountExclGst !== null || order.probableEndDate !== null).length;
  return buildDataQualityReport(total, analyzed, issues, caveats);
}

export function getPipelineSummary(
  deals: NormalizedDeal[],
  intent: QueryIntent,
): AnalyticsResult {
  const relevantDeals = filterDealsByTimeRange(deals, intent);
  const totalDeals = relevantDeals.length;
  const openDeals = relevantDeals.filter((deal) => isOpenDeal(deal.dealStatus));
  const wonDeals = relevantDeals.filter((deal) => isClosedWon(deal.dealStatus));
  const lostDeals = relevantDeals.filter((deal) => isClosedLost(deal.dealStatus));

  const values = openDeals.map((deal) => toNumber(deal.dealValue)).filter((value): value is number => value !== null);
  const wonValues = wonDeals.map((deal) => toNumber(deal.dealValue)).filter((value): value is number => value !== null);
  const lostValues = lostDeals.map((deal) => toNumber(deal.dealValue)).filter((value): value is number => value !== null);
  const activePipelineValue = values.length > 0 ? sum(values) : null;
  const closedWonValue = wonValues.length > 0 ? sum(wonValues) : null;
  const closedLostValue = lostValues.length > 0 ? sum(lostValues) : null;
  const weighted = openDeals
    .map((deal) => {
      const value = toNumber(deal.dealValue);
      if (value === null) return null;
      const probability = parseProbability(deal.closureProbability ?? null);
      if (probability === null) return null;
      return value * probability;
    })
    .filter((value): value is number => value !== null);
  const weightedPipelineValue = weighted.length > 0 ? sum(weighted) : null;

  const averageDealValue = values.length > 0 && activePipelineValue !== null ? activePipelineValue / values.length : null;
  const winRate = wonDeals.length + lostDeals.length > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : null;

  const largestActiveOpportunity = [...openDeals]
    .filter((deal) => deal.dealValue !== null)
    .sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))[0] ?? null;

  const largestOpportunities = [...openDeals]
    .filter((deal) => deal.dealValue !== null)
    .sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))
    .slice(0, 5)
    .map((deal) => ({
      dealName: deal.dealName,
      customer: deal.clientCode,
      value: deal.dealValue,
      stage: deal.dealStage,
      status: deal.dealStatus,
      closeDate: deal.actualCloseDate ?? deal.tentativeCloseDate,
    }));

  const bySector: Record<string, number> = {};
  const stageGroups = new Map<string, { opportunityCount: number; values: number[] }>();
  const byCustomer: Record<string, number> = {};
  const byClosePeriod: Record<string, number> = {};

  for (const deal of openDeals) {
    if (deal.sector) {
      bySector[deal.sector] = (bySector[deal.sector] ?? 0) + (deal.dealValue ?? 0);
    }

    const stageKey = deal.dealStage ?? "Unspecified";
    const stage = stageGroups.get(stageKey) ?? { opportunityCount: 0, values: [] };
    stage.opportunityCount += 1;
    if (deal.dealValue !== null) stage.values.push(deal.dealValue);
    stageGroups.set(stageKey, stage);

    const customerKey = deal.clientCode ?? deal.dealName ?? "Unknown";
    byCustomer[customerKey] = (byCustomer[customerKey] ?? 0) + (deal.dealValue ?? 0);

    const closeDate = deal.actualCloseDate ?? deal.tentativeCloseDate;
    const closeBucket = monthBucket(closeDate) ?? "not_available";
    byClosePeriod[closeBucket] = (byClosePeriod[closeBucket] ?? 0) + (deal.dealValue ?? 0);
  }

  const data = {
    recordsAnalyzed: totalDeals,
    recordsExcluded: Math.max(deals.length - totalDeals, 0),
    timeRange: intent?.timePeriod
      ? { label: intent.timePeriod.label, start: buildTimeRange(intent, "this_year").start?.toISOString() ?? null, end: buildTimeRange(intent, "this_year").end?.toISOString() ?? null }
      : { label: "all_available_data", start: null, end: null },
    totalPipelineValue: safeRound(activePipelineValue),
    activePipelineValue: safeRound(activePipelineValue),
    closedWonValue: safeRound(closedWonValue),
    closedLostValue: safeRound(closedLostValue),
    weightedPipelineValue: safeRound(weightedPipelineValue),
    numberOfDeals: totalDeals,
    activeOpenDeals: openDeals.length,
    closedWonDeals: wonDeals.length,
    closedLostDeals: lostDeals.length,
    averageDealValue: safeRound(averageDealValue),
    winRate: safeRound(winRate),
    largestActiveOpportunity: largestActiveOpportunity ? safeRound(largestActiveOpportunity.dealValue) : null,
    bySector,
    pipelineByStage: [...stageGroups.entries()]
      .map(([stage, values]) => ({
        stage,
        opportunities: values.opportunityCount,
        pipelineValue: values.values.length > 0 ? safeRound(sum(values.values)) : null,
        valuedOpportunities: values.values.length,
      }))
      .sort((a, b) => (b.pipelineValue ?? -1) - (a.pipelineValue ?? -1) || b.opportunities - a.opportunities),
    byCustomer,
    byClosePeriod,
    largestOpportunities,
    missingInformation: {
      missingDealValue: relevantDeals.filter((deal) => deal.dealValue === null).length,
      missingProbability: relevantDeals.filter((deal) => deal.closureProbability === null).length,
      missingCloseDate: relevantDeals.filter((deal) => deal.actualCloseDate === null && deal.tentativeCloseDate === null).length,
    },
    assumptions: [
      "Active pipeline includes only open or active deals; closed-won and closed-lost deals are reported separately.",
      "Weighted pipeline value uses probability only when a valid numeric or categorical probability exists.",
    ],
    limitations: [
      "Time-based summaries are limited to the intent time range or the default year range.",
      "If a deal has no valid close date, it is bucketed under not_available instead of guessed.",
    ],
  };

  const report = summarizeDealQuality(deals);
  return {
    intent: "pipeline_analysis",
    data,
    dataQuality: report,
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals"],
  };
}

export function getRevenueSummary(
  deals: NormalizedDeal[],
  intent: QueryIntent,
): AnalyticsResult {
  const summary = getPipelineSummary(deals, intent);
  const pipeline = summary.data as typeof summary.data & {
    totalPipelineValue?: number | null;
    weightedPipelineValue?: number | null;
    averageDealValue?: number | null;
  };

  return {
    ...summary,
    intent: "revenue_analysis",
    data: {
      ...pipeline,
      revenueSummary: {
        totalPipelineValue: pipeline.totalPipelineValue ?? null,
        weightedPipelineValue: pipeline.weightedPipelineValue ?? null,
        averageDealValue: pipeline.averageDealValue ?? null,
      },
      notAvailable: pipeline.weightedPipelineValue === null ? "Weighted pipeline value is not available because probability data is missing or invalid." : null,
    },
  };
}

export function getSectorPerformance(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  const relevantDeals = filterDealsByTimeRange(deals, intent);
  const relevantOrders = filterOrdersByTimeRange(workOrders, intent);

  const sectorMap = new Map<string, { dealValue: number; dealCount: number; workOrderValue: number; workOrderCount: number }>();

  for (const deal of relevantDeals) {
    const sector = deal.sector ?? "Unknown";
    const bucket = sectorMap.get(sector) ?? { dealValue: 0, dealCount: 0, workOrderValue: 0, workOrderCount: 0 };
    bucket.dealValue += deal.dealValue ?? 0;
    bucket.dealCount += 1;
    sectorMap.set(sector, bucket);
  }

  for (const order of relevantOrders) {
    const sector = order.sector ?? "Unknown";
    const bucket = sectorMap.get(sector) ?? { dealValue: 0, dealCount: 0, workOrderValue: 0, workOrderCount: 0 };

    let workOrderTotal = 0;
    for (const value of [
      order.amountExclGst,
      order.amountInclGst,
      order.billedValueExclGst,
      order.billedValueInclGst,
      order.collectedAmountInclGst,
      order.amountReceivable,
    ]) {
      workOrderTotal += value ?? 0;
    }

    bucket.workOrderValue += workOrderTotal;
    bucket.workOrderCount += 1;
    sectorMap.set(sector, bucket);
  }

  const sectors = [...sectorMap.entries()].map(([sector, values]) => ({
    sector,
    dealValue: values.dealValue,
    workOrderValue: values.workOrderValue,
    combinedValue: values.dealValue + values.workOrderValue,
    dealCount: values.dealCount,
    workOrderCount: values.workOrderCount,
  }));

  const report = buildDataQualityReport(
    deals.length + workOrders.length,
    relevantDeals.length + relevantOrders.length,
    { ...getIssueCounts(deals), ...getIssueCounts(workOrders) },
    ["Sector performance is aggregated by normalized sector names only. Missing or inconsistent sector names remain grouped under Unknown."],
  );

  return {
    intent: "sector_analysis",
    data: {
      recordsAnalyzed: relevantDeals.length + relevantOrders.length,
      recordsExcluded: Math.max(deals.length + workOrders.length - (relevantDeals.length + relevantOrders.length), 0),
      sectors: sectors.sort((a, b) => b.combinedValue - a.combinedValue),
      assumptions: ["Value totals are based on normalized numeric fields only."],
      limitations: ["Sectors without a canonical normalization remain under Unknown."],
    },
    dataQuality: report,
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals", "work_orders"],
  };
}

export function getOperationalSummary(
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  const relevantOrders = filterOrdersByTimeRange(workOrders, intent);
  const totalWorkOrders = relevantOrders.length;
  const statusCounts: Record<string, number> = {};
  const completed = relevantOrders.filter((order) => isCompletedWorkOrder(order.executionStatus)).length;
  const ongoing = relevantOrders.filter((order) => isOngoingWorkOrder(order.executionStatus)).length;
  const notStarted = relevantOrders.filter((order) => isNotStartedWorkOrder(order.executionStatus)).length;
  const delayed = relevantOrders.filter((order) => isDelayedWorkOrder(order.executionStatus, order.probableEndDate)).length;

  for (const order of relevantOrders) {
    const key = order.executionStatus ?? "Unknown";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  const values = relevantOrders
    .map((order) => {
      let total = 0;
      for (const value of [
        order.amountExclGst,
        order.amountInclGst,
        order.billedValueExclGst,
        order.billedValueInclGst,
        order.collectedAmountInclGst,
        order.amountReceivable,
      ]) {
        total += value ?? 0;
      }
      return total;
    })
    .filter((value): value is number => value > 0);

  const totalValue = sum(values);
  const completionRate = totalWorkOrders > 0 ? (completed / totalWorkOrders) * 100 : null;

  const bySector: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const timeBuckets: Record<string, number> = {};

  for (const order of relevantOrders) {
    if (order.sector) {
      bySector[order.sector] = (bySector[order.sector] ?? 0) + 1;
    }

    if (order.customerNameCode) {
      byCustomer[order.customerNameCode] = (byCustomer[order.customerNameCode] ?? 0) + 1;
    }

    const bucket = monthBucket(order.probableStartDate ?? order.dataDeliveryDate ?? order.poDate);
    if (bucket) {
      timeBuckets[bucket] = (timeBuckets[bucket] ?? 0) + 1;
    }
  }

  const data = {
    recordsAnalyzed: totalWorkOrders,
    recordsExcluded: Math.max(workOrders.length - totalWorkOrders, 0),
    totalWorkOrders: totalWorkOrders,
    completedWorkOrders: completed,
    ongoingWorkOrders: ongoing,
    notStartedWorkOrders: notStarted,
    activeWorkOrders: ongoing,
    delayedWorkOrders: delayed,
    completionPercentage: safeRound(completionRate),
    completionRate: safeRound(completionRate),
    totalOperationalValue: safeRound(totalValue),
    workOrdersByStatus: statusCounts,
    bySector,
    byCustomer,
    byMonth: timeBuckets,
    assumptions: [
      "Completed work orders are those explicitly marked completed.",
      "Ongoing work orders include in-progress and active statuses; not-started includes planned or queued statuses.",
      "Delayed work orders require either an explicit delayed/blocked status or a past probable end date before the current system date.",
    ],
    limitations: [
      "Operational metrics are only as complete as the normalized execution-date and status fields.",
      "If a work order lacks usable dates or status, it remains counted with Unknown or excluded from time-based summaries.",
    ],
  };

  return {
    intent: "work_order_analysis",
    data,
    dataQuality: summarizeOrderQuality(workOrders),
    generatedAt: new Date().toISOString(),
    sourceBoards: ["work_orders"],
  };
}

export function getOperationsIntelligenceSummary(
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  const summary = getOperationalSummary(workOrders, intent);
  const relevantOrders = filterOrdersByTimeRange(workOrders, intent);
  const data = summary.data as {
    completedWorkOrders: number;
    ongoingWorkOrders: number;
    notStartedWorkOrders: number;
    completionRate: number | null;
    workOrdersByStatus: Record<string, number>;
  };

  const recognized = new Set(["Completed", "In Progress", "Inprogress", "Ongoing", "Not Started", "Notstarted", "Open", "Started", "Active", "Pending"]);
  const rawStatusCounts = Object.entries(data.workOrdersByStatus ?? {});

  const allAssessmentItems = relevantOrders.map((order) => {
    const assessment = getWorkOrderRiskAssessment(order);
    const relevantDate = order.probableEndDate ?? order.dataDeliveryDate ?? order.probableStartDate ?? null;
    return {
      workOrderName: assessment.workOrder,
      status: order.executionStatus ?? "Unknown",
      priority: normalizePriorityText(order.priority) ?? (order.priority ?? "Not specified"),
      relevantDate,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.riskScore,
      reason: assessment.reasons[0] ?? "No material risk signals were identified from the available status and date fields.",
      reasons: assessment.reasons,
    };
  });

  const riskItems = allAssessmentItems
    .filter((item) => item.riskLevel === "High" || item.riskLevel === "Medium")
    .sort((a, b) => {
      const order = { High: 3, Medium: 2, Low: 1 } as Record<string, number>;
      return (order[b.riskLevel] ?? 0) - (order[a.riskLevel] ?? 0) || (b.riskScore ?? 0) - (a.riskScore ?? 0);
    });

  const highRisk = allAssessmentItems.filter((item) => item.riskLevel === "High").length;
  const mediumRisk = allAssessmentItems.filter((item) => item.riskLevel === "Medium").length;
  const lowRisk = allAssessmentItems.filter((item) => item.riskLevel === "Low").length;

  const statusSummary = {
    completed: data.completedWorkOrders,
    ongoing: data.ongoingWorkOrders,
    notStarted: data.notStartedWorkOrders,
    otherStatuses: rawStatusCounts
      .filter(([status]) => !recognized.has(status) && !["Completed", "In Progress", "Not Started", "Ongoing", "Started"].includes(status))
      .map(([status, count]) => ({ status, count })),
  };

  const executiveInsight = riskItems.length > 0
    ? `${riskItems.length} work order${riskItems.length === 1 ? " requires" : "s require"} attention, including ${highRisk} high-risk item${highRisk === 1 ? "" : "s"}.`
    : "No work orders currently require attention based on the available status and date signals.";

  return {
    ...summary,
    data: {
      ...data,
      statusOverview: statusSummary,
      completionRate: data.completionRate,
      atRiskWorkOrders: {
        high: highRisk,
        medium: mediumRisk,
        low: lowRisk,
        items: riskItems,
      },
      executiveInsight,
    },
  };
}

export function getCustomerSummary(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  const relevantDeals = filterDealsByTimeRange(deals, intent);
  const relevantOrders = filterOrdersByTimeRange(workOrders, intent);

  const customerSummaries = new Map<string, { dealValue: number; dealCount: number; workOrderCount: number; sector: string | null }>();

  for (const deal of relevantDeals) {
    const key = deal.clientCode ?? deal.dealName ?? "Unknown";
    const current = customerSummaries.get(key) ?? { dealValue: 0, dealCount: 0, workOrderCount: 0, sector: deal.sector ?? null };
    current.dealValue += deal.dealValue ?? 0;
    current.dealCount += 1;
    customerSummaries.set(key, current);
  }

  for (const order of relevantOrders) {
    const key = order.customerNameCode ?? order.dealNameMasked ?? "Unknown";
    const current = customerSummaries.get(key) ?? { dealValue: 0, dealCount: 0, workOrderCount: 0, sector: order.sector ?? null };
    current.workOrderCount += 1;
    if (!current.sector) current.sector = order.sector ?? null;
    customerSummaries.set(key, current);
  }

  return {
    intent: "customer_analysis",
    data: {
      recordsAnalyzed: relevantDeals.length + relevantOrders.length,
      recordsExcluded: Math.max(deals.length + workOrders.length - (relevantDeals.length + relevantOrders.length), 0),
      customers: [...customerSummaries.entries()].map(([customer, summary]) => ({
        customer,
        dealValue: summary.dealValue,
        dealCount: summary.dealCount,
        workOrderCount: summary.workOrderCount,
        sector: summary.sector,
      })),
      assumptions: ["Customers are grouped by normalized customer code when present, otherwise by deal or work-order name."],
      limitations: ["Unknown customer names are grouped under Unknown to avoid fabricating customer identities."],
    },
    dataQuality: buildDataQualityReport(
      deals.length + workOrders.length,
      relevantDeals.length + relevantOrders.length,
      { ...getIssueCounts(deals), ...getIssueCounts(workOrders) },
      ["Customer summaries exclude inferred identities and only use available, normalized customer fields."],
    ),
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals", "work_orders"],
  };
}

export function getRiskSummary(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  const relevantDeals = filterDealsByTimeRange(deals, intent);
  const relevantOrders = filterOrdersByTimeRange(workOrders, intent);

  const atRiskDeals = relevantDeals.filter((deal) => {
    const status = deal.dealStatus?.toLowerCase() ?? "";
    return (status.includes("pending") || status.includes("review") || status.includes("hold")) && deal.dealValue !== null;
  });

  const delayedOrders = relevantOrders.filter((order) => {
    const status = order.executionStatus?.toLowerCase() ?? "";
    if (status.includes("delayed") || status.includes("blocked")) return true;
    if (order.probableEndDate && new Date(order.probableEndDate) < new Date() && order.executionStatus?.toLowerCase() !== "completed") return true;
    return false;
  });

  return {
    intent: "risk_identification",
    data: {
      recordsAnalyzed: relevantDeals.length + relevantOrders.length,
      recordsExcluded: Math.max(deals.length + workOrders.length - (relevantDeals.length + relevantOrders.length), 0),
      atRiskDeals: atRiskDeals.length,
      delayedWorkOrders: delayedOrders.length,
      dealRiskItems: atRiskDeals.map((deal) => ({
        dealName: deal.dealName,
        customer: deal.clientCode,
        value: deal.dealValue,
        status: deal.dealStatus,
      })),
      workOrderRiskItems: delayedOrders.map((order) => ({
        id: order.itemId,
        customer: order.customerNameCode,
        sector: order.sector,
        endDate: order.probableEndDate,
        status: order.executionStatus,
      })),
      assumptions: ["Risk flags are limited to explicit delayed/blocked statuses or past end dates that are still not marked completed."],
      limitations: ["No retrospective risk score is inferred when the source data does not contain enough signal."],
    },
    dataQuality: buildDataQualityReport(
      deals.length + workOrders.length,
      relevantDeals.length + relevantOrders.length,
      { ...getIssueCounts(deals), ...getIssueCounts(workOrders) },
      ["Risk analysis requires explicitly trustworthy status or date values; it does not infer missing risk states."],
    ),
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals", "work_orders"],
  };
}

export function getDataQualityReport(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
): AnalyticsResult {
  const total = deals.length + workOrders.length;
  const issues = { ...getIssueCounts(deals), ...getIssueCounts(workOrders) };
  const analyzed = deals.length + workOrders.length;

  const data = {
    recordsAnalyzed: analyzed,
    recordsExcluded: 0,
    issueCounts: issues,
    missingSamples: {
      missingDealValues: deals.filter((deal) => deal.dealValue === null).length,
      missingWorkOrderValues: workOrders.filter((order) => order.amountExclGst === null).length,
      missingDates: deals.filter((deal) => deal.actualCloseDate === null && deal.tentativeCloseDate === null).length + workOrders.filter((order) => order.probableEndDate === null).length,
    },
    caveats: [
      "This report reflects the normalized values actually present in the data.",
      "No missing values are guessed or reconstructed.",
    ],
  };

  return {
    intent: "clarification_needed",
    data,
    dataQuality: buildDataQualityReport(total, analyzed, issues, data.caveats),
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals", "work_orders"],
  };
}

export function getDataQualitySummary(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
): AnalyticsResult {
  return getDataQualityReport(deals, workOrders);
}

export function generateLeadershipUpdateData(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
): AnalyticsResult {
  const pipeline = getPipelineSummary(deals, { rawQuestion: "leadership summary", type: "leadership_summary" });
  const operations = getOperationalSummary(workOrders, { rawQuestion: "leadership summary", type: "leadership_summary" });
  const risk = getRiskSummary(deals, workOrders, { rawQuestion: "leadership summary", type: "leadership_summary" });

  const pipelineData = pipeline.data as Record<string, unknown>;
  const operationsData = operations.data as Record<string, unknown>;
  const riskData = risk.data as Record<string, unknown>;

  const pipelineValue = typeof pipelineData.totalPipelineValue === "number" ? pipelineData.totalPipelineValue : null;
  const weightedPipelineValue = typeof pipelineData.weightedPipelineValue === "number" ? pipelineData.weightedPipelineValue : null;
  const completionRate = typeof operationsData.completionRate === "number" ? operationsData.completionRate : null;
  const delayedOrders = typeof operationsData.delayedWorkOrders === "number" ? operationsData.delayedWorkOrders : 0;
  const atRiskDeals = typeof riskData.atRiskDeals === "number" ? riskData.atRiskDeals : 0;

  const positiveTrends: string[] = [];
  if (pipelineValue !== null) positiveTrends.push(`Pipeline value is ${formatCurrencyForNarrative(pipelineValue)}.`);
  if (completionRate !== null) positiveTrends.push(`Operational completion rate is ${formatPercentNarrative(completionRate)}.`);
  if (delayedOrders === 0) positiveTrends.push("No delayed work orders were identified in the current scope.");
  if (atRiskDeals === 0) positiveTrends.push("No deal-level risk flags were identified in the current scope.");

  const keyRisks: string[] = [];
  if (delayedOrders > 0) keyRisks.push(`${delayedOrders} work order${delayedOrders === 1 ? "" : "s"} are delayed or blocked.`);
  if (atRiskDeals > 0) keyRisks.push(`${atRiskDeals} deal${atRiskDeals === 1 ? "" : "s"} are flagged as at risk.`);
  if (pipelineValue === null) keyRisks.push("Pipeline value is unavailable because the data has insufficient valid deal values.");
  if (completionRate === null) keyRisks.push("Operational completion rate is unavailable because execution status data is insufficient.");

  const qualityCaveats = [
    "Any metric reported here is limited to the normalized records that contain valid values.",
    "Missing or malformed source values are not inferred or reconstructed.",
  ];

  const leadershipAttention: string[] = [];
  if (delayedOrders > 0) leadershipAttention.push("Review the delayed work-order queue and clear blockers before they expand into delivery risk.");
  if (atRiskDeals > 0) leadershipAttention.push("Prioritize the at-risk deals and confirm commercial decisions or dates before the next review cycle.");
  if (pipelineValue === null) leadershipAttention.push("Strengthen the data capture for deal values and close dates so leadership reporting stays reliable.");
  if (leadershipAttention.length === 0) leadershipAttention.push("Maintain current execution discipline and continue monitoring the operating plan for variance.");

  const briefSummary = [
    `Pipeline coverage is ${pipelineValue !== null ? formatCurrencyForNarrative(pipelineValue) : "not available"} across ${pipeline.data.numberOfDeals ?? 0} relevant deal${(pipeline.data.numberOfDeals ?? 0) === 1 ? "" : "s"}.`,
    completionRate !== null
      ? `Operational completion rate is ${formatPercentNarrative(completionRate)} with ${delayedOrders} delayed work order${delayedOrders === 1 ? "" : "s"} in scope.`
      : "Operational completion rate is unavailable because execution-status data is insufficient.",
    atRiskDeals > 0
      ? `${atRiskDeals} deal${atRiskDeals === 1 ? "" : "s"} are flagged as at risk and should be reviewed before the next operating cycle.`
      : "No deal-level risk flags were identified in the current scope.",
  ];

  const executiveBrief = {
    title: "WEEKLY LEADERSHIP BRIEF",
    summary: briefSummary,
    sales: {
      pipelineValue: pipelineValue !== null ? formatCurrencyForNarrative(pipelineValue) : "N/A",
      activeOpportunities: pipeline.data.activeOpenDeals ?? 0,
      closedWon: typeof pipelineData.closedWonDeals === "number" ? pipelineData.closedWonDeals : null,
      closedLost: typeof pipelineData.closedLostDeals === "number" ? pipelineData.closedLostDeals : null,
      largestOpportunity: typeof pipelineData.largestActiveOpportunity === "number" ? formatCurrencyForNarrative(pipelineData.largestActiveOpportunity) : "N/A",
      strongestSector: Array.isArray(pipelineData.bySector) ? "Unknown" : Object.entries((pipelineData.bySector ?? {}) as Record<string, number>).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Unknown",
      weightedPipelineValue: weightedPipelineValue !== null ? formatCurrencyForNarrative(weightedPipelineValue) : "N/A",
    },
    operations: {
      totalWorkOrders: operations.data.totalWorkOrders ?? 0,
      completionRate: completionRate !== null ? `${Number(completionRate).toFixed(1)}%` : "N/A",
      ongoingWorkOrders: typeof operationsData.ongoingWorkOrders === "number" ? operationsData.ongoingWorkOrders : 0,
      atRiskWorkOrders: delayedOrders,
      notStartedWorkOrders: typeof operationsData.notStartedWorkOrders === "number" ? operationsData.notStartedWorkOrders : 0,
    },
    risks: keyRisks.length > 0 ? keyRisks : ["No material risks were identified from the currently available signals."],
    recommendedActions: leadershipAttention.length > 0 ? leadershipAttention : ["Continue routine monitoring and confirm execution dates for active work orders."],
    caveats: qualityCaveats,
  };

  const leadData = {
    pipelineSummary: pipeline.data,
    operationalSummary: operations.data,
    riskSummary: risk.data,
    executiveBrief,
    business_snapshot: pipelineValue !== null
      ? `Pipeline coverage stands at ${formatCurrencyForNarrative(pipelineValue)} across ${pipeline.data.numberOfDeals ?? 0} relevant deal${(pipeline.data.numberOfDeals ?? 0) === 1 ? "" : "s"}.`
      : "Pipeline coverage is unavailable because the underlying deal values are not reliable enough for a current snapshot.",
    commercial_pipeline: weightedPipelineValue !== null
      ? `Weighted pipeline is ${formatCurrencyForNarrative(weightedPipelineValue)} after accounting for probability, which is a more realistic view of near-term conversion potential.`
      : "Weighted pipeline is unavailable because the probability data is missing or invalid.",
    revenue_signals: pipelineValue !== null
      ? `Revenue signal is based on ${formatCurrencyForNarrative(pipelineValue)} in recognized deal value and ${weightedPipelineValue !== null ? formatCurrencyForNarrative(weightedPipelineValue) : "not available"} in probability-adjusted value.`
      : "Revenue signal is unavailable because valid deal values are not present in the current dataset.",
    operational_position: completionRate !== null
      ? `Operational completion rate is ${formatPercentNarrative(completionRate)} with ${delayedOrders} delayed work order${delayedOrders === 1 ? "" : "s"} in scope.`
      : "Operational position is unavailable because the execution-status data needed for a completion rate is insufficient.",
    positive_trends: positiveTrends,
    key_risks: keyRisks,
    data_quality_caveats: qualityCaveats,
    leadership_attention: leadershipAttention,
    assumptions: [
      "Leadership update is built from the same deterministic calculations used elsewhere in the analytics layer.",
    ],
    limitations: [
      "If the underlying data lacks enough signal, the corresponding metric is marked as not available instead of guessed.",
    ],
  };

  return {
    intent: "leadership_summary",
    data: leadData,
    dataQuality: buildDataQualityReport(
      deals.length + workOrders.length,
      deals.length + workOrders.length,
      { ...getIssueCounts(deals), ...getIssueCounts(workOrders) },
      qualityCaveats,
    ),
    generatedAt: new Date().toISOString(),
    sourceBoards: ["deals", "work_orders"],
  };
}

function formatCurrencyForNarrative(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPercentNarrative(value: number): string {
  return `${Number(value).toFixed(1)}%`;
}

export function getWorkOrderSummary(
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent,
): AnalyticsResult {
  return getOperationalSummary(workOrders, intent);
}

export function getExecutiveKpis(
  deals: NormalizedDeal[],
  workOrders: NormalizedWorkOrder[],
  intent: QueryIntent = { rawQuestion: "Executive KPI summary", type: "leadership_summary" },
) {
  const pipeline = getPipelineSummary(deals, { ...intent, type: "pipeline_analysis" });
  const operations = getOperationsIntelligenceSummary(workOrders, { ...intent, type: "work_order_analysis" });
  const atRiskSummary = (operations.data as { atRiskWorkOrders?: { high?: number; medium?: number; low?: number } }).atRiskWorkOrders ?? { high: 0, medium: 0, low: 0 };

  return {
    totalPipeline: pipeline.data.totalPipelineValue ?? null,
    openDeals: pipeline.data.activeOpenDeals ?? null,
    winRate: pipeline.data.winRate ?? null,
    atRiskWorkOrders: (atRiskSummary.high ?? 0) + (atRiskSummary.medium ?? 0),
    highRiskWorkOrders: atRiskSummary.high ?? 0,
    mediumRiskWorkOrders: atRiskSummary.medium ?? 0,
    closedWon: pipeline.data.closedWonDeals ?? null,
    completionRate: operations.data.completionRate ?? null,
    generatedAt: new Date().toISOString(),
  };
}
