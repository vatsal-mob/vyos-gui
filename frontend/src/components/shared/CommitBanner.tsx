import { usePendingStore } from "../../store/pending";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

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
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-amber-500/30 bg-card/95 backdrop-blur-sm px-5 py-2.5 shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-medium text-amber-400">
          {commands.length} uncommitted change{commands.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => clear()}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
          Discard
        </button>
        <button
          onClick={() => commitMutation.mutate()}
          disabled={commitMutation.isPending}
          className="flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1 text-xs font-medium text-black hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          {commitMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Commit
        </button>
      </div>
    </div>
  );
}
