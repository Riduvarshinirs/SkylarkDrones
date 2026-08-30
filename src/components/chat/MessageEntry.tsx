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
    key_metrics?: Array<{ label: string; value: string; detail?: string }>;
    insights?: string[];
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
    kpis?: Array<{ label: string; value: string; sublabel?: string }>;
    table?: { columns: string[]; rows: Array<Array<string | number>> };
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
  const response = entry.response;
  const quality = (response?.data_quality ?? {}) as Record<string, unknown>;
  const coverage = toNumber(quality.coveragePercent) ?? toNumber(quality.coverage) ?? 0;
  const recordsConsidered = toNumber(quality.recordsConsidered) ?? 0;
  const recordsExcluded = toNumber(quality.recordsExcluded) ?? 0;
  const caveats = Array.isArray(quality.caveats) ? (quality.caveats as string[]) : [];
  const analysisDetails = response?.analysis_details ?? undefined;
  const insights = response?.insights ?? [];
  const leadershipUpdate = response?.leadership_update;
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
                Executive answer
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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

            {leadershipUpdate && (
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

            {response?.table && renderTable(response.table)}

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
