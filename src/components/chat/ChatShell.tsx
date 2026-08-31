"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageEntry, type EntryData } from "@/components/chat/MessageEntry";
import { MessageInput } from "@/components/chat/MessageInput";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { generateId } from "@/lib/utils";

interface ChatApiErrorBody {
  error: string;
  code?: string;
}

interface ExecutiveKpiSnapshot {
  totalPipeline: number | null;
  openDeals: number | null;
  winRate: number | null;
  atRiskWorkOrders: number | null;
  highRiskWorkOrders?: number | null;
  mediumRiskWorkOrders?: number | null;
  closedWon: number | null;
  completionRate: number | null;
  generatedAt: string;
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${Number(value).toFixed(1)}%`;
}

function formatInteger(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

export function ChatShell() {
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [kpis, setKpis] = useState<ExecutiveKpiSnapshot | null>(null);
  const [isKpisLoading, setIsKpisLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const refreshKpis = useCallback(async () => {
    setIsKpisLoading(true);
    setKpiError(null);

    try {
      const res = await fetch("/api/exec-kpis", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = typeof data?.error === "string" ? data.error : "Unable to load KPI data.";
        setKpis(null);
        setKpiError(message);
        return;
      }

      const data = (await res.json()) as { kpis?: ExecutiveKpiSnapshot | null };
      setKpis(data.kpis ?? null);
    } catch {
      setKpis(null);
      setKpiError("Could not load KPI data right now.");
    } finally {
      setIsKpisLoading(false);
    }
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    let cancelled = false;

    const loadKpis = async () => {
      if (cancelled) return;
      await refreshKpis();
    };

    void loadKpis();

    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        void refreshKpis();
      }
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshKpis]);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isBusy) return;

    const id = generateId("entry");
    const askedAt = new Date().toISOString();
    const index = entries.length + 1;

    setEntries((prev) => [
      ...prev,
      { id, index, question: trimmed, askedAt, status: "pending" },
    ]);
    setInput("");
    setIsBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (res.ok) {
        const data = await res.json();
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: "complete",
                  answer: data.answer,
                  response: data,
                }
              : e,
          ),
        );
      } else {
        const data: ChatApiErrorBody = await res
          .json()
          .catch(() => ({ error: "Something went wrong. Please try again." }));
        const status =
          data.code === "MONDAY_NOT_CONFIGURED" ? "unconfigured" : "error";
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status, errorMessage: data.error }
              : e,
          ),
        );
      }
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status: "error",
                errorMessage:
                  "Could not reach the server. Check your connection and try again.",
              }
            : e,
        ),
      );
    } finally {
      setIsBusy(false);
    }
  }

  const isEmpty = entries.length === 0;

  const kpiCards = [
    { label: "TOTAL PIPELINE", value: formatCurrency(kpis?.totalPipeline ?? null), sublabel: "Total active pipeline value" },
    { label: "OPEN DEALS", value: formatInteger(kpis?.openDeals ?? null), sublabel: "Active opportunities" },
    { label: "WIN RATE", value: formatPercentage(kpis?.winRate ?? null), sublabel: "Closed won / lost" },
    { label: "AT-RISK WORK ORDERS", value: formatInteger(kpis?.atRiskWorkOrders ?? null), sublabel: `High ${formatInteger(kpis?.highRiskWorkOrders ?? 0)} / Medium ${formatInteger(kpis?.mediumRiskWorkOrders ?? 0)}` },
    { label: "HIGH-RISK WORK ORDERS", value: formatInteger(kpis?.highRiskWorkOrders ?? null), sublabel: "Immediate attention" },
    { label: "MEDIUM-RISK WORK ORDERS", value: formatInteger(kpis?.mediumRiskWorkOrders ?? null), sublabel: "Monitor closely" },
    { label: "CLOSED WON", value: formatInteger(kpis?.closedWon ?? null), sublabel: "Closed deals" },
    { label: "COMPLETION RATE", value: formatPercentage(kpis?.completionRate ?? null), sublabel: "Operational completion" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="executive-kpi-heading" aria-live="polite" className="pt-6 sm:pt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-graphite-soft">
              Executive KPI snapshot
            </p>
            {kpis && !kpiError ? (
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-graphite-soft">
                Updated {new Date(kpis.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : null}
          </div>

          {kpiError ? (
            <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-graphite">
              {kpiError}
            </div>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kpiCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-line bg-panel px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-graphite-soft">
                    {card.label}
                  </dt>
                  <dd className="mt-3 font-display text-[1.6rem] font-semibold tracking-tight text-ink sm:text-[1.8rem]">
                    {isKpisLoading ? (
                      <span className="inline-block h-7 w-24 animate-pulse rounded-md bg-line/60" aria-label="Loading KPI value" />
                    ) : (
                      card.value
                    )}
                  </dd>
                  <p className="mt-2 text-[0.72rem] text-graphite-soft">{card.sublabel}</p>
                </div>
              ))}
            </dl>
          )}
        </section>

        {isEmpty ? (
          <div className="fade-in flex flex-1 flex-col justify-center py-10 sm:py-14 lg:py-18">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-locked" aria-hidden="true" />
              Executive analyst
            </div>
            <h2 className="mb-3 max-w-2xl font-display text-[2rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[2.5rem]">
              Ask the business, not the spreadsheet.
            </h2>
            <p className="mb-8 max-w-2xl text-[0.96rem] leading-relaxed text-graphite sm:text-[1rem]">
              Track pipeline, revenue, sector performance, operational execution, and risk with a concise executive view grounded in live monday.com data and deterministic analytics.
            </p>

            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitQuestion("Generate a leadership update")}
                disabled={isBusy}
                className="rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-panel transition-colors hover:bg-signal disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generate leadership update
              </button>
            </div>

            <SuggestedQuestions onSelect={submitQuestion} disabled={isBusy} />
          </div>
        ) : (
          <div className="flex-1 space-y-3 py-6">
            {entries.map((entry) => (
              <MessageEntry key={entry.id} entry={entry} />
            ))}
            <div ref={scrollAnchorRef} />
          </div>
        )}

        <div className="sticky bottom-0 border-t border-line bg-paper/90 pb-6 pt-3 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl">
            <MessageInput
              value={input}
              onChange={setInput}
              onSubmit={() => submitQuestion(input)}
              disabled={isBusy}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
