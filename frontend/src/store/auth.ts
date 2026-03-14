import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      login: (username) => set({ isAuthenticated: true, username }),
      logout: () => set({ isAuthenticated: false, username: null }),
    }),
    { name: "vyos-auth" }
  )
);
