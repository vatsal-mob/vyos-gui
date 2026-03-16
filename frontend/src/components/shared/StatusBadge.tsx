import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "up" | "down" | "unknown" | string;
  className?: string;
}

const styles: Record<string, { dot: string; text: string }> = {
  up:      { dot: "bg-success",          text: "text-success" },
  down:    { dot: "bg-destructive",      text: "text-destructive" },
  unknown: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = styles[status] ?? styles.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-2xs font-mono font-medium",
        s.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
      {status}
    </span>
  );
}
