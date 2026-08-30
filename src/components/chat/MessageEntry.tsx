import { formatTime } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";

export interface EntryData {
  id: string;
  index: number;
  question: string;
  askedAt: string;
  status: "pending" | "complete" | "error" | "unconfigured";
  answer?: string;
  errorMessage?: string;
}

export function MessageEntry({ entry }: { entry: EntryData }) {
  return (
    <article className="rise-in border border-line bg-panel">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[0.7rem] text-graphite-soft">
            Q{String(entry.index).padStart(2, "0")}
          </span>
          <h3 className="text-[0.95rem] font-medium text-ink">
            {entry.question}
          </h3>
        </div>
        <time className="shrink-0 font-mono text-[0.68rem] text-graphite-soft">
          {formatTime(entry.askedAt)}
        </time>
      </header>

      <div className="px-5 py-4">
        {entry.status === "pending" && (
          <div className="flex items-center gap-2 font-mono text-[0.78rem] text-graphite">
            <StatusDot tone="signal" pulse />
            <span>Reading monday.com boards…</span>
          </div>
        )}

        {entry.status === "unconfigured" && (
          <div className="flex items-start gap-2.5 border border-line bg-panel-raised px-4 py-3 text-[0.85rem] text-graphite">
            <StatusDot tone="risk" className="mt-1.5" />
            <p>{entry.errorMessage}</p>
          </div>
        )}

        {entry.status === "error" && (
          <div className="flex items-start gap-2.5 border border-risk/30 bg-risk-tint px-4 py-3 text-[0.85rem] text-risk">
            <StatusDot tone="risk" className="mt-1.5" />
            <p>{entry.errorMessage}</p>
          </div>
        )}

        {entry.status === "complete" && (
          <p className="text-[0.9rem] leading-relaxed text-ink">
            {entry.answer}
          </p>
        )}
      </div>
    </article>
  );
}
