import test from "node:test";
import assert from "node:assert/strict";
import type { Deal, WorkOrder } from "@/types/domain";
import { deriveCustomerKey, normalizeDate, normalizeDeals, normalizeNumber, normalizeSector, normalizeStatus, normalizeText, normalizeWorkOrders } from "./normalize";

const deal = (overrides: Partial<Deal> = {}): Deal => ({ itemId: "deal-1", dealName: "  Naruto  ", ownerCode: "OWNER_001", clientCode: "COMPANY089", dealStatus: " closed_won ", actualCloseDate: "", closureProbability: "High", dealValue: "₹4,89,360", tentativeCloseDate: "2026-02-26 00:00:00", dealStage: "B. Sales Qualified Leads", productDeal: "Service + Spectra", sector: " mining ", createdDate: "2025-12-26 00:00:00", ...overrides });
const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({ itemId: "wo-1", dealNameMasked: "Scooby-Doo", customerNameCode: "WOCOMPANY_002", serialNumber: "SDPLDEAL-075", natureOfWork: "One time Project", executionStatus: " completed ", dataDeliveryDate: "2025-09-27 00:00:00", poDate: "2025-10-29 00:00:00", documentType: "Purchase Order", probableStartDate: "2025-05-31 00:00:00", probableEndDate: "2025-06-03 00:00:00", ownerCode: "OWNER_003", sector: "Mining", typeOfWork: "Raw images/videography", amountExclGst: "264398.08", amountInclGst: "311989.7344", billedValueExclGst: "", billedValueInclGst: 0, collectedAmountInclGst: "", amountReceivable: 0, invoiceStatus: "", woStatusBilled: "", billingStatus: "Update Required", ...overrides });

test("primitive normalizers preserve missing values and reject unsafe input", () => {
  assert.equal(normalizeText("  hello   world \n"), "hello world"); assert.equal(normalizeText(" undefined "), null);
  assert.equal(normalizeNumber("₹2,500,000"), 2500000); assert.equal(normalizeNumber("(INR 1,200.50)"), -1200.5); assert.equal(normalizeNumber("12abc"), null);
  assert.equal(normalizeDate("31/12/2024"), "2024-12-31"); assert.equal(normalizeDate("01/02/2024"), null); assert.equal(normalizeDate("2024-02-30"), null);
  assert.equal(normalizeStatus(" in_progress "), "In Progress"); assert.equal(normalizeSector(" security and surveillance "), "Security and Surveillance");
});
test("normalizes supplied-data-shaped deals, with missing value caveats", () => {
  const result = normalizeDeals([deal(), deal({ itemId: "deal-2", dealValue: "not-a-number", actualCloseDate: "bad date", sector: "" })]);
  assert.equal(result.records[0].dealName, "Naruto"); assert.equal(result.records[0].dealValue, 489360); assert.equal(result.records[0].sector, "Mining"); assert.equal(result.records[0].tentativeCloseDate, "2026-02-26");
  assert.equal(result.records[1].dealValue, null); assert.ok(result.records[1].qualityFlags.some((entry) => entry.issue === "unparseable_number")); assert.ok(result.records[1].qualityFlags.some((entry) => entry.issue === "unparseable_date"));
  assert.equal(result.dataQuality.totalRecords, 2); assert.equal(result.dataQuality.invalidNumericValues, 1); assert.equal(result.dataQuality.invalidDates, 1); assert.equal(result.dataQuality.missingFields.dealValue, undefined);
});
test("normalizes supplied-data-shaped work orders and exact duplicates without dropping them", () => {
  const result = normalizeWorkOrders([workOrder(), workOrder({ itemId: "wo-2" }), workOrder({ itemId: "wo-3", amountExclGst: "invalid" })]);
  assert.equal(result.records[0].amountExclGst, 264398.08); assert.equal(result.records[0].executionStatus, "Completed"); assert.equal(result.records[0].poDate, "2025-10-29");
  assert.ok(result.records[1].qualityFlags.some((entry) => entry.issue === "duplicate_record")); assert.ok(result.records[2].qualityFlags.some((entry) => entry.issue === "unparseable_number")); assert.equal(result.dataQuality.excludedRecords, 1);
});
test("derives only explicit customer identifiers", () => { assert.equal(deriveCustomerKey("WOCOMPANY_002"), "COMPANY002"); assert.equal(deriveCustomerKey("CUSTOMER010"), "COMPANY010"); assert.equal(deriveCustomerKey("deal 10"), null); });
