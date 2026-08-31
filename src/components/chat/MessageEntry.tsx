import { useState } from "react";
import { formatTime } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";

export interface EntryData {
  id: string;
  index: number;
  question: string;
  askedAt: string;
  status: "pending" | "complete" | "error" | "unconfigured";
  answer?: string;
  response?: {
    answer?: string;
    executive_headline?: string;
    recommended_action?: string;
    key_metrics?: Array<{ label: string; value: string; detail?: string }>;
    insights?: string[];
    executiveBrief?: {
      title: string;
      summary: string[];
      sales: {
        pipelineValue: string;
        activeOpportunities: number | null;
        closedWon: number | null;
        closedLost: number | null;
        largestOpportunity: string;
        strongestSector: string;
      };
      operations: {
        totalWorkOrders: number | null;
        completionRate: string;
        ongoingWorkOrders: number | null;
        atRiskWorkOrders: number | null;
      };
      risks: string[];
      recommendedActions: string[];
      caveats: string[];
    };
    leadership_update?: {
      business_snapshot: string;
      commercial_pipeline: string;
      revenue_signals: string;
      operational_position: string;
      positive_trends: string[];
      key_risks: string[];
      data_quality_caveats: string[];
      leadership_attention: string[];
    };
    analysis_details?: {
      dataSources?: string[];
      filters?: string[];
      recordsAnalyzed?: number;
      recordsExcluded?: number;
      reason?: string[];
    };
    data_quality?: Record<string, unknown>;
    sources_context?: string[];
    follow_up_suggestions?: string[];
    kpis?: Array<{ label: string; value: string; sublabel?: string }>;
    table?: { columns: string[]; rows: Array<Array<string | number>> };
    operations_intelligence?: {
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
          reasons?: string[];
          riskScore?: number;
          riskLevel?: string;
        }>;
      };
      executiveInsight?: string;
    };
    insight?: string;
  };
  errorMessage?: string;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderTable(table?: { columns: string[]; rows: Array<Array<string | number>> }) {
  if (!table || !table.columns?.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel-raised">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[0.78rem] text-ink">
          <thead className="bg-paper text-graphite">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="px-3 py-2.5 font-medium uppercase tracking-[0.08em]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`${row.join("-")}-${rowIndex}`} className="border-t border-line">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2.5 align-top text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MessageEntry({ entry }: { entry: EntryData }) {
  const [copied, setCopied] = useState(false);
  const response = entry.response;
  const quality = (response?.data_quality ?? {}) as Record<string, unknown>;
  const coverage = toNumber(quality.coveragePercent) ?? toNumber(quality.coverage) ?? 0;
  const recordsConsidered = toNumber(quality.recordsConsidered) ?? 0;
  const recordsExcluded = toNumber(quality.recordsExcluded) ?? 0;
  const caveats = Array.isArray(quality.caveats) ? (quality.caveats as string[]) : [];
  const analysisDetails = response?.analysis_details ?? undefined;
  const insights = response?.insights ?? [];
  const executiveBrief = response?.executiveBrief;
  const leadershipUpdate = response?.leadership_update;
  const operationsIntelligence = response?.operations_intelligence;
  const followUpSuggestions = response?.follow_up_suggestions ?? [];

  const copyReport = async () => {
    if (!executiveBrief) return;

    const text = [
      executiveBrief.title,
      "",
      "1. Executive Summary",
      ...executiveBrief.summary.map((item) => `- ${item}`),
      "",
      "2. Sales",
      `- Pipeline value: ${executiveBrief.sales.pipelineValue}`,
      `- Active opportunities: ${executiveBrief.sales.activeOpportunities ?? "Unavailable"}`,
      `- Closed won: ${executiveBrief.sales.closedWon ?? "Unavailable"}`,
      `- Closed lost: ${executiveBrief.sales.closedLost ?? "Unavailable"}`,
      `- Largest opportunity: ${executiveBrief.sales.largestOpportunity}`,
      `- Strongest sector: ${executiveBrief.sales.strongestSector}`,
      "",
      "3. Operations",
      `- Total work orders: ${executiveBrief.operations.totalWorkOrders ?? "Unavailable"}`,
      `- Completion rate: ${executiveBrief.operations.completionRate}`,
      `- Ongoing work: ${executiveBrief.operations.ongoingWorkOrders ?? "Unavailable"}`,
      `- At-risk work orders: ${executiveBrief.operations.atRiskWorkOrders ?? "Unavailable"}`,
      "",
      "4. Risks",
      ...executiveBrief.risks.map((item) => `- ${item}`),
      "",
      "5. Recommended Actions",
      ...executiveBrief.recommendedActions.map((item) => `- ${item}`),
      "",
      "Caveats",
      ...executiveBrief.caveats.map((item) => `- ${item}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const metrics = (response?.key_metrics ?? response?.kpis ?? []).map((metric) => {
    const detail =
      "detail" in metric && typeof metric.detail === "string"
        ? metric.detail
        : "sublabel" in metric && typeof metric.sublabel === "string"
          ? metric.sublabel
          : undefined;

    return {
      label: metric.label,
      value: metric.value,
      detail,
    };
  });

  return (
    <article className="rise-in overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_8px_24px_rgba(20,24,31,0.04)]">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-panel-raised px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
            Q{String(entry.index).padStart(2, "0")}
          </span>
          <h3 className="text-[0.92rem] font-medium text-ink sm:text-[0.98rem]">
            {entry.question}
          </h3>
        </div>
        <time className="shrink-0 font-mono text-[0.66rem] text-graphite-soft">
          {formatTime(entry.askedAt)}
        </time>
      </header>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {entry.status === "pending" && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-raised px-3 py-3">
            <StatusDot tone="signal" pulse />
            <div>
              <div className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-graphite-soft">
                Analyst is working
              </div>
              <div className="mt-1 text-[0.9rem] text-ink">
                Reading the relevant data and calculating the answer…
              </div>
            </div>
          </div>
        )}

        {entry.status === "unconfigured" && (
          <div className="flex items-start gap-3 rounded-xl border border-line bg-panel-raised px-4 py-3 text-[0.85rem] text-graphite">
            <StatusDot tone="risk" className="mt-1.5" />
            <div>
              <div className="mb-1 font-medium text-ink">Configuration required</div>
              <p>{entry.errorMessage}</p>
            </div>
          </div>
        )}

        {entry.status === "error" && (
          <div className="flex items-start gap-3 rounded-xl border border-risk/30 bg-risk-tint px-4 py-3 text-[0.85rem] text-risk">
            <StatusDot tone="risk" className="mt-1.5" />
            <div>
              <div className="mb-1 font-medium">Unable to complete this analysis</div>
              <p>{entry.errorMessage}</p>
            </div>
          </div>
        )}

        {entry.status === "complete" && (
          <div className="space-y-5">
            <section className="rounded-xl border border-line bg-panel-raised p-4 sm:p-5">
              <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                Executive headline
              </div>
              <p className="whitespace-pre-line text-[0.95rem] leading-7 text-ink">
                {response?.answer ?? entry.answer ?? "No answer available."}
              </p>
            </section>

            {metrics.length > 0 && (
              <section className="space-y-3">
                <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Key metrics
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map((metric) => (
                    <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-line bg-panel-raised p-3.5">
                      <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                        {metric.label}
                      </div>
                      <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-ink">
                        {metric.value}
                      </div>
                      {metric.detail && (
                        <div className="mt-1 text-[0.75rem] text-graphite">{metric.detail}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {insights.length > 0 && (
              <section className="rounded-xl border border-line bg-panel-raised p-4">
                <div className="mb-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Key insights
                </div>
                <ul className="space-y-2 text-[0.92rem] leading-6 text-ink">
                  {insights.map((insight) => (
                    <li key={insight} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {response?.recommended_action && (
              <section className="rounded-xl border border-signal/30 bg-signal-tint p-4">
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-signal">
                  Recommended action
                </div>
                <p className="text-[0.92rem] leading-6 text-ink">{response.recommended_action}</p>
              </section>
            )}

            {executiveBrief && (
              <section className="rounded-2xl border border-signal/40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_48%)] p-4 shadow-[0_12px_32px_rgba(14,30,56,0.06)] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-graphite-soft">
                      {executiveBrief.title}
                    </div>
                    <div className="mt-1 text-[1.4rem] font-semibold tracking-tight text-ink">Executive briefing</div>
                  </div>
                  <button
                    type="button"
                    onClick={copyReport}
                    className="rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink transition-colors hover:border-signal hover:text-signal"
                  >
                    {copied ? "Copied" : "Copy report"}
                  </button>
                </div>

                <div className="space-y-5 text-[0.92rem] leading-6 text-ink">
                  <div className="rounded-xl border border-line bg-panel-raised p-4">
                    <div className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">1. Executive Summary</div>
                    <div className="space-y-2">
                      {executiveBrief.summary.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-line bg-panel-raised p-4">
                      <div className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">2. Sales</div>
                      <ul className="space-y-2">
                        <li><span className="font-medium">Pipeline value:</span> {executiveBrief.sales.pipelineValue}</li>
                        <li><span className="font-medium">Active opportunities:</span> {executiveBrief.sales.activeOpportunities ?? "Unavailable"}</li>
                        <li><span className="font-medium">Closed won / lost:</span> {executiveBrief.sales.closedWon ?? "Unavailable"} / {executiveBrief.sales.closedLost ?? "Unavailable"}</li>
                        <li><span className="font-medium">Largest opportunity:</span> {executiveBrief.sales.largestOpportunity}</li>
                        <li><span className="font-medium">Strongest sector:</span> {executiveBrief.sales.strongestSector}</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-line bg-panel-raised p-4">
                      <div className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">3. Operations</div>
                      <ul className="space-y-2">
                        <li><span className="font-medium">Total work orders:</span> {executiveBrief.operations.totalWorkOrders ?? "Unavailable"}</li>
                        <li><span className="font-medium">Completion rate:</span> {executiveBrief.operations.completionRate}</li>
                        <li><span className="font-medium">Ongoing work:</span> {executiveBrief.operations.ongoingWorkOrders ?? "Unavailable"}</li>
                        <li><span className="font-medium">At-risk work orders:</span> {executiveBrief.operations.atRiskWorkOrders ?? "Unavailable"}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-panel-raised p-4">
                    <div className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">4. Risks</div>
                    <ul className="list-disc space-y-2 pl-5">
                      {executiveBrief.risks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-line bg-panel-raised p-4">
                    <div className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">5. Recommended Actions</div>
                    <ul className="list-disc space-y-2 pl-5">
                      {executiveBrief.recommendedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>

                  {executiveBrief.caveats.length > 0 && (
                    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-[0.85rem]">
                      <div className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-graphite-soft">Data caveats</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {executiveBrief.caveats.map((caveat) => (
                          <li key={caveat}>{caveat}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {leadershipUpdate && !executiveBrief && (
              <section className="rounded-xl border border-line bg-panel-raised p-4">
                <div className="mb-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Leadership update
                </div>
                <div className="space-y-4 text-[0.9rem] leading-6 text-ink">
                  <div>
                    <div className="mb-1 font-medium text-ink">Business snapshot</div>
                    <p>{leadershipUpdate.business_snapshot}</p>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-ink">Commercial / pipeline position</div>
                    <p>{leadershipUpdate.commercial_pipeline}</p>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-ink">Revenue signals</div>
                    <p>{leadershipUpdate.revenue_signals}</p>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-ink">Operational position</div>
                    <p>{leadershipUpdate.operational_position}</p>
                  </div>
                  {leadershipUpdate.positive_trends.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-ink">Positive trends</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {leadershipUpdate.positive_trends.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {leadershipUpdate.key_risks.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-ink">Key risks</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {leadershipUpdate.key_risks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {leadershipUpdate.data_quality_caveats.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-ink">Data-quality caveats</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {leadershipUpdate.data_quality_caveats.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {leadershipUpdate.leadership_attention.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-ink">Leadership attention</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {leadershipUpdate.leadership_attention.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {operationsIntelligence && (
              <section className="rounded-xl border border-line bg-panel-raised p-4">
                <div className="mb-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Operations intelligence
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Completed</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{operationsIntelligence.statusOverview?.completed ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Ongoing</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{operationsIntelligence.statusOverview?.ongoing ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Not started</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{operationsIntelligence.statusOverview?.notStarted ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Completion rate</div>
                    <div className="mt-1 text-lg font-semibold text-ink">{operationsIntelligence.completionRate !== null && operationsIntelligence.completionRate !== undefined ? `${operationsIntelligence.completionRate.toFixed(1)}%` : "N/A"}</div>
                  </div>
                </div>

                {operationsIntelligence.statusOverview?.otherStatuses && operationsIntelligence.statusOverview.otherStatuses.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 font-medium text-ink">Other actual statuses</div>
                    <div className="flex flex-wrap gap-2">
                      {operationsIntelligence.statusOverview.otherStatuses.map((status) => (
                        <span key={status.status} className="rounded-full border border-line bg-panel px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite">
                          {status.status}: {status.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {operationsIntelligence.executiveInsight && (
                  <div className="mb-4 rounded-lg border border-line bg-panel p-3 text-[0.83rem] text-ink">
                    {operationsIntelligence.executiveInsight}
                  </div>
                )}

                {operationsIntelligence.atRiskWorkOrders && operationsIntelligence.atRiskWorkOrders.items && operationsIntelligence.atRiskWorkOrders.items.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-ink">At-risk work orders</div>
                      <div className="flex flex-wrap gap-2 text-[0.62rem] font-mono uppercase tracking-[0.08em] text-graphite-soft">
                        <span className="rounded-full border border-line bg-panel px-2 py-1">High: {operationsIntelligence.atRiskWorkOrders.high ?? 0}</span>
                        <span className="rounded-full border border-line bg-panel px-2 py-1">Medium: {operationsIntelligence.atRiskWorkOrders.medium ?? 0}</span>
                        <span className="rounded-full border border-line bg-panel px-2 py-1">Low: {operationsIntelligence.atRiskWorkOrders.low ?? 0}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {operationsIntelligence.atRiskWorkOrders.items.map((item) => (
                        <div key={`${item.workOrderName ?? "work-order"}-${item.relevantDate ?? item.status ?? "risk"}`} className="rounded-lg border border-line bg-panel p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-ink">{item.workOrderName ?? "Unnamed work order"}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-graphite-soft">Score {item.riskScore ?? 0}</span>
                              <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] ${item.riskLevel === "High" ? "border-risk/40 bg-risk-tint text-risk" : item.riskLevel === "Medium" ? "border-signal/40 bg-signal/10 text-signal" : "border-graphite/30 bg-panel text-graphite"}`}>
                                {item.riskLevel}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-[0.75rem] text-graphite sm:grid-cols-2">
                            <div><span className="font-medium text-ink">Status:</span> {item.status ?? "Unknown"}</div>
                            <div><span className="font-medium text-ink">Priority:</span> {item.priority ?? "Not specified"}</div>
                            <div><span className="font-medium text-ink">Relevant date:</span> {item.relevantDate ?? "Not available"}</div>
                            <div><span className="font-medium text-ink">Primary reason:</span> {item.reason}</div>
                          </div>
                          {(item.reasons?.length ?? 0) > 0 && (
                            <div className="mt-2 rounded-md border border-line bg-panel-raised p-2 text-[0.72rem] text-graphite">
                              <div className="mb-1 font-medium text-ink">Why this matters</div>
                              <ul className="list-disc space-y-1 pl-4">
                                {item.reasons?.map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {response?.table && (
              <section className="space-y-3">
                <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Pipeline breakdown
                </div>
                {renderTable(response.table)}
              </section>
            )}

            {(coverage > 0 || recordsConsidered > 0 || recordsExcluded > 0 || caveats.length > 0) && (
              <section className="rounded-xl border border-line bg-panel-raised p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                    Data quality
                  </div>
                  <div className="font-mono text-[0.68rem] text-graphite">
                    {coverage.toFixed(0)}%
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-panel p-3">
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-graphite-soft">Considered</div>
                    <div className="mt-1 text-base font-semibold text-ink">{recordsConsidered}</div>
                  </div>
                  <div className="rounded-lg border border-line bg-panel p-3">
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-graphite-soft">Excluded</div>
                    <div className="mt-1 text-base font-semibold text-ink">{recordsExcluded}</div>
                  </div>
                  <div className="rounded-lg border border-line bg-panel p-3">
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-graphite-soft">Coverage</div>
                    <div className="mt-1 text-base font-semibold text-ink">{coverage.toFixed(0)}%</div>
                  </div>
                </div>
                {caveats.length > 0 && (
                  <ul className="mt-3 space-y-2 text-[0.8rem] leading-6 text-graphite">
                    {caveats.map((caveat) => (
                      <li key={caveat} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-graphite-soft" aria-hidden="true" />
                        <span>{caveat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {analysisDetails && (
              <details className="rounded-xl border border-line bg-panel-raised p-4">
                <summary className="cursor-pointer list-none font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Analysis details
                </summary>
                <div className="mt-4 space-y-4 text-[0.82rem] text-graphite">
                  <div>
                    <div className="mb-1 font-medium text-ink">Data sources</div>
                    <div className="flex flex-wrap gap-2">
                      {(analysisDetails.dataSources ?? []).map((source) => (
                        <span key={source} className="rounded-full border border-line bg-panel px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite">{source}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-ink">Filters</div>
                    <div>{(analysisDetails.filters ?? []).join(", ") || "No filters"}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-panel p-3">
                      <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Records analyzed</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{analysisDetails.recordsAnalyzed ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-panel p-3">
                      <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite-soft">Records excluded</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{analysisDetails.recordsExcluded ?? 0}</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-ink">Reason</div>
                    <ul className="list-disc space-y-1 pl-5">
                      {(analysisDetails.reason ?? []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            )}

            {(response?.sources_context?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-line bg-panel-raised p-4">
                <div className="mb-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
                  Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {response?.sources_context?.map((source) => (
                    <span key={source} className="rounded-full border border-line bg-panel px-2.5 py-1.5 font-mono text-[0.66rem] text-graphite">
                      {source}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
