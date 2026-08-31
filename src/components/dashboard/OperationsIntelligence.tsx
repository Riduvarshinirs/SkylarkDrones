import { getOperationsIntelligenceSummary } from "@/services/analytics";
import { normalizeWorkOrders } from "@/services/data/normalize";
import { fetchWorkOrdersBoard, getMondayConfig } from "@/services/monday/client";

interface BoardColumn {
  id?: string;
  text?: string | null;
  value?: string | null;
  type?: string;
}

interface BoardItem {
  id: string;
  name: string;
  column_values?: BoardColumn[];
}

const normalizeBoardKey = (value: string | null | undefined): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

function findColumnValue(item: BoardItem, aliases: string[]): BoardColumn | null {
  if (!item.column_values) return null;

  const aliasKeys = aliases.map((alias) => normalizeBoardKey(alias));

  for (const column of item.column_values) {
    const idKey = normalizeBoardKey(column.id);
    const textKey = normalizeBoardKey(column.text ?? "");
    const valueKey = normalizeBoardKey(column.value ?? "");

    const matches = aliasKeys.some(
      (alias) =>
        idKey === alias ||
        textKey.includes(alias) ||
        valueKey.includes(alias) ||
        idKey.includes(alias),
    );

    if (matches) {
      return column;
    }
  }

  return null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function getOperationsIntelligenceData() {
  try {
    const config = getMondayConfig();
    const workOrdersBoard = await fetchWorkOrdersBoard(config);

    const normalizedWorkOrders = normalizeWorkOrders(
      workOrdersBoard.items.map((item) => {
        const customerValue = findColumnValue(item, ["customer", "customer_code", "customernamecode", "account"]);
        const serialValue = findColumnValue(item, ["serial_number", "serialnumber", "serial_no"]);
        const natureOfWorkValue = findColumnValue(item, ["nature_of_work", "natureofwork", "work_nature"]);
        const executionStatusValue = findColumnValue(item, ["execution_status", "executionstatus", "status", "wo_status"]);
        const priorityValue = findColumnValue(item, ["priority", "work_priority", "urgency"]);
        const dataDeliveryDateValue = findColumnValue(item, ["data_delivery_date", "datadeliverydate", "delivery_date"]);
        const poDateValue = findColumnValue(item, ["po_date", "podate", "purchase_order_date"]);
        const documentTypeValue = findColumnValue(item, ["document_type", "documenttype", "doctype"]);
        const probableStartDateValue = findColumnValue(item, ["probable_start_date", "probablestartdate", "start_date"]);
        const probableEndDateValue = findColumnValue(item, ["probable_end_date", "probableenddate", "end_date"]);
        const workOrderOwnerValue = findColumnValue(item, ["owner", "ownercode", "owner_code"]);
        const sectorValue = findColumnValue(item, ["sector", "sectorservice", "sector_service", "industry"]);
        const typeOfWorkValue = findColumnValue(item, ["type_of_work", "typeofwork", "work_type"]);
        const amountExclGstValue = findColumnValue(item, ["amount_excl_gst", "amountexclgst", "amount_without_gst"]);
        const amountInclGstValue = findColumnValue(item, ["amount_incl_gst", "amountinclgst", "amount_with_gst"]);
        const billedExclGstValue = findColumnValue(item, ["billed_excl_gst", "billedexclgst", "billed_value_excl_gst"]);
        const billedInclGstValue = findColumnValue(item, ["billed_incl_gst", "billedinclgst", "billed_value_incl_gst"]);
        const collectedInclGstValue = findColumnValue(item, ["collected_incl_gst", "collectedinclgst", "collected_amount_incl_gst"]);
        const amountReceivableValue = findColumnValue(item, ["amount_receivable", "amountreceivable", "receivable_amount"]);
        const invoiceStatusValue = findColumnValue(item, ["invoice_status", "invoicestatus", "billing_status"]);
        const woStatusBilledValue = findColumnValue(item, ["wo_status_billed", "wostatusbilled", "billing_status"]);
        const billingStatusValue = findColumnValue(item, ["billing_status", "billingstatus", "payment_status"]);

        return {
          itemId: item.id,
          dealNameMasked: item.name,
          customerNameCode: customerValue?.text ?? null,
          serialNumber: serialValue?.text ?? null,
          natureOfWork: natureOfWorkValue?.text ?? null,
          executionStatus: executionStatusValue?.text ?? null,
          priority: priorityValue?.text ?? null,
          dataDeliveryDate: dataDeliveryDateValue?.text ?? null,
          poDate: poDateValue?.text ?? null,
          documentType: documentTypeValue?.text ?? null,
          probableStartDate: probableStartDateValue?.text ?? null,
          probableEndDate: probableEndDateValue?.text ?? null,
          ownerCode: workOrderOwnerValue?.text ?? null,
          sector: sectorValue?.text ?? null,
          typeOfWork: typeOfWorkValue?.text ?? null,
          amountExclGst: amountExclGstValue?.text ?? null,
          amountInclGst: amountInclGstValue?.text ?? null,
          billedValueExclGst: billedExclGstValue?.text ?? null,
          billedValueInclGst: billedInclGstValue?.text ?? null,
          collectedAmountInclGst: collectedInclGstValue?.text ?? null,
          amountReceivable: amountReceivableValue?.text ?? null,
          invoiceStatus: invoiceStatusValue?.text ?? null,
          woStatusBilled: woStatusBilledValue?.text ?? null,
          billingStatus: billingStatusValue?.text ?? null,
        };
      }),
    );

    return getOperationsIntelligenceSummary(normalizedWorkOrders.records, {
      rawQuestion: "Groundtruth operational overview",
      type: "work_order_analysis",
      timePeriod: { label: "this_year" },
    });
  } catch {
    return null;
  }
}

export async function OperationsIntelligence() {
  const operationsResult = await getOperationsIntelligenceData();

  if (!operationsResult) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8" aria-live="polite">
        <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-ink">Operations intelligence</h3>
          <p className="mt-2 text-sm text-graphite">Work Orders data is unavailable. Configure the monday.com Work Orders board to populate execution and risk analytics.</p>
        </div>
      </section>
    );
  }

  const data = operationsResult.data as {
    statusOverview?: {
      completed?: number;
      ongoing?: number;
      notStarted?: number;
      otherStatuses?: Array<{ status: string; count: number }>;
    };
    completionRate?: number | null;
    atRiskWorkOrders?: {
      high?: number;
      medium?: number;
      low?: number;
      items?: Array<{
        workOrderName?: string | null;
        status?: string | null;
        priority?: string | null;
        relevantDate?: string | null;
        reason?: string;
        riskLevel?: string;
      }>;
    };
    executiveInsight?: string;
  };

  const statusOverview = data.statusOverview ?? { completed: 0, ongoing: 0, notStarted: 0, otherStatuses: [] };
  const riskItems = (data.atRiskWorkOrders?.items ?? []).slice(0, 5);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8" aria-label="Operations intelligence">
      <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.66rem] font-medium uppercase tracking-[0.12em] text-graphite-soft">Operations intelligence</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">Work order status overview</h3>
          </div>
          <div className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-graphite">
            {data.atRiskWorkOrders ? (data.atRiskWorkOrders.high ?? 0) + (data.atRiskWorkOrders.medium ?? 0) + (data.atRiskWorkOrders.low ?? 0) : 0} flagged
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Completed</p>
            <p className="mt-2 text-xl font-semibold text-ink">{statusOverview.completed ?? 0}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Ongoing</p>
            <p className="mt-2 text-xl font-semibold text-ink">{statusOverview.ongoing ?? 0}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Not started</p>
            <p className="mt-2 text-xl font-semibold text-ink">{statusOverview.notStarted ?? 0}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Completion rate</p>
            <p className="mt-2 text-xl font-semibold text-ink">{data.completionRate !== null && data.completionRate !== undefined ? `${data.completionRate.toFixed(1)}%` : "N/A"}</p>
          </div>
        </div>

        {statusOverview.otherStatuses && statusOverview.otherStatuses.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold text-ink">Other actual statuses</h4>
            <div className="flex flex-wrap gap-2">
              {statusOverview.otherStatuses.map((status) => (
                <span key={status.status} className="rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite">
                  {status.status}: {status.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.executiveInsight && (
          <div className="mb-6 rounded-xl border border-line bg-paper p-3 text-sm text-ink">
            {data.executiveInsight}
          </div>
        )}

        {riskItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">At-risk work orders</h4>
              <div className="flex flex-wrap gap-2 text-[0.62rem] font-mono uppercase tracking-[0.08em] text-graphite-soft">
                <span className="rounded-full border border-line bg-paper px-2 py-1">High: {data.atRiskWorkOrders?.high ?? 0}</span>
                <span className="rounded-full border border-line bg-paper px-2 py-1">Medium: {data.atRiskWorkOrders?.medium ?? 0}</span>
                <span className="rounded-full border border-line bg-paper px-2 py-1">Low: {data.atRiskWorkOrders?.low ?? 0}</span>
              </div>
            </div>

            <div className="space-y-2">
              {riskItems.map((item) => (
                <div key={`${item.workOrderName ?? "work-order"}-${item.relevantDate ?? item.status ?? "risk"}`} className="rounded-xl border border-line bg-paper p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-ink">{item.workOrderName ?? "Unnamed work order"}</div>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] ${
                        item.riskLevel === "High"
                          ? "border-risk/40 bg-risk-tint text-risk"
                          : item.riskLevel === "Medium"
                            ? "border-signal/40 bg-signal/10 text-signal"
                            : "border-graphite/30 bg-panel text-graphite"
                      }`}
                    >
                      {item.riskLevel ?? "Low"}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2 text-[0.75rem] text-graphite sm:grid-cols-2">
                    <div><span className="font-medium text-ink">Status:</span> {item.status ?? "Unknown"}</div>
                    <div><span className="font-medium text-ink">Priority:</span> {item.priority ?? "Not specified"}</div>
                    <div><span className="font-medium text-ink">Relevant date:</span> {formatDate(item.relevantDate ?? null)}</div>
                    <div><span className="font-medium text-ink">Reason:</span> {item.reason ?? "Status and timing indicate follow-up is needed"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-paper p-3 text-sm text-graphite">No work orders currently require attention based on the available execution and date signals.</div>
        )}
      </div>
    </section>
  );
}
