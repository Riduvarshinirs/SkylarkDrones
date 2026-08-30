"use client";

import { useRef, type KeyboardEvent } from "react";

export function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_10px_30px_rgba(20,24,31,0.04)] focus-within:border-signal/60">
      <div className="flex items-end gap-3 px-4 py-3 sm:px-5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Ask about pipeline, revenue, sectors, or operations…"
          className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent text-[0.92rem] text-ink placeholder:text-graphite-soft focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-[0.78rem] font-medium text-panel transition-colors hover:bg-signal disabled:cursor-not-allowed disabled:bg-line disabled:text-graphite-soft"
        >
          Ask
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-1.5 text-[0.62rem] font-mono uppercase tracking-[0.1em] text-graphite-soft">
        <span>Enter to ask</span>
        <span>Shift + Enter for new line</span>
      </div>
    </div>
  );
}
