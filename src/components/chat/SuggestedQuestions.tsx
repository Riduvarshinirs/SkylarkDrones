export const SUGGESTED_QUESTION_GROUPS = {
  SALES: [
    "How is our pipeline looking?",
    "What are our biggest opportunities?",
    "Which sector is strongest?",
  ],
  OPERATIONS: [
    "What work orders are at risk?",
    "How are operations performing?",
  ],
  EXECUTIVE: [
    "Compare sales and operations",
    "Generate a leadership update",
  ],
} as const;

export const SUGGESTED_QUESTIONS = [
  ...SUGGESTED_QUESTION_GROUPS.SALES,
  ...SUGGESTED_QUESTION_GROUPS.OPERATIONS,
  ...SUGGESTED_QUESTION_GROUPS.EXECUTIVE,
];

export function SuggestedQuestions({
  onSelect,
  disabled,
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
}) {
  const groups = [
    { label: "SALES", questions: SUGGESTED_QUESTION_GROUPS.SALES },
    { label: "OPERATIONS", questions: SUGGESTED_QUESTION_GROUPS.OPERATIONS },
    { label: "EXECUTIVE", questions: SUGGESTED_QUESTION_GROUPS.EXECUTIVE },
  ];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2.5">
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-graphite-soft">
            {group.label}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {group.questions.map((question, i) => (
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
        </div>
      ))}
    </div>
  );
}
