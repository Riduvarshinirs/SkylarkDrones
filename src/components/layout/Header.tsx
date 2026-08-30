"use client";

import { useEffect, useState } from "react";
import { StatusDot } from "@/components/ui/StatusDot";
import { ContourLines } from "@/components/layout/ContourLines";

interface ConfigStatus {
  mondayConfigured: boolean;
  agentImplemented: boolean;
}

export function Header() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config-status")
      .then((res) => res.json())
      .then((data: ConfigStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ mondayConfigured: false, agentImplemented: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="relative border-b border-line bg-panel">
      <ContourLines className="pointer-events-none absolute inset-0 h-full w-full text-ink/[0.035]" />
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-raised font-display text-[1rem] font-semibold text-ink">
            G
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[1.2rem] font-semibold tracking-tight text-ink sm:text-[1.35rem]">
              Groundtruth
            </h1>
            <div className="hidden font-mono text-[0.62rem] uppercase tracking-[0.12em] text-graphite-soft sm:block">
              Executive BI • Skylark Drones
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-line bg-panel-raised px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite sm:flex">
            <StatusDot
              tone={
                status === null
                  ? "graphite"
                  : status.agentImplemented
                    ? "locked"
                    : "signal"
              }
              pulse={status === null}
            />
            <span>{status === null ? "checking" : status.agentImplemented ? "Agent ready" : "Agent setup"}</span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-line bg-panel-raised px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-graphite">
            <StatusDot
              tone={
                status === null
                  ? "graphite"
                  : status.mondayConfigured
                    ? "locked"
                    : "risk"
              }
              pulse={status === null}
            />
            <span>
              {status === null
                ? "checking"
                : status.mondayConfigured
                  ? "monday connected"
                  : "monday unavailable"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
