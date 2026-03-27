"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";

export function MarketingNav() {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link
        href="/"
        className="text-base font-semibold tracking-[0.08em] text-foreground"
      >
        Clown Arena🤡
      </Link>
      <nav className="flex items-center gap-2">
        <Button asChild variant="ghost" className="text-foreground">
          <Link href="/auth">{user ? "Switch account" : "Log in"}</Link>
        </Button>
        <Button asChild>
          <Link href={user ? "/app" : "/auth"}>
            {user ? "Open app" : "Get started"}
          </Link>
        </Button>
      </nav>
    </header>
  );
}
