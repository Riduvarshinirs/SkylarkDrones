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
    <div className="border border-line bg-panel focus-within:border-signal/60">
      <div className="flex items-end gap-3 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Ask about pipeline, revenue, sectors, or operations…"
          className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-[0.9rem] text-ink placeholder:text-graphite-soft focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="shrink-0 bg-ink px-4 py-1.5 text-[0.8rem] font-medium text-panel transition-colors hover:bg-signal disabled:cursor-not-allowed disabled:bg-line disabled:text-graphite-soft"
        >
          Ask
        </button>
      </div>
      <div className="border-t border-line px-4 py-1.5 font-mono text-[0.65rem] text-graphite-soft">
        Enter to ask · Shift+Enter for a new line
      </div>
    </div>
  );
}
