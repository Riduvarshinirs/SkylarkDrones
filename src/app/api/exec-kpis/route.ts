import { NextResponse } from "next/server";
import { getMondayConfig, fetchDealsBoard, fetchWorkOrdersBoard, MondayApiError, MondayConfigError } from "@/services/monday/client";
import { normalizeDeals, normalizeWorkOrders } from "@/services/data/normalize";
import { getExecutiveKpis } from "@/services/analytics";

function normalizeBoardColumnKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function findColumnValue(item: { column_values?: Array<{ id?: string; text?: string | null; value?: string | null; type?: string }> }, aliases: string[]): { id?: string; text?: string | null; value?: string | null; type?: string } | null {
  if (!item.column_values) {
    return null;
  }

  const aliasKeys = aliases.map(normalizeBoardColumnKey);
  for (const column of item.column_values) {
    const idKey = normalizeBoardColumnKey(column.id);
    const textKey = normalizeBoardColumnKey(column.text ?? "");
    const valueKey = normalizeBoardColumnKey(column.value ?? "");

    const matches = aliasKeys.some((alias) => idKey === alias || textKey.includes(alias) || valueKey.includes(alias) || idKey.includes(alias));
    if (matches) {
      return column;
    }
  }

  return null;
}

export async function GET() {
  try {
    const config = getMondayConfig();
    const [dealsBoard, workOrdersBoard] = await Promise.all([
      fetchDealsBoard(config),
      fetchWorkOrdersBoard(config),
    ]);

    const normalizedDeals = normalizeDeals(
      dealsBoard.items.map((item) => {
        const ownerValue = findColumnValue(item, ["owner", "ownercode", "owner_code"]);
        const clientValue = findColumnValue(item, ["client", "customer", "clientcode", "customer_code"]);
        const statusValue = findColumnValue(item, ["status", "dealstatus", "deal_status", "state"]);
        const actualCloseDateValue = findColumnValue(item, ["actual_close_date", "actualclosedate", "close_date", "closedate"]);
        const probabilityValue = findColumnValue(item, ["probability", "winprobability", "closeprobability"]);
        const dealValueColumn = findColumnValue(item, ["deal_value", "dealvalue", "deal size", "deal_size", "value", "amount"]);
        const tentativeCloseDateValue = findColumnValue(item, ["tentative_close_date", "tentativeclosedate", "expected_close_date", "target_close_date"]);
        const dealStageValue = findColumnValue(item, ["stage", "dealstage", "deal_stage", "salesstage"]);
        const productValue = findColumnValue(item, ["product", "product_deal", "productdeal", "service"]);
        const sectorValue = findColumnValue(item, ["sector", "sectorservice", "sector_service", "industry"]);
        const createdDateValue = findColumnValue(item, ["created_date", "createddate", "datecreated"]);

        return {
          itemId: item.id,
          dealName: item.name,
          ownerCode: ownerValue?.text ?? null,
          clientCode: clientValue?.text ?? null,
          dealStatus: statusValue?.text ?? null,
          actualCloseDate: actualCloseDateValue?.text ?? null,
          closureProbability: probabilityValue?.text ?? null,
          dealValue: dealValueColumn?.text ?? null,
          tentativeCloseDate: tentativeCloseDateValue?.text ?? null,
          dealStage: dealStageValue?.text ?? null,
          productDeal: productValue?.text ?? null,
          sector: sectorValue?.text ?? null,
          createdDate: createdDateValue?.text ?? null,
        };
      }),
    );

    const normalizedWorkOrders = normalizeWorkOrders(
      workOrdersBoard.items.map((item) => {
        const customerValue = findColumnValue(item, ["customer", "customer_code", "customernamecode", "account"]);
        const serialValue = findColumnValue(item, ["serial_number", "serialnumber", "serial_no"]);
        const natureOfWorkValue = findColumnValue(item, ["nature_of_work", "natureofwork", "work_nature"]);
        const executionStatusValue = findColumnValue(item, ["execution_status", "executionstatus", "status", "wo_status"]);
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

    const kpis = getExecutiveKpis(normalizedDeals.records, normalizedWorkOrders.records);

    return NextResponse.json({ kpis });
  } catch (error) {
    if (error instanceof MondayConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof MondayApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ error: "Unable to load KPI data." }, { status: 500 });
  }
}
