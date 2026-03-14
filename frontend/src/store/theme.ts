import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  theme: "light" | "dark";
  toggle: () => void;
}

export const useThemeStore = create(
  persist<ThemeState>(
    (set) => ({
      theme: "light" as "light" | "dark",
      toggle: () =>
        set((s) => {
          const next = s.theme === "light" ? "dark" : "light";
          document.documentElement.classList.toggle("dark", next === "dark");
          return { theme: next };
        }),
    }),
    {
      name: "vyos-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.toggle(
            "dark",
            state.theme === "dark"
          );
        }
      },
    }
  )
);

/** Call once at app startup to apply persisted theme immediately. */
export function initTheme() {
  const stored = useThemeStore.getState();
  document.documentElement.classList.toggle("dark", stored.theme === "dark");
}
