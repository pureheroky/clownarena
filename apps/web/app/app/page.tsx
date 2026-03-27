"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { FadeIn, Stagger, StaggerItem } from "@/components/animated";
import { AppContentFallback } from "@/components/app-content-fallback";
import { Panel, Pill } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { difficultyLabel, formatDateTime, problemStatusLabel } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useSession();

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: api.wallet,
    enabled: isAuthenticated
  });

  const myProblemsQuery = useQuery({
    queryKey: ["my-problems"],
    queryFn: api.myProblems,
    enabled: isAuthenticated
  });

  const historyQuery = useQuery({
    queryKey: ["history"],
    queryFn: api.history,
    enabled: isAuthenticated
  });

  const leaderboardsQuery = useQuery({
    queryKey: ["leaderboards"],
    queryFn: api.leaderboards
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening your control room"
        description="Loading your wallet, recent matches and the latest problem activity."
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Panel>
        <Pill tone="accent">Main interface</Pill>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">Sign in to open your control room.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Once you are logged in, this page becomes the home for drafts, duel rooms, wallet updates and leaderboards.
        </p>
        <Button asChild className="mt-6">
          <Link href="/auth">Go to sign in</Link>
        </Button>
      </Panel>
    );
  }

  const readyProblems = myProblemsQuery.data?.filter((item) => item.status === "ready_for_duel").length ?? 0;
  const topRating = leaderboardsQuery.data?.rating[0];

  return (
    <div className="space-y-6">
      <FadeIn>
        <Panel>
          <Pill tone="accent">Overview</Pill>
          <h1 className="mt-4 text-4xl font-semibold text-foreground">Welcome back, {user.username}.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            From here you can continue a draft, publish a validated problem, start a private duel or track how your
            rating compares with everyone else.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/app/problems/new">Create a new problem</Link>
            </Button>
            <Button asChild variant="outline" className="bg-white">
              <Link href="/app/duels/private">Create private duel</Link>
            </Button>
          </div>
        </Panel>
      </FadeIn>

      <Stagger className="grid gap-4 lg:grid-cols-4">
        {[
          { label: "Rating", value: String(user.rating) },
          { label: "Tokens", value: String(walletQuery.data?.balance ?? user.clown_tokens_balance) },
          { label: "Ready problems", value: String(readyProblems) },
          { label: "Finished duels", value: String(historyQuery.data?.length ?? 0) }
        ].map((item) => (
          <StaggerItem key={item.label}>
            <Card className="border-border/80 bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold text-foreground">{item.value}</div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <FadeIn delay={0.05}>
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Pill>Latest drafts</Pill>
                <h2 className="mt-3 text-2xl font-semibold text-foreground">Continue where you left off</h2>
              </div>
              <Button asChild variant="outline" className="bg-white">
                <Link href="/app/problems">See all problems</Link>
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {myProblemsQuery.data?.slice(0, 4).map((problem) => (
                <Card key={problem.id} className="border-border/80 bg-white shadow-none">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-medium text-foreground">{problem.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {problemStatusLabel(problem.status)} · {difficultyLabel(problem.difficulty)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {problem.examples_count} examples · {problem.tests_count} tests
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/app/problems/${problem.id}/edit`}>Open editor</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!myProblemsQuery.data?.length ? (
                <Card className="border-dashed border-border/80 bg-white shadow-none">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    You do not have any drafts yet. Create one and start with a clear statement plus a few examples.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </Panel>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-6">
            <Panel>
              <Pill tone="warn">Recent matches</Pill>
              <div className="mt-5 space-y-3">
                {historyQuery.data?.slice(0, 3).map((item) => (
                  <Card key={item.duel.id} className="border-border/80 bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-foreground">{item.duel.room_code}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {item.duel.status.replaceAll("_", " ")} · rating {item.rating_delta >= 0 ? "+" : ""}
                        {item.rating_delta}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Finished {formatDateTime(item.duel.finished_at)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!historyQuery.data?.length ? (
                  <Card className="border-dashed border-border/80 bg-white shadow-none">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      No finished matches yet. Start with a private room and invite another player by code.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </Panel>

            <Panel>
              <Pill>Top player right now</Pill>
              <div className="mt-4 rounded-2xl border border-border/80 bg-white p-4">
                <div className="text-base font-medium text-foreground">{topRating?.username ?? "No data yet"}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {topRating ? `${topRating.rating} rating · ${topRating.clown_tokens_balance} tokens` : "Leaderboard will appear once players start competing."}
                </div>
                <Button asChild variant="outline" className="mt-4 bg-white">
                  <Link href="/app/leaderboards">Open leaderboards</Link>
                </Button>
              </div>
            </Panel>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
