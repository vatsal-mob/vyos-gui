import { usePendingStore } from "../../store/pending";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/client";
import { X, Loader2, Zap } from "lucide-react";

export default function CommitBanner() {
  const { commands, clear } = usePendingStore();
  const qc = useQueryClient();

  const commitMutation = useMutation({
    mutationFn: async () => {
      const payload = commands.map(({ op, path, value }) => ({ op, path, value }));
      return api.post("/vyos/configure", { commands: payload }).then((r) => r.data);
    },
    onSuccess: () => {
      clear();
      qc.invalidateQueries();
    },
  });

  if (commands.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-warning/25 bg-card/96 backdrop-blur-md">
      {/* Amber accent line at top */}
      <div className="h-px bg-gradient-to-r from-transparent via-warning/50 to-transparent" />

      <div className="flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
            <span className="text-xs font-mono font-medium text-warning">
              {commands.length} pending {commands.length === 1 ? "change" : "changes"}
            </span>
          </div>
          <div className="h-3.5 w-px bg-border" />
          <span className="text-2xs font-mono text-muted-foreground">
            Not committed to running config
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => clear()}
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-all duration-150"
          >
            <X className="h-3 w-3" />
            Discard
          </button>
          <button
            onClick={() => commitMutation.mutate()}
            disabled={commitMutation.isPending}
            className="flex items-center gap-1.5 rounded bg-warning px-3 py-1 text-xs font-display font-semibold text-black hover:bg-warning/90 disabled:opacity-60 transition-all duration-150 uppercase tracking-wide"
          >
            {commitMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            {commitMutation.isPending ? "Committing..." : "Commit"}
          </button>
        </div>
      </div>
    </div>
  );
}
