import { Suspense } from "react";

import { AppContentFallback } from "@/components/app-content-fallback";
import { AppShell } from "@/components/app-shell";

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<AppContentFallback />}>{children}</Suspense>
    </AppShell>
  );
}
