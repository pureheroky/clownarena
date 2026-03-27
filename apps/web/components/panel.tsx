import clsx from "clsx";
import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function Panel({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={clsx("border-border/80 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/82", className)}>
      <CardContent className="p-5 sm:p-6 xl:p-7">{children}</CardContent>
    </Card>
  );
}

export function Pill({
  children,
  tone = "default"
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warn";
}) {
  return (
    <Badge
      variant={tone === "warn" ? "destructive" : tone === "accent" ? "secondary" : "default"}
      className={clsx(
        "rounded-full px-3 py-1 text-[10px] tracking-[0.18em]",
        tone === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
        tone === "accent" && "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        tone === "warn" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      )}
    >
      {children}
    </Badge>
  );
}
