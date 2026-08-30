const SUGGESTED_QUESTIONS = [
  "How is our pipeline looking?",
  "Which sector is strongest?",
  "What are our biggest opportunities?",
  "What work orders are at risk?",
  "Compare sales and operations",
  "Generate a leadership update",
];

export function SuggestedQuestions({
  onSelect,
  disabled,
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {SUGGESTED_QUESTIONS.map((question, i) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="group flex items-start gap-3 rounded-md border border-line bg-panel px-4 py-3.5 text-left transition-colors hover:border-signal/50 hover:bg-signal-tint/40 disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="mt-0.5 shrink-0 font-mono text-[0.7rem] text-graphite-soft group-hover:text-signal">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[0.9rem] leading-snug text-ink">
            {question}
          </span>
        </button>
      ))}
    </div>
  );
}

export { SUGGESTED_QUESTIONS };
