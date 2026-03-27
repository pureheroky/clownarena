import Link from "next/link";

import { FadeIn, Stagger, StaggerItem } from "@/components/animated";
import { MarketingNav } from "@/components/marketing-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const beats = [
  "Players create the actual problems that power the arena.",
  "Each duel uses a fixed problem version, so results stay consistent.",
  "Private rooms reserve clown-token stakes before the countdown even begins.",
  "Every match ends with a clear result, rating change and token payout.",
];

const stats = [
  { label: "Mode", value: "Private 1v1" },
  { label: "Language", value: "Python" },
  { label: "Economy", value: "Daily tokens" },
  { label: "Ranking", value: "Live Elo" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 sm:px-6">
        <FadeIn className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[32px] border border-border/80 bg-white/88 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur sm:p-10">
            <div className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary-foreground">
              User-generated coding duels
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] text-foreground sm:text-6xl">
              Build a problem, validate it, then wager tokens in a private 1v1
              duel.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
              Clown Arena focuses on one loop: player-made problems, clear
              validation, private duel rooms, fast results and meaningful
              rating changes after every match.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="bg-white">
                <Link href="/app">Open control room</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-[32px] bg-primary p-8 text-primary-foreground shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/65">
              Core loop
            </div>
            <ol className="mt-6 space-y-5">
              {beats.map((beat, index) => (
                <li key={beat} className="flex gap-4">
                  <div className="text-lg font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="text-sm leading-6 text-primary-foreground/84">
                    {beat}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </FadeIn>

        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <Card className="border-border/80 bg-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-foreground">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <FadeIn delay={0.1}>
          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Problem studio",
                body: "Write the statement in plain language, add visible examples and maintain hidden tests over time.",
              },
              {
                title: "Strict duel control",
                body: "Stakes are reserved before the room starts, the countdown is enforced and only active matches accept submissions.",
              },
              {
                title: "Clear post-match trail",
                body: "After every duel you can inspect the final outcome, rating change, wallet movement and submission timeline.",
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="border-border/80 bg-white shadow-none"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        </FadeIn>
      </main>
    </div>
  );
}
