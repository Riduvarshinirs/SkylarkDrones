"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-[0_10px_35px_rgba(20,24,31,0.04)]">
        <div className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite-soft">
          System notice
        </div>
        <h2 className="mt-3 text-xl font-semibold text-ink">Unexpected app error</h2>
        <p className="mt-2 text-sm leading-6 text-graphite">
          The BI agent could not render this screen. Please retry with a fresh request.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-panel transition-colors hover:bg-signal"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
