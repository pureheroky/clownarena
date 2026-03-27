"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppContentFallback } from "@/components/app-content-fallback";
import { FadeIn } from "@/components/animated";
import { MarketingNav } from "@/components/marketing-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useSession } from "@/lib/use-session";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const { isAuthenticated, isLoading } = useSession();

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" }
  });
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: async ({ user }) => {
      setSession(user);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/app");
    }
  });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async ({ user }) => {
      setSession(user);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/app");
    }
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/app");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isLoading && isAuthenticated) {
    return (
      <div className="min-h-screen">
        <MarketingNav />
        <main className="mx-auto flex w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6">
          <AppContentFallback
            title="Opening your workspace"
            description="Your session is already active. Taking you back to the main app."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 sm:px-6">
        <FadeIn className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] bg-primary p-8 text-primary-foreground shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-10">
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/78">
              Sign in or create an account
            </div>
            <h1 className="mt-6 text-5xl font-semibold leading-tight">
              Start with a free balance, then build or challenge.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-primary-foreground/82">
              New accounts start with clown tokens, daily claims are available from the profile page and the same
              session powers the duel room, wallet and live updates.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Create a draft and keep editing it over time.",
                "Validate tasks with a Python reference solution.",
                "Open private rooms with fixed token stakes.",
                "Track rating, wallet history and match results."
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm leading-6">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <Card className="border-border/80 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Access the arena</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="register" className="w-full">
                <TabsList>
                  <TabsTrigger value="register">Create account</TabsTrigger>
                  <TabsTrigger value="login">Log in</TabsTrigger>
                </TabsList>
                <TabsContent value="register">
                  <form
                    className="space-y-4"
                    onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="register-username">Username</Label>
                      <Input id="register-username" placeholder="Choose a public nickname" {...registerForm.register("username")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input id="register-email" placeholder="you@example.com" {...registerForm.register("email")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <Input id="register-password" type="password" placeholder="At least 8 characters" {...registerForm.register("password")} />
                    </div>
                    <Button type="submit">
                      {registerMutation.isPending ? "Creating account..." : "Create account"}
                    </Button>
                    <p className="text-sm text-destructive">{registerMutation.error?.message}</p>
                  </form>
                </TabsContent>
                <TabsContent value="login">
                  <form
                    className="space-y-4"
                    onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" placeholder="you@example.com" {...loginForm.register("email")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" type="password" placeholder="Your password" {...loginForm.register("password")} />
                    </div>
                    <Button type="submit">
                      {loginMutation.isPending ? "Signing in..." : "Log in"}
                    </Button>
                    <p className="text-sm text-destructive">{loginMutation.error?.message}</p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </FadeIn>
      </main>
    </div>
  );
}
