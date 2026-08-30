/** Deterministic normalization boundary between monday.com and analytics. */
import type { DataQualityIssue, Deal, NormalizedDataset, NormalizedDeal, NormalizedWorkOrder, NormalizationSummary, WorkOrder } from "@/types/domain";

const MISSING_TEXT = new Set(["", "null", "undefined", "n/a", "na", "none", "nil", "-", "--"]);
const STATUS_ALIASES: Record<string, string> = { complete: "Completed", completed: "Completed", closedwon: "Won", won: "Won", closedlost: "Lost", lost: "Lost", inprogress: "In Progress", running: "In Progress", onhold: "On Hold", notstarted: "Not Started", cancelled: "Cancelled", canceled: "Cancelled" };
const SECTOR_ALIASES: Record<string, string> = { mining: "Mining", quarry: "Mining", quarrying: "Mining", renewables: "Renewables", renewable: "Renewables", powerline: "Powerline", railways: "Railways", railway: "Railways", construction: "Construction", manufacturing: "Manufacturing", aviation: "Aviation", dsp: "DSP", tender: "Tender", others: "Others", securityandsurveillance: "Security and Surveillance", oilandgas: "Oil & Gas" };

export function isMissingValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && MISSING_TEXT.has(value.replace(/\u00a0/g, " ").trim().toLowerCase()));
}
export function normalizeText(value: unknown): string | null {
  if (isMissingValue(value)) return null;
  const result = String(value).replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  return result || null;
}
function categoryKey(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function titleCase(value: string): string { return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()); }
export function normalizeStatus(value: unknown): string | null { const text = normalizeText(value); return text ? STATUS_ALIASES[categoryKey(text)] ?? titleCase(text) : null; }
export function normalizeSector(value: unknown): string | null { const text = normalizeText(value); return text ? SECTOR_ALIASES[categoryKey(text)] ?? titleCase(text) : null; }

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}
/** Normalizes only explicit, unambiguous dates. Ambiguous numeric dates remain null. */
export function normalizeDate(value: unknown): string | null {
  if (isMissingValue(value)) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = normalizeText(value); if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) { const a = Number(dmy[1]); const b = Number(dmy[2]); if (a > 12 && b <= 12) return validDate(Number(dmy[3]), b, a); if (b > 12 && a <= 12) return validDate(Number(dmy[3]), a, b); return null; }
  const named = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) { const parsed = new Date(`${named[1]} ${named[2]}, ${named[3]} UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10); }
  return null;
}
/** Parses numeric values and common currency formatting, rejecting malformed input. */
export function normalizeNumber(value: unknown): number | null {
  if (isMissingValue(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = normalizeText(value); if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/^\(|\)$/g, "").replace(/[₹$€£]/g, "").replace(/\b(?:inr|rs\.?|usd)\b/gi, "").trim();
  if (!/^-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?$/.test(cleaned)) return null;
  const number = Number(cleaned.replace(/,/g, "")); return Number.isFinite(number) ? (negative ? -number : number) : null;
}

function issue(recordId: string | null, field: string, kind: DataQualityIssue["issue"], detail: string): DataQualityIssue { return { recordId: recordId ?? "<missing-id>", field, issue: kind, detail }; }
function normalizedId(value: unknown): string | null { return normalizeText(value); }
function textField(value: unknown, field: string, id: string | null, flags: DataQualityIssue[]): string | null { const out = normalizeText(value); if (!out) flags.push(issue(id, field, "missing_value", `Missing ${field}.`)); return out; }
function dateField(value: unknown, field: string, id: string | null, flags: DataQualityIssue[]): string | null { const out = normalizeDate(value); if (!out) flags.push(issue(id, field, isMissingValue(value) ? "missing_value" : "unparseable_date", isMissingValue(value) ? `Missing ${field}.` : `Invalid ${field}; it was not used in date calculations.`)); return out; }
function numberField(value: unknown, field: string, id: string | null, flags: DataQualityIssue[]): number | null { const out = normalizeNumber(value); if (out === null) flags.push(issue(id, field, isMissingValue(value) ? "missing_value" : "unparseable_number", isMissingValue(value) ? `Missing ${field}; this record was excluded from ${field} calculations.` : `Invalid ${field}; this record was excluded from ${field} calculations.`)); return out; }
function categoryField(value: unknown, field: string, id: string | null, flags: DataQualityIssue[], normalize: (input: unknown) => string | null): string | null { const original = normalizeText(value); const out = normalize(value); if (!out) { flags.push(issue(id, field, "missing_value", `Missing ${field}.`)); return null; } if (original !== out) flags.push(issue(id, field, "inconsistent_category", `Normalized ${field} from “${original}” to “${out}”.`)); return out; }
function addDuplicateFlags<T extends { itemId: string | null; qualityFlags: DataQualityIssue[] }>(records: T[], fingerprint: (record: T) => Array<string | number | null>): void {
  const seen = new Map<string, T>();
  for (const record of records) { const parts = fingerprint(record); if (parts.some((part) => part === null)) continue; const key = parts.join("\u0000"); const first = seen.get(key); if (!first) { seen.set(key, record); continue; } record.qualityFlags.push(issue(record.itemId, "record", "duplicate_record", `Exact normalized duplicate of record ${first.itemId ?? "with a missing identifier"}; retained but excluded from aggregate calculations.`)); }
}

export function normalizeDeal(raw: Deal): NormalizedDeal {
  const flags: DataQualityIssue[] = []; const itemId = normalizedId(raw.itemId);
  if (!itemId) flags.push(issue(itemId, "itemId", "missing_identifier", "Missing monday.com item identifier."));
  const record: NormalizedDeal = { itemId, dealName: textField(raw.dealName, "dealName", itemId, flags), ownerCode: textField(raw.ownerCode, "ownerCode", itemId, flags), clientCode: textField(raw.clientCode, "clientCode", itemId, flags), dealStatus: categoryField(raw.dealStatus, "dealStatus", itemId, flags, normalizeStatus), actualCloseDate: dateField(raw.actualCloseDate, "actualCloseDate", itemId, flags), closureProbability: textField(raw.closureProbability, "closureProbability", itemId, flags), dealValue: numberField(raw.dealValue, "dealValue", itemId, flags), tentativeCloseDate: dateField(raw.tentativeCloseDate, "tentativeCloseDate", itemId, flags), dealStage: textField(raw.dealStage, "dealStage", itemId, flags), productDeal: textField(raw.productDeal, "productDeal", itemId, flags), sector: categoryField(raw.sector, "sector", itemId, flags, normalizeSector), createdDate: dateField(raw.createdDate, "createdDate", itemId, flags), qualityFlags: flags, isUsableForValueCalc: false, isUsableForDateCalc: false };
  if (record.dealName?.toLowerCase() === "deal name" || record.sector?.toLowerCase() === "sector/service") flags.push(issue(itemId, "record", "junk_header_row", "Header-like row retained for auditing and excluded from calculations."));
  record.isUsableForValueCalc = record.dealValue !== null; record.isUsableForDateCalc = record.actualCloseDate !== null || record.tentativeCloseDate !== null; return record;
}
export function normalizeWorkOrder(raw: WorkOrder): NormalizedWorkOrder {
  const flags: DataQualityIssue[] = []; const itemId = normalizedId(raw.itemId);
  if (!itemId) flags.push(issue(itemId, "itemId", "missing_identifier", "Missing monday.com item identifier."));
  const record: NormalizedWorkOrder = { itemId, dealNameMasked: textField(raw.dealNameMasked, "dealNameMasked", itemId, flags), customerNameCode: textField(raw.customerNameCode, "customerNameCode", itemId, flags), serialNumber: textField(raw.serialNumber, "serialNumber", itemId, flags), natureOfWork: textField(raw.natureOfWork, "natureOfWork", itemId, flags), executionStatus: categoryField(raw.executionStatus, "executionStatus", itemId, flags, normalizeStatus), dataDeliveryDate: dateField(raw.dataDeliveryDate, "dataDeliveryDate", itemId, flags), poDate: dateField(raw.poDate, "poDate", itemId, flags), documentType: textField(raw.documentType, "documentType", itemId, flags), probableStartDate: dateField(raw.probableStartDate, "probableStartDate", itemId, flags), probableEndDate: dateField(raw.probableEndDate, "probableEndDate", itemId, flags), ownerCode: textField(raw.ownerCode, "ownerCode", itemId, flags), sector: categoryField(raw.sector, "sector", itemId, flags, normalizeSector), typeOfWork: textField(raw.typeOfWork, "typeOfWork", itemId, flags), amountExclGst: numberField(raw.amountExclGst, "amountExclGst", itemId, flags), amountInclGst: numberField(raw.amountInclGst, "amountInclGst", itemId, flags), billedValueExclGst: numberField(raw.billedValueExclGst, "billedValueExclGst", itemId, flags), billedValueInclGst: numberField(raw.billedValueInclGst, "billedValueInclGst", itemId, flags), collectedAmountInclGst: numberField(raw.collectedAmountInclGst, "collectedAmountInclGst", itemId, flags), amountReceivable: numberField(raw.amountReceivable, "amountReceivable", itemId, flags), invoiceStatus: categoryField(raw.invoiceStatus, "invoiceStatus", itemId, flags, normalizeStatus), woStatusBilled: categoryField(raw.woStatusBilled, "woStatusBilled", itemId, flags, normalizeStatus), billingStatus: categoryField(raw.billingStatus, "billingStatus", itemId, flags, normalizeStatus), qualityFlags: flags, isUsableForValueCalc: false, isUsableForDateCalc: false };
  if (record.dealNameMasked?.toLowerCase() === "deal name masked") flags.push(issue(itemId, "record", "junk_header_row", "Header-like row retained for auditing and excluded from calculations."));
  record.isUsableForValueCalc = [record.amountExclGst, record.amountInclGst, record.billedValueExclGst, record.billedValueInclGst, record.collectedAmountInclGst, record.amountReceivable].some((value) => value !== null); record.isUsableForDateCalc = [record.dataDeliveryDate, record.poDate, record.probableStartDate, record.probableEndDate].some((value) => value !== null); return record;
}
export function getNormalizationSummary(records: Array<{ qualityFlags: DataQualityIssue[] }>): NormalizationSummary {
  const missingFields: Record<string, number> = {}; const issueCounts: NormalizationSummary["issueCounts"] = {}; let invalidDates = 0; let invalidNumericValues = 0;
  for (const record of records) for (const entry of record.qualityFlags) { issueCounts[entry.issue] = (issueCounts[entry.issue] ?? 0) + 1; if (entry.issue === "missing_value" || entry.issue === "missing_identifier") missingFields[entry.field] = (missingFields[entry.field] ?? 0) + 1; if (entry.issue === "unparseable_date") invalidDates++; if (entry.issue === "unparseable_number") invalidNumericValues++; }
  const incompleteRecords = records.filter((record) => record.qualityFlags.length > 0).length; const excludedRecords = records.filter((record) => record.qualityFlags.some((entry) => ["duplicate_record", "junk_header_row", "missing_identifier"].includes(entry.issue))).length;
  return { totalRecords: records.length, validRecords: records.length - incompleteRecords, incompleteRecords, excludedRecords, missingFields, invalidDates, invalidNumericValues, warnings: records.flatMap((record) => record.qualityFlags.map((entry) => entry.detail).filter((detail): detail is string => Boolean(detail))), issueCounts };
}
export function normalizeDeals(rawDeals: Deal[]): NormalizedDataset<NormalizedDeal> { const records = rawDeals.map(normalizeDeal); addDuplicateFlags(records, (r) => [r.dealName, r.clientCode, r.createdDate, r.dealValue]); return { records, dataQuality: getNormalizationSummary(records) }; }
export function normalizeWorkOrders(rawWorkOrders: WorkOrder[]): NormalizedDataset<NormalizedWorkOrder> { const records = rawWorkOrders.map(normalizeWorkOrder); addDuplicateFlags(records, (r) => [r.customerNameCode, r.serialNumber, r.poDate, r.amountExclGst]); return { records, dataQuality: getNormalizationSummary(records) }; }
export function deriveCustomerKey(rawCode: unknown): string | null { const compact = normalizeText(rawCode)?.toUpperCase().replace(/[^A-Z0-9]/g, ""); const match = compact?.match(/(?:WO)?(?:COMPANY|CUSTOMER)0*(\d+)$/); return match ? `COMPANY${match[1].padStart(3, "0")}` : null; }
