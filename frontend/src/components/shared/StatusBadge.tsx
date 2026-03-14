import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "up" | "down" | "unknown" | string;
  className?: string;
}

const dotColor: Record<string, string> = {
  up: "bg-emerald-400",
  down: "bg-red-500",
  unknown: "bg-muted-foreground",
};

const textColor: Record<string, string> = {
  up: "text-emerald-400",
  down: "text-red-500",
  unknown: "text-muted-foreground",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const dot = dotColor[status] ?? dotColor.unknown;
  const text = textColor[status] ?? textColor.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium font-mono",
        text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
      {status}
    </span>
  );
}
