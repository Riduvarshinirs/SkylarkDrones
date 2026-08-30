import { cn } from "@/lib/utils";

type StatusTone = "locked" | "risk" | "graphite" | "signal";

const toneClasses: Record<StatusTone, string> = {
  locked: "bg-locked",
  risk: "bg-risk",
  graphite: "bg-graphite-soft",
  signal: "bg-signal",
};

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        toneClasses[tone],
        pulse && "pulse-dot",
        className,
      )}
      aria-hidden="true"
    />
  );
}
