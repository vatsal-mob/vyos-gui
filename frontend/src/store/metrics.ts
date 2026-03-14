import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MetricPoint {
  time: number; // epoch ms
  value: number;
}

interface MetricsState {
  cpu: MetricPoint[];
  memory: MetricPoint[];
  // per-interface rx/tx bytes keyed by name
  ifaceRx: Record<string, MetricPoint[]>;
  ifaceTx: Record<string, MetricPoint[]>;

  pushCpu: (value: number) => void;
  pushMemory: (value: number) => void;
  pushIface: (name: string, rx: number, tx: number) => void;
}

const MAX_POINTS = 60; // keep last 60 samples

function appendPoint(arr: MetricPoint[], point: MetricPoint): MetricPoint[] {
  const next = [...arr, point];
  return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
}

export const useMetricsStore = create(
  persist<MetricsState>(
    (set) => ({
      cpu: [],
      memory: [],
      ifaceRx: {},
      ifaceTx: {},

      pushCpu: (value) =>
        set((s) => ({ cpu: appendPoint(s.cpu, { time: Date.now(), value }) })),

      pushMemory: (value) =>
        set((s) => ({ memory: appendPoint(s.memory, { time: Date.now(), value }) })),

      pushIface: (name, rx, tx) =>
        set((s) => ({
          ifaceRx: {
            ...s.ifaceRx,
            [name]: appendPoint(s.ifaceRx[name] ?? [], { time: Date.now(), value: rx }),
          },
          ifaceTx: {
            ...s.ifaceTx,
            [name]: appendPoint(s.ifaceTx[name] ?? [], { time: Date.now(), value: tx }),
          },
        })),
    }),
    {
      name: "vyos-metrics",
    }
  )
);
