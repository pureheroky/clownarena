"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";

const navItems = [
  { href: "/auth", label: "Auth" },
  { href: "/profile", label: "Profile" },
  { href: "/problems/new", label: "Problems" },
  { href: "/duels/private", label: "Duels" },
  { href: "/history", label: "History" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();

  return (
    <header className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-white/88 px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/82 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="font-display text-lg font-semibold text-foreground"
          >
            Clown Arena🤡
          </Link>
          <p className="text-sm text-muted-foreground">
            Private coding duels with validated problems, stakes and live
            judging.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                pathname === item.href && "bg-muted text-foreground",
              )}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <Button onClick={clearSession} size="sm" type="button">
              Logout {user.username}
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
