"use client";

import { useQuery } from "@tanstack/react-query";

import { FadeIn } from "@/components/animated";
import { Panel, Pill } from "@/components/panel";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function LeaderboardList({
  items,
  activeMetric,
  currentUserId
}: {
  items: Awaited<ReturnType<typeof api.leaderboards>>["rating"];
  activeMetric: "rating" | "tokens";
  currentUserId?: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((entry) => (
        <Card
          key={`${activeMetric}-${entry.user_id}`}
          className={`border-border/80 bg-white shadow-none ${currentUserId === entry.user_id ? "ring-2 ring-primary/20" : ""}`}
        >
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                {entry.rank}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{entry.username}</div>
                <div className="text-sm text-muted-foreground">
                  {activeMetric === "rating"
                    ? `${entry.clown_tokens_balance} tokens`
                    : `${entry.rating} rating`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-foreground">
                {activeMetric === "rating" ? entry.rating : entry.clown_tokens_balance}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {activeMetric === "rating" ? "rating" : "tokens"}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function LeaderboardsPage() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const leaderboardsQuery = useQuery({
    queryKey: ["leaderboards"],
    queryFn: api.leaderboards
  });

  return (
    <FadeIn>
      <Panel>
        <Pill tone="accent">Leaderboards</Pill>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">See who leads the arena.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          There are two public rankings: one based on rating and one based on clown tokens currently held.
        </p>

        <Tabs defaultValue="rating" className="mt-6">
          <TabsList>
            <TabsTrigger value="rating">Rating leaderboard</TabsTrigger>
            <TabsTrigger value="tokens">Token leaderboard</TabsTrigger>
          </TabsList>
          <TabsContent value="rating">
            <LeaderboardList
              items={leaderboardsQuery.data?.rating ?? []}
              activeMetric="rating"
              currentUserId={currentUserId}
            />
          </TabsContent>
          <TabsContent value="tokens">
            <LeaderboardList
              items={leaderboardsQuery.data?.tokens ?? []}
              activeMetric="tokens"
              currentUserId={currentUserId}
            />
          </TabsContent>
        </Tabs>
      </Panel>
    </FadeIn>
  );
}
