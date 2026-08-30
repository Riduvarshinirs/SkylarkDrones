/**
 * Core domain types for the Skylark Drones BI Agent.
 *
 * These describe monday.com data both in its raw shape and after
 * normalization, plus the shapes that flow through the agent pipeline:
 * intent -> analytics -> LLM interpretation -> UI response.
 *
 * NOTE: This file defines the contracts only. Implementations for
 * monday.com fetching, normalization, analytics, and the agent are
 * built in later stages and will import these types.
 */

// ---------------------------------------------------------------------------
// Raw monday.com primitives
// ---------------------------------------------------------------------------

/** A single column value as returned by the monday.com API for one item. */
export interface MondayColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  type?: string;
}

/** A single item (row) on a monday.com board, before any normalization. */
export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

/** A monday.com board's raw item set, as retrieved from the API. */
export interface MondayBoardData {
  boardId: string;
  boardName: string;
  items: MondayItem[];
  fetchedAt: string; // ISO timestamp - proves data was actually retrieved live
}

// ---------------------------------------------------------------------------
// Raw domain records (shape mirrors the source boards, pre-normalization)
// ---------------------------------------------------------------------------

export interface Deal {
  itemId: unknown;
  dealName: unknown;
  ownerCode: unknown;
  clientCode: unknown;
  dealStatus: unknown;
  actualCloseDate: unknown;
  closureProbability: unknown;
  dealValue: unknown;
  tentativeCloseDate: unknown;
  dealStage: unknown;
  productDeal: unknown;
  sector: unknown;
  createdDate: unknown;
}

export interface WorkOrder {
  itemId: unknown;
  dealNameMasked: unknown;
  customerNameCode: unknown;
  serialNumber: unknown;
  natureOfWork: unknown;
  executionStatus: unknown;
  dataDeliveryDate: unknown;
  poDate: unknown;
  documentType: unknown;
  probableStartDate: unknown;
  probableEndDate: unknown;
  ownerCode: unknown;
  sector: unknown;
  typeOfWork: unknown;
  amountExclGst: unknown;
  amountInclGst: unknown;
  billedValueExclGst: unknown;
  billedValueInclGst: unknown;
  collectedAmountInclGst: unknown;
  amountReceivable: unknown;
  invoiceStatus: unknown;
  woStatusBilled: unknown;
  billingStatus: unknown;
}

// ---------------------------------------------------------------------------
// Normalized records — cleaned, typed, and quality-tagged
// ---------------------------------------------------------------------------

/** Why a field or record was excluded from a calculation. */
export interface DataQualityIssue {
  field: string;
  recordId: string;
  issue:
    | "missing_value"
    | "unparseable_date"
    | "unparseable_number"
    | "duplicate_record"
    | "junk_header_row"
    | "inconsistent_category"
    | "unmatched_join_key"
    | "missing_identifier"
    | "incomplete_record";
  detail?: string;
}

export interface NormalizedDeal extends Deal {
  itemId: string | null;
  dealName: string | null;
  ownerCode: string | null;
  clientCode: string | null;
  dealStatus: string | null;
  actualCloseDate: string | null;
  closureProbability: string | null;
  dealValue: number | null;
  tentativeCloseDate: string | null;
  dealStage: string | null;
  productDeal: string | null;
  sector: string | null;
  createdDate: string | null;
  qualityFlags: DataQualityIssue[];
  isUsableForValueCalc: boolean;
  isUsableForDateCalc: boolean;
}

export interface NormalizedWorkOrder extends WorkOrder {
  itemId: string | null;
  dealNameMasked: string | null;
  customerNameCode: string | null;
  serialNumber: string | null;
  natureOfWork: string | null;
  executionStatus: string | null;
  dataDeliveryDate: string | null;
  poDate: string | null;
  documentType: string | null;
  probableStartDate: string | null;
  probableEndDate: string | null;
  ownerCode: string | null;
  sector: string | null;
  typeOfWork: string | null;
  amountExclGst: number | null;
  amountInclGst: number | null;
  billedValueExclGst: number | null;
  billedValueInclGst: number | null;
  collectedAmountInclGst: number | null;
  amountReceivable: number | null;
  invoiceStatus: string | null;
  woStatusBilled: string | null;
  billingStatus: string | null;
  qualityFlags: DataQualityIssue[];
  isUsableForValueCalc: boolean;
  isUsableForDateCalc: boolean;
}

// ---------------------------------------------------------------------------
// Query understanding
// ---------------------------------------------------------------------------

export type QueryIntentType =
  | "revenue_analysis"
  | "pipeline_analysis"
  | "sector_analysis"
  | "deal_analysis"
  | "work_order_analysis"
  | "operational_performance"
  | "customer_analysis"
  | "time_period_analysis"
  | "cross_board_analysis"
  | "risk_identification"
  | "leadership_summary"
  | "clarification_needed"
  | "unsupported";

export interface QueryIntent {
  type: QueryIntentType;
  sector?: string;
  customer?: string;
  timePeriod?: {
    label: string; // e.g. "this_quarter", "last_year", "Q2"
    start?: string;
    end?: string;
  };
  rawQuestion: string;
  clarificationQuestion?: string;
}

// ---------------------------------------------------------------------------
// Analytics results
// ---------------------------------------------------------------------------

export interface DataQualityReport {
  recordsConsidered: number;
  recordsExcluded: number;
  exclusionReasons: Partial<Record<DataQualityIssue["issue"], number>>;
  coveragePercent: number;
  caveats: string[];
}

export interface NormalizationSummary {
  totalRecords: number;
  validRecords: number;
  incompleteRecords: number;
  excludedRecords: number;
  missingFields: Record<string, number>;
  invalidDates: number;
  invalidNumericValues: number;
  warnings: string[];
  issueCounts: Partial<Record<DataQualityIssue["issue"], number>>;
}

/** A normalized source dataset and its machine-consumable quality report. */
export interface NormalizedDataset<T> {
  records: T[];
  dataQuality: NormalizationSummary;
}

export interface AnalyticsResult<T = Record<string, unknown>> {
  intent: QueryIntentType;
  data: T;
  dataQuality: DataQualityReport;
  generatedAt: string;
  sourceBoards: Array<"deals" | "work_orders">;
}

// ---------------------------------------------------------------------------
// Agent / conversational response
// ---------------------------------------------------------------------------

export interface KpiCardData {
  label: string;
  value: string;
  sublabel?: string;
}

export interface TableData {
  columns: string[];
  rows: Array<Array<string | number>>;
}

export interface AgentMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface AgentResponse {
  answer: string;
  insight?: string;
  key_metrics?: AgentMetric[];
  insights?: string[];
  kpis?: KpiCardData[];
  table?: TableData;
  data_quality?: DataQualityReport | Record<string, unknown>;
  dataQuality?: DataQualityReport;
  caveats?: string[];
  sources_context?: string[];
  clarificationNeeded?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Chat message shape used by the UI
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  response?: AgentResponse;
  status?: "pending" | "complete" | "error";
}
