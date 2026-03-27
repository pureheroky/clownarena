"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useSession() {
  const storedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  const sessionQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    staleTime: 30_000
  });

  useEffect(() => {
    if (sessionQuery.data) {
      setUser({
        id: sessionQuery.data.id,
        username: sessionQuery.data.username,
        email: sessionQuery.data.email,
        rating: sessionQuery.data.rating,
        clown_tokens_balance: sessionQuery.data.clown_tokens_balance
      });
      return;
    }
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
      clearSession();
    }
  }, [clearSession, sessionQuery.data, sessionQuery.error, setUser]);

  const user = sessionQuery.data
    ? {
        id: sessionQuery.data.id,
        username: sessionQuery.data.username,
        email: sessionQuery.data.email,
        rating: sessionQuery.data.rating,
        clown_tokens_balance: sessionQuery.data.clown_tokens_balance
      }
    : storedUser;

  return {
    user,
    isLoading: sessionQuery.isLoading,
    isAuthenticated: Boolean(user) && !(sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401),
    error: sessionQuery.error
  };
}
