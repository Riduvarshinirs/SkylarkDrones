"use client";

import { useEffect, useRef, useState } from "react";
import { MessageEntry, type EntryData } from "@/components/chat/MessageEntry";
import { MessageInput } from "@/components/chat/MessageInput";
import { SuggestedQuestions } from "@/components/chat/SuggestedQuestions";
import { generateId } from "@/lib/utils";

interface ChatApiErrorBody {
  error: string;
  code?: string;
}

export function ChatShell() {
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
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
