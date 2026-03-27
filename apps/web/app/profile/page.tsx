"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppContentFallback } from "@/components/app-content-fallback";
import { useFeedback } from "@/components/feedback-provider";
import { Panel, Pill } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const { user, isAuthenticated, isLoading } = useSession();

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: api.wallet,
    enabled: isAuthenticated
  });

  const claimMutation = useMutation({
    mutationFn: api.claimDaily,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
      notify({
        tone: "success",
        title: "Daily claim collected",
        description: `You received ${result.claimed_amount} clown tokens.`
      });
    }
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening your profile"
        description="Loading rating, token balance and wallet ledger."
      />
    );
  }

  if (!isAuthenticated || !user) {
    return <Panel>Sign in first to see your profile, wallet and rating.</Panel>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel className="bg-primary text-primary-foreground">
        <Pill tone="accent">Profile</Pill>
        <h1 className="mt-4 text-4xl font-semibold">{user.username}</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="rounded-2xl border-white/10 bg-white/10 text-primary-foreground shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-primary-foreground/65">Rating</p>
              <p className="mt-2 text-3xl font-semibold">{user.rating}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-white/10 bg-white/10 text-primary-foreground shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-primary-foreground/65">Clown tokens</p>
              <p className="mt-2 text-3xl font-semibold">{walletQuery.data?.balance ?? user.clown_tokens_balance}</p>
            </CardContent>
          </Card>
        </div>
        <Button
          type="button"
          onClick={() => claimMutation.mutate()}
          className="mt-6 bg-white text-primary hover:bg-white/92"
        >
          {claimMutation.isPending ? "Claiming..." : "Claim daily 100 tokens"}
        </Button>
        <p className="mt-3 text-sm text-paper/70">
          Next claim: {walletQuery.data?.next_daily_claim_at ? formatDateTime(walletQuery.data.next_daily_claim_at) : "available now"}
        </p>
        <p className="text-sm text-amber-200">{claimMutation.error?.message}</p>
      </Panel>

      <Panel>
        <Pill>Ledger</Pill>
        <div className="mt-4 space-y-3">
          {walletQuery.data?.transactions.map((transaction) => (
            <Card key={transaction.id} className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <strong className="uppercase tracking-[0.16em] text-foreground">
                    {transaction.transaction_type}
                  </strong>
                  <span className={transaction.amount >= 0 ? "text-emerald-700" : "text-destructive"}>
                    {transaction.amount >= 0 ? "+" : ""}
                    {transaction.amount}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Balance after: {transaction.balance_after}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Panel>
    </div>
  );
}
