import { usePendingStore } from "../store/pending";
import { useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

export function usePendingChanges() {
  const { commands, add, remove, clear } = usePendingStore();
  const qc = useQueryClient();

  async function commit() {
    if (commands.length === 0) return;
    const payload = commands.map(({ op, path, value }) => ({ op, path, value }));
    await api.post("/vyos/configure", { commands: payload });
    clear();
    await qc.invalidateQueries();
  }

  function discard() {
    clear();
  }

  return { commands, add, remove, commit, discard };
}
