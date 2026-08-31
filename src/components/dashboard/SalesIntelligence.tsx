import { getPipelineSummary } from "@/services/analytics";
import { normalizeDeals } from "@/services/data/normalize";
import { fetchDealsBoard, getMondayConfig } from "@/services/monday/client";

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

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

async function getSalesPipelineSummary() {
  try {
    const config = getMondayConfig();
    const dealsBoard = await fetchDealsBoard(config);

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

    return getPipelineSummary(normalizedDeals.records, {
      rawQuestion: "Sales intelligence dashboard",
      type: "pipeline_analysis",
      timePeriod: { label: "this_year" },
    });
  } catch {
    return null;
  }
}

export async function SalesIntelligence() {
  const pipelineResult = await getSalesPipelineSummary();

  if (!pipelineResult) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8" aria-live="polite">
        <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-ink">Sales intelligence</h3>
          <p className="mt-2 text-sm text-graphite">Data unavailable. Configure the monday.com boards to populate pipeline and sector analytics.</p>
        </div>
      </section>
    );
  }

  const pipelineData = pipelineResult.data as {
    totalPipelineValue?: number | null;
    activePipelineValue?: number | null;
    closedWonValue?: number | null;
    closedLostValue?: number | null;
    numberOfDeals?: number | null;
    byStage?: Record<string, number>;
    bySector?: Record<string, number>;
    largestOpportunities?: Array<{
      dealName?: string | null;
      customer?: string | null;
      value?: number | null;
      stage?: string | null;
      status?: string | null;
      priority?: string | null;
    }>;
  };

  const stageEntries = Object.entries(pipelineData.byStage ?? {}).filter(([, value]) => Number(value) > 0);
  const sectorEntries = Object.entries(pipelineData.bySector ?? {}).filter(([, value]) => Number(value) > 0);
  const maxStageValue = stageEntries.length > 0 ? Math.max(...stageEntries.map(([, value]) => Number(value))) : 0;
  const maxSectorValue = sectorEntries.length > 0 ? Math.max(...sectorEntries.map(([, value]) => Number(value))) : 0;
  const opportunities = (pipelineData.largestOpportunities ?? []).slice(0, 5);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8" aria-label="Sales intelligence">
      <div className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.66rem] font-medium uppercase tracking-[0.12em] text-graphite-soft">Sales intelligence</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">Executive pipeline snapshot</h3>
          </div>
          <div className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-graphite">
            {pipelineData.numberOfDeals ?? 0} deals in scope
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Active pipeline</p>
            <p className="mt-2 text-xl font-semibold text-ink">{formatMoney(pipelineData.activePipelineValue ?? pipelineData.totalPipelineValue ?? null)}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Closed won</p>
            <p className="mt-2 text-xl font-semibold text-ink">{formatMoney(pipelineData.closedWonValue ?? null)}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.1em] text-graphite-soft">Closed lost</p>
            <p className="mt-2 text-xl font-semibold text-ink">{formatMoney(pipelineData.closedLostValue ?? null)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-paper p-3">
            <h4 className="mb-3 text-sm font-semibold text-ink">Pipeline by deal stage</h4>
            {stageEntries.length > 0 ? (
              <ul className="space-y-3" aria-label="Pipeline by deal stage">
                {stageEntries.map(([stage, value]) => {
                  const width = maxStageValue > 0 ? (Number(value) / maxStageValue) * 100 : 0;
                  return (
                    <li key={stage}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-graphite">
                        <span>{stage}</span>
                        <span>{formatCompactMoney(Number(value))}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${stage}: ${formatMoney(Number(value))}`}>
                        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-graphite">Data unavailable</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-paper p-3">
            <h4 className="mb-3 text-sm font-semibold text-ink">Pipeline by sector / service</h4>
            {sectorEntries.length > 0 ? (
              <ul className="space-y-3" aria-label="Pipeline by sector or service">
                {sectorEntries.map(([sector, value]) => {
                  const width = maxSectorValue > 0 ? (Number(value) / maxSectorValue) * 100 : 0;
                  return (
                    <li key={sector}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-graphite">
                        <span>{sector}</span>
                        <span>{formatCompactMoney(Number(value))}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${sector}: ${formatMoney(Number(value))}`}>
                        <div className="h-full rounded-full bg-signal transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-graphite">Data unavailable</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-paper p-3">
            <h4 className="mb-3 text-sm font-semibold text-ink">Top opportunities</h4>
            {opportunities.length > 0 ? (
              <ul className="space-y-3" aria-label="Top active opportunities">
                {opportunities.map((opportunity, index) => (
                  <li key={`${opportunity.dealName ?? "opportunity"}-${index}`} className="rounded-lg border border-line bg-paper px-2 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-graphite">
                      <span className="font-medium text-ink">{opportunity.dealName ?? "Unnamed opportunity"}</span>
                      <span>{formatCompactMoney(opportunity.value ?? null)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-graphite-soft">
                      <span>{opportunity.stage ?? "Stage unavailable"}</span>
                      <span>{opportunity.priority ?? "Priority unavailable"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite">Data unavailable</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
