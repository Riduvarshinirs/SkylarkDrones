import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleUserQuestion } from "@/services/agent/orchestrator";
import { fetchDealsBoard, fetchWorkOrdersBoard, getMondayConfig, MondayApiError, MondayConfigError } from "@/services/monday/client";
import { normalizeDeals, normalizeWorkOrders } from "@/services/data/normalize";

const requestSchema = z.object({
  question: z.string().min(1, "question is required").max(2000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    let config;
    try {
      config = getMondayConfig();
    } catch (error) {
      if (error instanceof MondayConfigError) {
        return NextResponse.json(
          {
            error: error.message,
            code: "MONDAY_NOT_CONFIGURED",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    const [dealsBoard, workOrdersBoard] = await Promise.all([
      fetchDealsBoard(config),
      fetchWorkOrdersBoard(config),
    ]);

    const normalizedDeals = normalizeDeals(
      dealsBoard.items.map((item) => ({
        itemId: item.id,
        dealName: item.name,
        ownerCode: item.column_values.find((value) => value.id === "owner")?.text ?? null,
        clientCode: item.column_values.find((value) => value.id === "client")?.text ?? null,
        dealStatus: item.column_values.find((value) => value.id === "status")?.text ?? null,
        actualCloseDate: item.column_values.find((value) => value.id === "actual_close_date")?.text ?? null,
        closureProbability: item.column_values.find((value) => value.id === "probability")?.text ?? null,
        dealValue: item.column_values.find((value) => value.id === "deal_value")?.text ?? null,
        tentativeCloseDate: item.column_values.find((value) => value.id === "tentative_close_date")?.text ?? null,
        dealStage: item.column_values.find((value) => value.id === "stage")?.text ?? null,
        productDeal: item.column_values.find((value) => value.id === "product")?.text ?? null,
        sector: item.column_values.find((value) => value.id === "sector")?.text ?? null,
        createdDate: item.column_values.find((value) => value.id === "created_date")?.text ?? null,
      })),
    );

    const normalizedWorkOrders = normalizeWorkOrders(
      workOrdersBoard.items.map((item) => ({
        itemId: item.id,
        dealNameMasked: item.name,
        customerNameCode: item.column_values.find((value) => value.id === "customer")?.text ?? null,
        serialNumber: item.column_values.find((value) => value.id === "serial_number")?.text ?? null,
        natureOfWork: item.column_values.find((value) => value.id === "nature_of_work")?.text ?? null,
        executionStatus: item.column_values.find((value) => value.id === "execution_status")?.text ?? null,
        dataDeliveryDate: item.column_values.find((value) => value.id === "data_delivery_date")?.text ?? null,
        poDate: item.column_values.find((value) => value.id === "po_date")?.text ?? null,
        documentType: item.column_values.find((value) => value.id === "document_type")?.text ?? null,
        probableStartDate: item.column_values.find((value) => value.id === "probable_start_date")?.text ?? null,
        probableEndDate: item.column_values.find((value) => value.id === "probable_end_date")?.text ?? null,
        ownerCode: item.column_values.find((value) => value.id === "owner")?.text ?? null,
        sector: item.column_values.find((value) => value.id === "sector")?.text ?? null,
        typeOfWork: item.column_values.find((value) => value.id === "type_of_work")?.text ?? null,
        amountExclGst: item.column_values.find((value) => value.id === "amount_excl_gst")?.text ?? null,
        amountInclGst: item.column_values.find((value) => value.id === "amount_incl_gst")?.text ?? null,
        billedValueExclGst: item.column_values.find((value) => value.id === "billed_excl_gst")?.text ?? null,
        billedValueInclGst: item.column_values.find((value) => value.id === "billed_incl_gst")?.text ?? null,
        collectedAmountInclGst: item.column_values.find((value) => value.id === "collected_incl_gst")?.text ?? null,
        amountReceivable: item.column_values.find((value) => value.id === "amount_receivable")?.text ?? null,
        invoiceStatus: item.column_values.find((value) => value.id === "invoice_status")?.text ?? null,
        woStatusBilled: item.column_values.find((value) => value.id === "wo_status_billed")?.text ?? null,
        billingStatus: item.column_values.find((value) => value.id === "billing_status")?.text ?? null,
      })),
    );

    const result = await handleUserQuestion(parsed.data.question, [], {
      deals: normalizedDeals.records,
      workOrders: normalizedWorkOrders.records,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = error instanceof MondayApiError ? "MONDAY_API_ERROR" : "AGENT_ERROR";
    return NextResponse.json(
      {
        error: message,
        code,
      },
      { status: error instanceof MondayApiError ? 502 : 500 },
    );
  }
}
