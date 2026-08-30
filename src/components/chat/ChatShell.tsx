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
              ? { ...e, status: "complete", answer: data.answer }
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
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 sm:px-8">
        {isEmpty ? (
          <div className="fade-in flex flex-1 flex-col justify-center py-16">
            <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-graphite-soft">
              Executive analyst
            </p>
            <h2 className="mb-3 max-w-lg font-display text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink">
              What do you want to know?
            </h2>
            <p className="mb-8 max-w-lg text-[0.92rem] leading-relaxed text-graphite">
              Ask about pipeline, revenue, sector performance, or operational
              risk. Answers are calculated from live monday.com data, with
              coverage and caveats shown alongside every number.
            </p>
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

        <div className="sticky bottom-0 bg-paper pb-6 pt-2">
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={() => submitQuestion(input)}
            disabled={isBusy}
          />
        </div>
      </div>
    </div>
  );
}
