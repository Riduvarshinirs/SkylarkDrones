/**
 * AI-powered BI agent orchestrator.
 *
 * The agent follows this sequence:
 *   1. understand natural-language intent
 *   2. choose relevant data and filters
 *   3. call deterministic analytics tools
 *   4. pass only structured analytics output to the LLM for final interpretation
 *   5. generate an executive-friendly answer with clear caveats
 */

import type {
  AgentResponse,
  AnalysisDetails,
  AnalyticsResult,
  ChatMessage,
  NormalizedDeal,
  NormalizedWorkOrder,
  QueryIntent,
  QueryIntentType,
} from "@/types/domain";

import {
  generateLeadershipUpdateData,
  getCustomerSummary,
  getDataQualityReport,
  getOperationalSummary,
  getPipelineSummary,
  getRevenueSummary,
  getRiskSummary,
  getSectorPerformance,
  getWorkOrderSummary,
} from "@/services/analytics";

const OPENAI_MODEL = "gpt-4o-mini";

export function classifyQuestion(question: string): QueryIntent {
  const text = question.trim();
  const lower = text.toLowerCase();
  const timePeriod = inferTimePeriod(lower);
  const sector = inferSector(lower);
  const customer = inferCustomer(lower);

  if (!text) {
    return {
      type: "clarification_needed",
      rawQuestion: text,
      clarificationQuestion: "What do you want me to assess—pipeline, revenue, operations, or risk?",
    };
  }

  if (/(operational performance|operations performance|operational metrics|team performance)/.test(lower)) {
    return {
      type: "work_order_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(^|\s)(show me performance|performance\.?|what is performance\.?)/.test(lower)) {
    return {
      type: "clarification_needed",
      rawQuestion: text,
      timePeriod,
      clarificationQuestion: "Do you mean sales performance, operational performance, or both?",
    };
  }

  if (/(leadership update|leadership summary|executive update|executive summary|give me a leadership update)/.test(lower)) {
    return {
      type: "leadership_summary",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(compare|vs|versus|comparison)/.test(lower) && /(pipeline|work order|sales|operational|operations)/.test(lower)) {
    return {
      type: "cross_board_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(work order|work orders|workorder|workorders|operational performance|operations|delivery|throughput|delayed)/.test(lower) && !/(pipeline|revenue|sales)/.test(lower)) {
    return {
      type: "work_order_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(risk|at risk|exposure|concern|warning)/.test(lower) && (/(deal|deals|opportunity|opportunities)/.test(lower) || /pipeline/.test(lower) || /all/.test(lower))) {
    return {
      type: "risk_identification",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(revenue|income|bookings|sales value|total sales)/.test(lower)) {
    return {
      type: "revenue_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(sector|industry|strongest pipeline|top sector|show me the .* sector|which sector)/.test(lower)) {
    return {
      type: "sector_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(biggest opportunity|largest opportunity|opportunities|pipeline looking|what is our pipeline|total pipeline|current pipeline|pipeline)/.test(lower)) {
    return {
      type: "pipeline_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(customer|client|account)/.test(lower)) {
    return {
      type: "customer_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  if (/(revenue|pipeline|performance|ops|operations)/.test(lower)) {
    return {
      type: "pipeline_analysis",
      rawQuestion: text,
      timePeriod,
      sector,
      customer,
    };
  }

  return {
    type: "clarification_needed",
    rawQuestion: text,
    timePeriod,
    clarificationQuestion: "I’m not certain whether you mean sales pipeline, revenue, operations, or risk. Which view would you like?",
  };
}

export function buildToolPlan(intent: QueryIntent): string[] {
  switch (intent.type) {
    case "pipeline_analysis":
      return ["getDeals", "getPipelineSummary", "getDataQualitySummary"];
    case "revenue_analysis":
      return ["getDeals", "getRevenueSummary", "getDataQualitySummary"];
    case "sector_analysis":
      return ["getDeals", "getWorkOrders", "getSectorPerformance", "getDataQualitySummary"];
    case "customer_analysis":
      return ["getDeals", "getWorkOrders", "getCustomerSummary", "getDataQualitySummary"];
    case "risk_identification":
      return ["getDeals", "getWorkOrders", "getRiskSummary", "getDataQualitySummary"];
    case "work_order_analysis":
      return ["getWorkOrders", "getWorkOrderSummary", "getDataQualitySummary"];
    case "cross_board_analysis":
      return ["getDeals", "getWorkOrders", "getPipelineSummary", "getWorkOrderSummary", "getDataQualitySummary"];
    case "leadership_summary":
      return ["getDeals", "getWorkOrders", "getPipelineSummary", "getWorkOrderSummary", "getCustomerSummary", "getRiskSummary", "getDataQualitySummary"];
    default:
      return ["getDataQualitySummary"];
  }
}

export function getDeals(deals: NormalizedDeal[] | undefined, intent: QueryIntent): NormalizedDeal[] {
  const dataset = deals ?? [];
  const filterText = (intent.sector ?? "").trim().toLowerCase();
  const customerText = (intent.customer ?? "").trim().toLowerCase();

  return dataset.filter((deal) => {
    if (filterText && deal.sector && deal.sector.toLowerCase() !== filterText) return false;
    if (filterText && deal.sector && deal.sector.toLowerCase().includes(filterText)) return true;
    if (customerText && deal.clientCode && deal.clientCode.toLowerCase() !== customerText) return false;
    return true;
  });
}

export function getWorkOrders(workOrders: NormalizedWorkOrder[] | undefined, intent: QueryIntent): NormalizedWorkOrder[] {
  const dataset = workOrders ?? [];
  const filterText = (intent.sector ?? "").trim().toLowerCase();
  const customerText = (intent.customer ?? "").trim().toLowerCase();

  return dataset.filter((order) => {
    if (filterText && order.sector && order.sector.toLowerCase() !== filterText) return false;
    if (filterText && order.sector && order.sector.toLowerCase().includes(filterText)) return true;
    if (customerText && order.customerNameCode && order.customerNameCode.toLowerCase() !== customerText) return false;
    return true;
  });
}

async function askOpenAIForInterpretation(payload: Record<string, unknown>): Promise<AgentResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a conservative executive BI analyst. Your job is to explain deterministic analytics results, never invent numbers, and clearly flag missing or low-quality data. Answer in concise executive language. Use the supplied analytics object as the only source of truth. If the metrics are missing or low quality, say so plainly. Do not speculate. Return valid JSON with keys: answer, key_metrics, insights, data_quality, sources_context.`,
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as Partial<AgentResponse>;
    return {
      answer: parsed.answer ?? "I cannot answer this reliably from the available data.",
      key_metrics: parsed.key_metrics ?? [],
      insights: parsed.insights ?? [],
      data_quality: parsed.data_quality ?? { coveragePercent: 0 },
      sources_context: parsed.sources_context ?? [],
    };
  } catch {
    return null;
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "not available";
  return `${Number(value).toFixed(1)}%`;
}

function buildAnalysisDetails(
  intent: QueryIntent,
  analyticsResult: AnalyticsResult | null,
  sourceDeals: NormalizedDeal[],
  sourceWorkOrders: NormalizedWorkOrder[],
): AnalysisDetails | undefined {
  const dataSources = ["Deals"];
  if (sourceWorkOrders.length > 0 || analyticsResult?.sourceBoards?.includes("work_orders")) {
    dataSources.push("Work Orders");
  }

  const filters: string[] = [];
  if (intent.timePeriod?.label) {
    filters.push(intent.timePeriod.label.replace(/_/g, " "));
  }
  if (intent.sector) {
    filters.push(`Sector: ${intent.sector}`);
  }
  if (intent.customer) {
    filters.push(`Customer: ${intent.customer}`);
  }

  const recordsConsidered = analyticsResult?.dataQuality?.recordsConsidered ?? sourceDeals.length + sourceWorkOrders.length;
  const recordsExcluded = analyticsResult?.dataQuality?.recordsExcluded ?? 0;
  const reasons = analyticsResult?.dataQuality?.caveats && analyticsResult.dataQuality.caveats.length > 0
    ? analyticsResult.dataQuality.caveats
    : ["Data quality limitations are reported explicitly; values are never inferred without support."];

  return {
    dataSources,
    filters: filters.length > 0 ? filters : ["No additional filters"],
    recordsAnalyzed: recordsConsidered,
    recordsExcluded,
    reason: reasons,
  };
}

function buildFallbackResponse(question: string, intent: QueryIntent, analyticsResult: AnalyticsResult | null, sourceDeals: NormalizedDeal[], sourceWorkOrders: NormalizedWorkOrder[]): AgentResponse {
  const empty = {
    answer: "I do not have enough reliable data to answer that confidently.",
    key_metrics: [],
    insights: ["The current dataset does not contain enough usable information for a trustworthy answer."],
    analysis_details: buildAnalysisDetails(intent, analyticsResult, sourceDeals, sourceWorkOrders),
    data_quality: { coveragePercent: 0, caveats: ["Source coverage is insufficient."], recordsConsidered: 0, recordsExcluded: 0, exclusionReasons: {} },
    sources_context: ["No usable source data"],
  };

  if (!analyticsResult) {
    return empty;
  }

  const payload = analyticsResult.data as Record<string, any>;
  const metrics: Array<{ label: string; value: string; detail?: string }> = [];
  const insights: string[] = [];

  if (payload.totalPipelineValue !== undefined && payload.totalPipelineValue !== null) {
    metrics.push({ label: "Total pipeline", value: formatMoney(payload.totalPipelineValue) });
  }
  if (payload.weightedPipelineValue !== undefined && payload.weightedPipelineValue !== null) {
    metrics.push({ label: "Weighted pipeline", value: formatMoney(payload.weightedPipelineValue) });
  }
  if (payload.completionRate !== undefined && payload.completionRate !== null) {
    metrics.push({ label: "Completion rate", value: formatPercent(payload.completionRate) });
  }
  if (payload.totalWorkOrders !== undefined && payload.totalWorkOrders !== null) {
    metrics.push({ label: "Work orders", value: String(payload.totalWorkOrders) });
  }
  if (payload.delayedWorkOrders !== undefined && payload.delayedWorkOrders !== null) {
    metrics.push({ label: "Delayed work orders", value: String(payload.delayedWorkOrders) });
  }
  if (payload.totalOperationalValue !== undefined && payload.totalOperationalValue !== null) {
    metrics.push({ label: "Operational value", value: formatMoney(payload.totalOperationalValue) });
  }

  if (payload.sectors && Array.isArray(payload.sectors) && payload.sectors.length > 0) {
    const top = payload.sectors[0];
    if (top?.sector) {
      insights.push(`${top.sector} is the leading sector by combined value.`);
    }
  }

  if (payload.missingInformation) {
    const missingFields = Object.entries(payload.missingInformation ?? {})
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${key}: ${value}`);
    if (missingFields.length > 0) {
      insights.push(`Key data gaps: ${missingFields.join(", ")}.`);
    }
  }

  const answerBase = (() => {
    if (intent.type === "clarification_needed") return "I need a bit more clarity on whether you mean pipeline, revenue, operations, or risk.";
    if (intent.type === "revenue_analysis") {
      const value = payload.revenueSummary?.totalPipelineValue ?? payload.totalPipelineValue;
      return value !== null && value !== undefined ? `Revenue coverage is currently ${formatMoney(value)} based on the available pipeline data.` : "Revenue is not available because the underlying numbers are missing or incomplete.";
    }
    if (intent.type === "work_order_analysis") {
      const delayed = payload.delayedWorkOrders ?? 0;
      return `Operationally, there are ${delayed} delayed work orders in scope.`;
    }
    if (intent.type === "risk_identification") {
      const riskDeals = payload.atRiskDeals ?? 0;
      return `Risk review shows ${riskDeals} at-risk deal items and ${payload.delayedWorkOrders ?? 0} delayed work orders.`;
    }
    if (intent.type === "sector_analysis") {
      return payload.sectors?.length ? `The strongest sector currently is ${payload.sectors[0].sector}.` : "There is not enough valid sector data to rank performance.";
    }
    if (intent.type === "leadership_summary") {
      const pipeline = payload.pipelineSummary?.totalPipelineValue ?? payload.totalPipelineValue;
      const op = payload.operationalSummary?.completionRate ?? payload.completionRate;
      return `Leadership summary: pipeline is ${pipeline !== null && pipeline !== undefined ? formatMoney(pipeline) : "not available"} and completion rate is ${op !== null && op !== undefined ? formatPercent(op) : "not available"}.`;
    }
    const pipeline = payload.totalPipelineValue ?? null;
    return pipeline !== null && pipeline !== undefined ? `The current pipeline is ${formatMoney(pipeline)}.` : "The current pipeline is not available because the required values are missing or incomplete.";
  })();

  return {
    answer: answerBase,
    key_metrics: metrics,
    insights: insights.length > 0 ? insights : ["This answer was generated from deterministic calculations only."],
    analysis_details: buildAnalysisDetails(intent, analyticsResult, sourceDeals, sourceWorkOrders),
    data_quality: analyticsResult.dataQuality ?? { coveragePercent: 0 },
    sources_context: analyticsResult.sourceBoards ?? ["analytics layer"],
  };
}

function inferTimePeriod(text: string): { label: string; start?: string; end?: string } {
  if (/this quarter|quarter/.test(text)) return { label: "this_quarter" };
  if (/last quarter/.test(text)) return { label: "last_quarter" };
  if (/this month/.test(text)) return { label: "this_month" };
  if (/this week/.test(text)) return { label: "this_week" };
  if (/this year/.test(text)) return { label: "this_year" };
  if (/last year/.test(text)) return { label: "last_year" };
  return { label: "this_year" };
}

function inferSector(text: string): string | undefined {
  const matches = ["energy", "construction", "infrastructure", "logistics", "renewables", "mining", "powerline", "railways"];
  const found = matches.find((entry) => text.includes(entry));
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : undefined;
}

function inferCustomer(text: string): string | undefined {
  const match = text.match(/for\s+([a-z0-9\-\s]+?)(?:\?|$|\.)/i);
  return match ? match[1].trim() : undefined;
}

function normalizeLeadershipUpdate(value: unknown): AgentResponse["leadership_update"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Partial<{
    business_snapshot: unknown;
    commercial_pipeline: unknown;
    revenue_signals: unknown;
    operational_position: unknown;
    positive_trends: unknown;
    key_risks: unknown;
    data_quality_caveats: unknown;
    leadership_attention: unknown;
  }>;

  const requiredStrings = [
    candidate.business_snapshot,
    candidate.commercial_pipeline,
    candidate.revenue_signals,
    candidate.operational_position,
  ];

  if (requiredStrings.some((item) => typeof item !== "string")) {
    return undefined;
  }

  const positiveTrends = Array.isArray(candidate.positive_trends) ? candidate.positive_trends.filter((item): item is string => typeof item === "string") : [];
  const keyRisks = Array.isArray(candidate.key_risks) ? candidate.key_risks.filter((item): item is string => typeof item === "string") : [];
  const caveats = Array.isArray(candidate.data_quality_caveats) ? candidate.data_quality_caveats.filter((item): item is string => typeof item === "string") : [];
  const attention = Array.isArray(candidate.leadership_attention) ? candidate.leadership_attention.filter((item): item is string => typeof item === "string") : [];

  return {
    business_snapshot: candidate.business_snapshot as string,
    commercial_pipeline: candidate.commercial_pipeline as string,
    revenue_signals: candidate.revenue_signals as string,
    operational_position: candidate.operational_position as string,
    positive_trends: positiveTrends,
    key_risks: keyRisks,
    data_quality_caveats: caveats,
    leadership_attention: attention,
  };
}

export async function handleUserQuestion(
  question: string,
  _history: ChatMessage[],
  providedData?: { deals?: NormalizedDeal[]; workOrders?: NormalizedWorkOrder[] },
): Promise<AgentResponse> {
  const intent = classifyQuestion(question);

  if (intent.type === "clarification_needed") {
    return {
      answer: intent.clarificationQuestion ?? "I need a bit more clarity before I can answer that accurately.",
      key_metrics: [],
      insights: ["The question is ambiguous, so the answer is intentionally deferred rather than guessed."],
      data_quality: { coveragePercent: 0, caveats: ["Clarification required."], recordsConsidered: 0, recordsExcluded: 0, exclusionReasons: {} },
      sources_context: ["clarification required"],
      clarificationNeeded: intent.clarificationQuestion,
    };
  }

  const sourceDeals = getDeals(providedData?.deals ?? [], intent);
  const sourceWorkOrders = getWorkOrders(providedData?.workOrders ?? [], intent);

  let analyticsResult: AnalyticsResult | null = null;

  switch (intent.type) {
    case "pipeline_analysis":
      analyticsResult = getPipelineSummary(sourceDeals, intent);
      break;
    case "revenue_analysis":
      analyticsResult = getRevenueSummary(sourceDeals, intent);
      break;
    case "sector_analysis":
      analyticsResult = getSectorPerformance(sourceDeals, sourceWorkOrders, intent);
      break;
    case "customer_analysis":
      analyticsResult = getCustomerSummary(sourceDeals, sourceWorkOrders, intent);
      break;
    case "risk_identification":
      analyticsResult = getRiskSummary(sourceDeals, sourceWorkOrders, intent);
      break;
    case "work_order_analysis":
      analyticsResult = getWorkOrderSummary(sourceWorkOrders, intent);
      break;
    case "cross_board_analysis":
      analyticsResult = {
        intent: "cross_board_analysis",
        data: {
          pipeline: getPipelineSummary(sourceDeals, intent).data,
          operations: getOperationalSummary(sourceWorkOrders, intent).data,
        },
        dataQuality: getDataQualityReport(sourceDeals, sourceWorkOrders).dataQuality,
        generatedAt: new Date().toISOString(),
        sourceBoards: ["deals", "work_orders"],
      };
      break;
    case "leadership_summary":
      analyticsResult = {
        intent: "leadership_summary",
        data: {
          pipelineSummary: getPipelineSummary(sourceDeals, intent).data,
          operationalSummary: getOperationalSummary(sourceWorkOrders, intent).data,
          riskSummary: getRiskSummary(sourceDeals, sourceWorkOrders, intent).data,
        },
        dataQuality: getDataQualityReport(sourceDeals, sourceWorkOrders).dataQuality,
        generatedAt: new Date().toISOString(),
        sourceBoards: ["deals", "work_orders"],
      };
      break;
    default:
      analyticsResult = null;
      break;
  }

  const fallback = buildFallbackResponse(question, intent, analyticsResult, sourceDeals, sourceWorkOrders);

  if (!analyticsResult || !(sourceDeals.length || sourceWorkOrders.length)) {
    return {
      ...fallback,
      answer: "I do not have enough reliable data to answer that confidently. The data source is either missing or incomplete.",
    };
  }

  const structured = await askOpenAIForInterpretation({
    question,
    intent,
    toolPlan: buildToolPlan(intent),
    analyticsResult,
  });

  if (structured && structured.answer) {
    const leadershipUpdate =
      intent.type === "leadership_summary" && typeof structured === "object" && structured !== null && "leadership_update" in structured
        ? normalizeLeadershipUpdate(structured.leadership_update)
        : undefined;

    const normalizedLead = leadershipUpdate ??
      (intent.type === "leadership_summary"
        ? normalizeLeadershipUpdate(generateLeadershipUpdateData(sourceDeals, sourceWorkOrders).data)
        : undefined);

    return {
      ...structured,
      leadership_update: normalizedLead,
      analysis_details: structured.analysis_details ?? buildAnalysisDetails(intent, analyticsResult, sourceDeals, sourceWorkOrders),
      data_quality: structured.data_quality ?? analyticsResult.dataQuality,
      sources_context: structured.sources_context ?? analyticsResult.sourceBoards,
    };
  }

  if (intent.type === "leadership_summary") {
    const leadershipUpdate = normalizeLeadershipUpdate(generateLeadershipUpdateData(sourceDeals, sourceWorkOrders).data);
    return {
      answer: `Leadership update: ${String(leadershipUpdate?.business_snapshot ?? "Current business conditions are being tracked with available source data.")}`,
      key_metrics: [],
      insights: Array.isArray(leadershipUpdate?.positive_trends) ? leadershipUpdate.positive_trends : [],
      leadership_update: leadershipUpdate,
      analysis_details: buildAnalysisDetails(intent, analyticsResult, sourceDeals, sourceWorkOrders),
      data_quality: analyticsResult.dataQuality,
      sources_context: analyticsResult.sourceBoards,
    };
  }

  return fallback;
}
