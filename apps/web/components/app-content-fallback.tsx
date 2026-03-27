"use client";

import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-3 rounded-full bg-foreground/8", className)} />;
}

export function AppContentFallback({
  title = "Loading the next view",
  description = "Preparing the workspace and pulling the latest arena data."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <section className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-white px-6 py-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(33,46,78,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="h-6 w-28 rounded-full bg-primary/10" />
          <div className="mt-4 h-10 w-full max-w-md rounded-full bg-foreground/10" />
          <div className="mt-4 max-w-2xl space-y-3">
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-4/5" />
          </div>
          <div className="mt-5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{title}</span>
            <span className="ml-2">{description}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Card key={index} className="border-border/80 bg-white shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="h-4 w-24 rounded-full bg-foreground/8" />
              <div className="h-8 w-20 rounded-full bg-foreground/10" />
              <div className="space-y-2">
                <SkeletonLine className="w-full" />
                <SkeletonLine className="w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-white shadow-none">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-40 rounded-full bg-foreground/8" />
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  <SkeletonLine className="h-4 w-2/5" />
                  <SkeletonLine className="mt-3 h-3 w-full" />
                  <SkeletonLine className="mt-2 h-3 w-4/5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-white shadow-none">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-32 rounded-full bg-foreground/8" />
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                <SkeletonLine className="h-4 w-1/2" />
                <SkeletonLine className="mt-3 h-3 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
