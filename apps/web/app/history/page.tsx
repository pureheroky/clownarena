"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { AppContentFallback } from "@/components/app-content-fallback";
import { Panel, Pill } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { duelRoomTypeLabel, duelStatusLabel, formatDateTime } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

export default function HistoryPage() {
  const { isAuthenticated, isLoading } = useSession();

  const historyQuery = useQuery({
    queryKey: ["history"],
    queryFn: api.history,
    enabled: isAuthenticated
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening match history"
        description="Loading finished duels, wallet outcomes and rating changes."
      />
    );
  }

  if (!isAuthenticated) {
    return <Panel>Sign in first to inspect your duel history.</Panel>;
  }

  return (
    <Panel>
      <Pill tone="accent">History</Pill>
      <h1 className="mt-4 text-4xl font-semibold text-foreground">Room archive</h1>
      <div className="mt-6 space-y-4">
        {!historyQuery.data?.length ? (
          <Card className="border-dashed border-border/80 bg-white shadow-none">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Your finished matches will appear here. Start by creating a private room or joining one by code.
            </CardContent>
          </Card>
        ) : null}
        {historyQuery.data?.map((item: any) => (
          <Card key={item.duel.id} className="border-border/80 bg-white shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.duel.room_code}</p>
                  <p className="mt-1 text-2xl font-semibold capitalize text-foreground">{duelStatusLabel(item.duel.status)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{duelRoomTypeLabel(item.duel.room_type)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Finished {formatDateTime(item.duel.finished_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Rating delta: {item.duel.room_type === "practice" ? "No rating change" : item.rating_delta}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wallet delta: {item.duel.room_type === "practice" ? "No token change" : item.wallet_delta}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-4 bg-white">
                <Link href={`/app/duels/${item.duel.id}`}>Open replay</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Panel>
  );
}
