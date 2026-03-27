"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  appNavItems,
  getAppRouteMeta,
  isAppNavItemActive,
} from "@/lib/app-shell";
import { useAuthStore } from "@/lib/auth-store";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const routeMeta = getAppRouteMeta(pathname);
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const { user, isAuthenticated, isLoading } = useSession();

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: api.wallet,
    enabled: isAuthenticated,
    staleTime: 20_000,
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      clearSession();
      queryClient.clear();
      router.replace("/");
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isLoading && !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full max-w-none gap-4 px-4 py-4 sm:px-6 xl:gap-6 xl:px-8 2xl:px-10">
      <motion.aside
        className="hidden w-[296px] shrink-0 xl:block 2xl:w-[332px]"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sticky top-4 space-y-4 rounded-[28px] border border-border/80 bg-white/88 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
            <div className="text-xs uppercase tracking-[0.22em] text-primary-foreground/65">
              {routeMeta.sidebarEyebrow}
            </div>
            <div className="mt-3 text-2xl font-semibold">
              {routeMeta.sidebarTitle}
            </div>
            <p className="mt-2 text-sm leading-6 text-primary-foreground/78">
              {routeMeta.sidebarDescription}
            </p>
          </div>

          <nav className="space-y-1">
            {appNavItems.map((item) => {
              const Icon = item.icon;
              const active = isAppNavItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="app-shell-active-item"
                      className="absolute inset-0 -z-10 rounded-2xl bg-muted shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                        mass: 0.7,
                      }}
                    />
                  ) : null}
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-border/80 bg-muted/50 p-4">
            <div className="text-sm font-medium text-foreground">
              {user?.username ?? "Guest"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Rating
                </div>
                <div className="mt-1 font-semibold text-foreground">
                  {user?.rating ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Tokens
                </div>
                <div className="mt-1 font-semibold text-foreground">
                  {walletQuery.data?.balance ?? user?.clown_tokens_balance ?? 0}
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-white"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </motion.aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col gap-4">
        <motion.header
          className="rounded-[28px] border border-border/80 bg-white/88 px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)] backdrop-blur lg:px-6"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {routeMeta.headerEyebrow}
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {routeMeta.headerTitle}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {routeMeta.headerDescription}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:hidden">
              {appNavItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  size="sm"
                  variant={
                    isAppNavItemActive(pathname, item) ? "default" : "outline"
                  }
                  className="bg-white"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
            {routeMeta.headerNote ? (
              <div className="hidden rounded-full border border-border/70 bg-muted/60 px-3 py-2 text-sm text-muted-foreground lg:flex">
                <span>{routeMeta.headerNote}</span>
              </div>
            ) : null}
          </div>
        </motion.header>

        <motion.main
          className="flex-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
