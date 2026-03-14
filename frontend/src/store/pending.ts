import { create } from "zustand";

export interface PendingCommand {
  id: string;
  op: "set" | "delete";
  path: string[];
  value?: string;
  description: string;
}

interface PendingState {
  commands: PendingCommand[];
  add: (cmd: Omit<PendingCommand, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

let _counter = 0;

export const usePendingStore = create<PendingState>()((set) => ({
  commands: [],
  add: (cmd) =>
    set((state) => ({
      commands: [...state.commands, { ...cmd, id: String(++_counter) }],
    })),
  remove: (id) =>
    set((state) => ({
      commands: state.commands.filter((c) => c.id !== id),
    })),
  clear: () => set({ commands: [] }),
}));
