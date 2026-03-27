"use client";

import Link from "next/link";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileJson2, Trash2, WandSparkles } from "lucide-react";
import { ZodError } from "zod";

import { AppContentFallback } from "@/components/app-content-fallback";
import { FadeIn } from "@/components/animated";
import { useFeedback } from "@/components/feedback-provider";
import { Panel, Pill } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { difficultyLabel, formatDateTime, problemStatusLabel } from "@/lib/formatters";
import { parseProblemImportJson } from "@/lib/problem-import";
import { createProblemFromPayload, createProblemFromTemplate, problemTemplates } from "@/lib/problem-templates";
import { useSession } from "@/lib/use-session";

export default function ProblemsIndexPage() {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { notify } = useFeedback();
  const { isAuthenticated, isLoading } = useSession();

  const problemsQuery = useQuery({
    queryKey: ["my-problems"],
    queryFn: api.myProblems,
    enabled: isAuthenticated
  });

  const deleteProblemMutation = useMutation({
    mutationFn: (problemId: string) => api.deleteProblem(problemId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-problems"] }),
        queryClient.invalidateQueries({ queryKey: ["duel-catalog"] })
      ]);
      notify({
        tone: "success",
        title: "Task deleted",
        description: "The draft was removed from your problem workspace."
      });
    }
  });

  const importSamplesMutation = useMutation({
    mutationFn: async () => {
      for (const template of problemTemplates) {
        await createProblemFromTemplate(template);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-problems"] }),
        queryClient.invalidateQueries({ queryKey: ["duel-catalog"] })
      ]);
      notify({
        tone: "success",
        title: "Sample tasks added",
        description: "Two sample problems were added to your workspace."
      });
    }
  });

  const importJsonMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      try {
        const items = parseProblemImportJson(text);
        for (const item of items) {
          await createProblemFromPayload(item);
        }
        return items.length;
      } catch (error) {
        if (error instanceof ZodError) {
          throw new Error("The JSON file does not match the expected problem format.");
        }
        if (error instanceof SyntaxError) {
          throw new Error("The JSON file could not be parsed.");
        }
        throw error;
      }
    },
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-problems"] }),
        queryClient.invalidateQueries({ queryKey: ["duel-catalog"] })
      ]);
      notify({
        tone: "success",
        title: "JSON import complete",
        description: `Imported ${count} task${count === 1 ? "" : "s"} into your workspace.`
      });
    }
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening your problem workspace"
        description="Loading your drafts, checks and published problems."
      />
    );
  }

  if (!isAuthenticated) {
    return <Panel>Sign in first to see the problems you created.</Panel>;
  }

  return (
    <FadeIn>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Pill tone="accent">Problems</Pill>
            <h1 className="mt-4 text-4xl font-semibold text-foreground">Your problems</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Start a fresh task, reopen an older draft, or add a couple of guided practice tasks to get moving quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  importJsonMutation.mutate(file);
                }
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={() => importInputRef.current?.click()}
            >
              <FileJson2 className="mr-2 h-4 w-4" />
              {importJsonMutation.isPending ? "Importing..." : "Import JSON"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="bg-white"
              onClick={() => importSamplesMutation.mutate()}
            >
              <WandSparkles className="mr-2 h-4 w-4" />
              {importSamplesMutation.isPending ? "Adding sample tasks..." : "Add sample tasks"}
            </Button>
            <Button asChild>
              <Link href="/app/problems/new">Create problem</Link>
            </Button>
          </div>
        </div>

        {importSamplesMutation.error?.message || importJsonMutation.error?.message || deleteProblemMutation.error?.message ? (
          <p className="mt-4 text-sm text-destructive">
            {importSamplesMutation.error?.message ??
              importJsonMutation.error?.message ??
              deleteProblemMutation.error?.message}
          </p>
        ) : null}

        {importSamplesMutation.isSuccess ? (
          <p className="mt-4 text-sm text-emerald-700">
            Practice tasks were added to your workspace. You can edit them, run checks and use them for practice rooms.
          </p>
        ) : null}
        {importJsonMutation.isSuccess ? (
          <p className="mt-4 text-sm text-emerald-700">
            Imported {importJsonMutation.data} task{importJsonMutation.data === 1 ? "" : "s"} from JSON.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Import your own task file or add built-in practice tasks if you want something to edit right away.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {problemTemplates.map((template) => (
            <Card key={template.key} className="border-border/80 bg-muted/35 shadow-none">
              <CardContent className="p-5">
                <div className="text-base font-medium text-foreground">{template.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
                <div className="mt-3 text-sm text-muted-foreground">
                  {template.examples.length} examples · {template.tests.length} tests · {difficultyLabel(template.difficulty)}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-700">
                  Built for practice rooms
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {problemsQuery.data?.map((problem) => (
            <Card key={problem.id} className="border-border/80 bg-white shadow-none">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-medium text-foreground">{problem.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {problemStatusLabel(problem.status)} · {difficultyLabel(problem.difficulty)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {problem.examples_count} examples · {problem.tests_count} tests · updated {formatDateTime(problem.updated_at)}
                    </div>
                    {problem.is_template_seeded ? (
                      <p className="mt-2 text-sm text-amber-700">
                        Built-in practice task. Duplicate the idea if you want to publish your own duel problem.
                      </p>
                    ) : null}
                    {problem.validation_notes ? (
                      <p className="mt-2 text-sm text-amber-700">{problem.validation_notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/app/problems/${problem.id}/edit`}>Edit</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="bg-white">
                      <Link href={`/app/problems/${problem.id}`}>Preview</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={deleteProblemMutation.isPending}
                      onClick={() => deleteProblemMutation.mutate(problem.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!problemsQuery.data?.length ? (
            <Card className="border-dashed border-border/80 bg-white shadow-none">
              <CardContent className="p-5 text-sm text-muted-foreground">
                You have not created any problems yet. Start with a short task and at least one clear example.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </Panel>
    </FadeIn>
  );
}
