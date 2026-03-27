"use client";

import { create } from "zustand";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  rating: number;
  clown_tokens_balance: number;
};

type AuthState = {
  user: SessionUser | null;
  setSession: (user: SessionUser) => void;
  setUser: (user: SessionUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setSession: (user) => set({ user }),
  setUser: (user) => set((state) => ({ ...state, user })),
  clearSession: () => set({ user: null })
}));
