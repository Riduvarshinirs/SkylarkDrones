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
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[1.35rem] font-semibold tracking-tight text-ink">
            Groundtruth
          </h1>
          <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.14em] text-graphite-soft sm:inline">
            Skylark Drones · BI Agent
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-graphite">
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
            monday.com{" "}
            {status === null
              ? "checking"
              : status.mondayConfigured
                ? "connected"
                : "not configured"}
          </span>
        </div>
      </div>
    </header>
  );
}
