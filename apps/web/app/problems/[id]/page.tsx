"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { AppContentFallback } from "@/components/app-content-fallback";
import { Panel, Pill } from "@/components/panel";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { problemStatusLabel, testKindLabel } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

export default function ProblemDetailPage() {
  const params = useParams<{ id: string }>();
  const { isAuthenticated, isLoading } = useSession();
  const query = useQuery({
    queryKey: ["problem", params.id],
    queryFn: () => api.problem(params.id),
    enabled: Boolean(isAuthenticated && params.id)
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening problem preview"
        description="Loading the statement, current version and test summary."
      />
    );
  }

  if (!isAuthenticated) {
    return <Panel>Sign in first to inspect this problem.</Panel>;
  }

  if (!query.data) {
    return (
      <AppContentFallback
        title="Syncing problem preview"
        description="Waiting for the latest problem data before rendering the preview."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.9fr)]">
      <Panel className="min-w-0">
        <Pill tone="accent">{problemStatusLabel(query.data.status)}</Pill>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">{query.data.title}</h1>
        <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{query.data.description}</p>
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Card className="border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Input</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{query.data.input_spec}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Output</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{query.data.output_spec}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Constraints</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{query.data.constraints_text}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 2xl:grid-cols-2">
          <Card className="border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Examples</p>
              <div className="mt-4 space-y-4">
                {query.data.examples.map((example, index) => (
                  <div key={example.id} className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <p className="text-sm font-medium text-foreground">Example {index + 1}</p>
                    <div className="mt-3 grid gap-3 2xl:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Input</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{example.input_data}</pre>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected output</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{example.output_data}</pre>
                      </div>
                    </div>
                    {example.explanation ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{example.explanation}</p>
                    ) : null}
                  </div>
                ))}
                {!query.data.examples.length ? (
                  <p className="text-sm text-muted-foreground">No visible examples yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Visible tests</p>
              <div className="mt-4 space-y-4">
                {query.data.tests.map((test, index) => (
                  <div key={test.id} className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {test.kind === "sample" ? `Sample test ${index + 1}` : testKindLabel(test.kind)}
                      </p>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        weight {test.weight}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 2xl:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Input</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{test.input_data}</pre>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected output</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{test.expected_output}</pre>
                      </div>
                    </div>
                  </div>
                ))}
                {!query.data.tests.length ? (
                  <p className="text-sm text-muted-foreground">No visible tests in this version.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </Panel>
      <Panel className="min-w-0">
        <Pill>Version</Pill>
        <p className="mt-4 text-sm text-muted-foreground">Published version: {query.data.active_version_id ?? "not published"}</p>
        <div className="mt-4 space-y-3">
          {query.data.tests.map((test) => (
            <Card key={test.id} className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="uppercase tracking-[0.18em] text-foreground">{testKindLabel(test.kind)}</strong>
                  <span className="text-xs text-muted-foreground">weight {test.weight}</span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/70 p-3 text-xs text-muted-foreground">
                  {test.input_data}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </Panel>
    </div>
  );
}
