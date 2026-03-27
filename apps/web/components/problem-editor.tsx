"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, FileCode2, FlaskConical, PencilLine, Sparkles, Trash2 } from "lucide-react";

import { AppContentFallback } from "@/components/app-content-fallback";
import { CodeEditor } from "@/components/code-editor";
import { Panel, Pill } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFeedback } from "@/components/feedback-provider";
import { api, Problem } from "@/lib/api";
import { difficultyLabel, formatDateTime, problemStatusLabel, testKindLabel } from "@/lib/formatters";
import { problemTemplates } from "@/lib/problem-templates";
import { useSession } from "@/lib/use-session";

const emptyBasics = {
  title: "",
  description: "",
  input_spec: "",
  output_spec: "",
  constraints_text: "",
  difficulty: 2
};

const emptyExample = {
  input_data: "",
  output_data: "",
  explanation: "",
  order_index: 0
};

const emptyTest = {
  input_data: "",
  expected_output: "",
  kind: "sample",
  weight: 1,
  order_index: 0
};

const defaultReference = `import sys


def solve(data: str) -> str:
    return data.strip()


if __name__ == "__main__":
    print(solve(sys.stdin.read()))`;

function nextOrderIndex(items: Array<{ order_index: number }> | undefined | null) {
  if (!items?.length) {
    return 0;
  }
  return Math.max(...items.map((item) => item.order_index)) + 1;
}

function nextExampleDraft(problem: Problem | undefined | null) {
  return {
    ...emptyExample,
    order_index: nextOrderIndex(problem?.examples)
  };
}

function nextTestDraft(problem: Problem | undefined | null) {
  return {
    ...emptyTest,
    order_index: nextOrderIndex(problem?.tests)
  };
}

function referenceStatusCopy(reference: Problem["reference_solution"]) {
  if (!reference) {
    return {
      label: "No solution saved yet",
      description: "Add a working Python solution. We use it to check that your task is valid before publishing."
    };
  }

  if (reference.validation_status === "pending") {
    return {
      label: "Check in progress",
      description: "We are running your saved solution against the current tests. This panel will update automatically."
    };
  }

  if (reference.needs_validation) {
    return {
      label: "Ready to check",
      description:
        reference.validation_error ??
        "Your latest changes are saved. Run the check to make sure this version passes before publishing."
    };
  }

  if (reference.validation_status === "accepted") {
    return {
      label: "Passed",
      description: "This saved solution passed the current tests. You can publish the task for duel rooms."
    };
  }

  if (reference.validation_status === "failed") {
    return {
      label: "Check failed",
      description:
        reference.validation_error ??
        "The saved solution did not pass the current tests. Fix the code or the tests, then run the check again."
    };
  }

  return {
    label: "Saved",
    description: "The code is saved. Run the check when you want to verify this version."
  };
}

export function ProblemEditor({ problemId }: { problemId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const { isAuthenticated, isLoading } = useSession();

  const [basics, setBasics] = useState(emptyBasics);
  const [exampleDraft, setExampleDraft] = useState(emptyExample);
  const [editingExampleId, setEditingExampleId] = useState<string | null>(null);
  const [testDraft, setTestDraft] = useState(emptyTest);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState(defaultReference);
  const [publishBannerRequested, setPublishBannerRequested] = useState(false);
  const hydratedProblemId = useRef<string | null>(null);

  const problemQuery = useQuery({
    queryKey: ["problem-editor", problemId],
    queryFn: () => api.problem(problemId!),
    enabled: Boolean(isAuthenticated && problemId),
    refetchInterval: (query) => {
      const current = query.state.data as Problem | undefined;
      if (
        current?.status === "validation" ||
        current?.reference_solution?.validation_status === "pending"
      ) {
        return 2000;
      }
      return false;
    }
  });

  const problem = problemQuery.data;

  useEffect(() => {
    setPublishBannerRequested(new URLSearchParams(window.location.search).get("published") === "1");
  }, []);

  useEffect(() => {
    if (!problem) return;
    if (hydratedProblemId.current === problem.id) {
      setExampleDraft((current) => (editingExampleId ? current : nextExampleDraft(problem)));
      setTestDraft((current) => (editingTestId ? current : nextTestDraft(problem)));
      return;
    }
    hydratedProblemId.current = problem.id;
    setBasics({
      title: problem.title,
      description: problem.description,
      input_spec: problem.input_spec,
      output_spec: problem.output_spec,
      constraints_text: problem.constraints_text,
      difficulty: problem.difficulty
    });
    setReferenceCode(problem.reference_solution?.code ?? defaultReference);
    setExampleDraft(nextExampleDraft(problem));
    setTestDraft(nextTestDraft(problem));
    setEditingExampleId(null);
    setEditingTestId(null);
  }, [editingExampleId, editingTestId, problem]);

  const refreshProblem = async (updated: Problem) => {
    queryClient.setQueryData(["problem-editor", updated.id], updated);
    queryClient.setQueryData(["problem", updated.id], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-problems"] }),
      queryClient.invalidateQueries({ queryKey: ["duel-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => api.createProblem(basics),
    onSuccess: async (created) => {
      await refreshProblem(created);
      router.replace(`/app/problems/${created.id}/edit`);
    }
  });

  const saveBasicsMutation = useMutation({
    mutationFn: () => api.updateProblem(problemId!, basics),
    onSuccess: refreshProblem
  });

  const saveExampleMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...exampleDraft,
        order_index: exampleDraft.order_index || problem?.examples.length || 0
      };
      if (editingExampleId) {
        return api.updateExample(problemId!, editingExampleId, payload);
      }
      return api.addExample(problemId!, payload);
    },
    onSuccess: async (updated) => {
      await refreshProblem(updated);
      setEditingExampleId(null);
      setExampleDraft(nextExampleDraft(updated));
    }
  });

  const saveTestMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...testDraft,
        order_index: testDraft.order_index || problem?.tests.length || 0
      };
      if (editingTestId) {
        return api.updateTest(problemId!, editingTestId, payload);
      }
      return api.addTest(problemId!, payload);
    },
    onSuccess: async (updated) => {
      await refreshProblem(updated);
      setEditingTestId(null);
      setTestDraft(nextTestDraft(updated));
    }
  });

  const deleteExampleMutation = useMutation({
    mutationFn: (exampleId: string) => api.deleteExample(problemId!, exampleId),
    onSuccess: async (updated, deletedExampleId) => {
      await refreshProblem(updated);
      if (editingExampleId === deletedExampleId) {
        setEditingExampleId(null);
        setExampleDraft(nextExampleDraft(updated));
      }
    }
  });

  const deleteTestMutation = useMutation({
    mutationFn: (testId: string) => api.deleteTest(problemId!, testId),
    onSuccess: async (updated, deletedTestId) => {
      await refreshProblem(updated);
      if (editingTestId === deletedTestId) {
        setEditingTestId(null);
        setTestDraft(nextTestDraft(updated));
      }
    }
  });

  const referenceMutation = useMutation({
    mutationFn: () => api.upsertReference(problemId!, { language: "python", code: referenceCode }),
    onSuccess: refreshProblem
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!problemId) {
        throw new Error("Create the draft first.");
      }
      const savedCode = problem?.reference_solution?.code;
      const shouldSaveFirst = !problem?.reference_solution || savedCode !== referenceCode;
      if (shouldSaveFirst) {
        await api.upsertReference(problemId, { language: "python", code: referenceCode });
      }
      return api.validateProblem(problemId);
    },
    onSuccess: refreshProblem
  });

  const publishMutation = useMutation({
    mutationFn: () => api.publishProblem(problemId!, { is_public: true, is_duel_enabled: true }),
    onSuccess: async (updated) => {
      await refreshProblem(updated);
      setPublishBannerRequested(true);
      router.replace(`${pathname}?published=1`, { scroll: false });
    }
  });

  const deleteProblemMutation = useMutation({
    mutationFn: () => api.deleteProblem(problemId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-problems"] }),
        queryClient.invalidateQueries({ queryKey: ["duel-catalog"] })
      ]);
      notify({
        tone: "success",
        title: "Draft deleted",
        description: "The task has been removed from your workspace."
      });
      router.push("/app/problems");
    }
  });

  const stats = useMemo(
    () => ({
      tests: problem?.tests.length ?? 0,
      hiddenTests: problem?.tests.filter((item) => item.kind === "hidden").length ?? 0,
      examples: problem?.examples.length ?? 0,
      versions: problem?.versions.length ?? 0
    }),
    [problem]
  );

  const canEditAdvanced = Boolean(problemId && problem);
  const statusLabel = problem ? problemStatusLabel(problem.status) : "Draft not created yet";
  const referenceStatus = referenceStatusCopy(problem?.reference_solution ?? null);
  const validationInProgress =
    problem?.status === "validation" || problem?.reference_solution?.validation_status === "pending";
  const referenceSavedCode = problem?.reference_solution?.code;
  const hasReferenceSolution = Boolean(problem?.reference_solution);
  const hasUnsavedReferenceChanges =
    canEditAdvanced && (!hasReferenceSolution || referenceSavedCode !== referenceCode);
  const hasEnoughTests = stats.tests >= 3;
  const hasHiddenTest = stats.hiddenTests >= 1;
  const referencePassed =
    problem?.reference_solution?.validation_status === "accepted" &&
    !problem?.reference_solution?.needs_validation;
  const isPublishedLive = Boolean(problem?.active_version_id && problem?.is_public && problem?.is_duel_enabled);
  const publishedVersion = problem?.versions[0];
  const showPublishBanner = publishBannerRequested && isPublishedLive;
  const canPublish =
    problem?.status === "ready_for_duel" &&
    referencePassed &&
    !isPublishedLive &&
    !problem?.is_template_seeded;

  const publishBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!problemId || !problem) {
      blockers.push("Create the draft first.");
      return blockers;
    }
    if (stats.examples < 1) {
      blockers.push("Add at least one example so players can understand the format.");
    }
    if (!hasEnoughTests) {
      blockers.push("Add at least three tests before checking the task.");
    }
    if (!hasHiddenTest) {
      blockers.push("Add at least one hidden test so the final check is fair.");
    }
    if (!hasReferenceSolution && !referenceCode.trim()) {
      blockers.push("Write a reference solution first.");
    } else if (!hasReferenceSolution) {
      blockers.push("Save the reference solution, then run the check.");
    }
    if (hasUnsavedReferenceChanges) {
      blockers.push("Save or run the check so your latest code is included.");
    }
    if (problem.is_template_seeded) {
      blockers.push("Built-in practice tasks cannot be published as original duel problems.");
    }
    if (validationInProgress) {
      blockers.push("Wait for the current check to finish.");
    } else if (isPublishedLive) {
      blockers.push("This task is already live in duel rooms.");
    } else if (problem.reference_solution?.validation_status === "failed") {
      blockers.push("Fix the reference solution or tests, then run the check again.");
    } else if (problem.reference_solution?.needs_validation) {
      blockers.push("Run the check on the latest saved version.");
    } else if (problem.status !== "ready_for_duel") {
      blockers.push("Run the check and wait for the task to become ready.");
    }
    return blockers;
  }, [
    hasEnoughTests,
    hasHiddenTest,
    hasReferenceSolution,
    hasUnsavedReferenceChanges,
    problem,
    problemId,
    referenceCode,
    stats.examples,
    validationInProgress,
    isPublishedLive
  ]);

  const nextAction = isPublishedLive
    ? "Open the published version or create a practice room with it."
    : canPublish
    ? "Everything is ready. You can publish this task for duel rooms."
    : publishBlockers[0] ?? "Finish the remaining steps before publishing.";

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening the editor"
        description="Loading your draft, examples, tests and the reference solution."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Pill tone="accent">Problem editor</Pill>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Sign in to build a duel-ready problem.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Creating a task involves the statement, examples, hidden checks and a Python reference solution.
            </p>
          </div>
          <Button asChild>
            <Link href="/auth">Go to login</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (problemId && problemQuery.isLoading) {
    return (
      <AppContentFallback
        title="Refreshing the editor"
        description="Pulling the latest version of this draft before you continue editing."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] 2xl:grid-cols-[minmax(0,1.36fr)_minmax(360px,0.74fr)]">
      <div className="min-w-0 space-y-6">
        <Panel className="min-w-0">
          {showPublishBanner ? (
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/90 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-emerald-900">Task published successfully</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900/85">
                    This version is live and can now be used in duel rooms.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/app/problems/${problemId}`}>Open published task</Link>
                    </Button>
                    {problem?.active_version_id ? (
                      <Button asChild size="sm" variant="outline" className="bg-white">
                        <Link
                          href={`/app/duels/private?roomType=practice&problemVersionId=${problem.active_version_id}`}
                        >
                          Create practice room
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline" className="bg-white">
                      <Link href="/app/problems">Back to my problems</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="accent">{statusLabel}</Pill>
            <Pill>{difficultyLabel(basics.difficulty)}</Pill>
            {isPublishedLive ? <Pill tone="warn">Live in duel rooms</Pill> : null}
            {problem?.is_template_seeded ? <Pill tone="warn">Practice-only sample</Pill> : null}
            {publishedVersion ? <Pill>Version {publishedVersion.version_number}</Pill> : null}
          </div>
          <h1 className="mt-4 text-4xl font-semibold text-foreground">
            {problemId ? "Edit your problem" : "Create a new problem"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Fill in the task, add examples and tests, save a working solution, then run one final check before publishing.
          </p>

          {problem?.is_template_seeded ? (
            <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50/90 p-5">
              <p className="text-sm font-medium text-amber-900">This is a built-in practice task</p>
              <p className="mt-2 text-sm leading-6 text-amber-900/85">
                You can edit it, test it and use it for practice rooms, but it cannot be published as an original duel task.
              </p>
            </div>
          ) : null}

          {!problemId ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {problemTemplates.map((template) => (
                <Card
                  key={template.key}
                  className="cursor-pointer border-border/80 bg-muted/35 shadow-none transition-colors hover:bg-muted/55"
                  onClick={() => {
                    setBasics({
                      title: template.title,
                      description: template.description,
                      input_spec: template.input_spec,
                      output_spec: template.output_spec,
                      constraints_text: template.constraints_text,
                      difficulty: template.difficulty
                    });
                    setReferenceCode(template.reference_solution);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="text-sm font-medium text-foreground">{template.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {template.examples.length} examples · {template.tests.length} tests
                    </p>
                    <p className="mt-2 text-xs text-amber-700">
                      Prefill the editor with a practice-ready template.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="problem-title">Problem title</Label>
                <Input
                  id="problem-title"
                  value={basics.title}
                  placeholder="For example: Reverse the line"
                  onChange={(event) => setBasics((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="problem-description">What should the player do?</Label>
                <Textarea
                  id="problem-description"
                  className="min-h-[360px] 2xl:min-h-[430px]"
                  value={basics.description}
                  placeholder="Describe the task in plain language. Keep it direct and easy to understand."
                  onChange={(event) => setBasics((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="problem-input">What comes in?</Label>
                  <Textarea
                    id="problem-input"
                    className="min-h-[180px]"
                    value={basics.input_spec}
                    placeholder="Explain the input format."
                    onChange={(event) => setBasics((prev) => ({ ...prev, input_spec: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="problem-output">What should come out?</Label>
                  <Textarea
                    id="problem-output"
                    className="min-h-[180px]"
                    value={basics.output_spec}
                    placeholder="Explain the output format."
                    onChange={(event) => setBasics((prev) => ({ ...prev, output_spec: event.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <Label htmlFor="problem-constraints">Constraints and limits</Label>
                  <Textarea
                    id="problem-constraints"
                    className="min-h-[180px]"
                    value={basics.constraints_text}
                    placeholder="Mention size limits, edge cases and anything the player should keep in mind."
                    onChange={(event) => setBasics((prev) => ({ ...prev, constraints_text: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={String(basics.difficulty)}
                    onValueChange={(value) => setBasics((prev) => ({ ...prev, difficulty: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {difficultyLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-border/80 bg-muted/35 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  {problemId ? (
                    <Button type="button" onClick={() => saveBasicsMutation.mutate()}>
                      {saveBasicsMutation.isPending ? "Saving..." : "Save basics"}
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => createMutation.mutate()}>
                      {createMutation.isPending ? "Creating draft..." : "Create draft"}
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Save the statement before moving on to examples, tests and the reference solution.
                  </p>
                </div>
                {problem?.validation_notes ? (
                  <p className="mt-3 text-sm text-amber-700">{problem.validation_notes}</p>
                ) : null}
                {deleteProblemMutation.error?.message ? (
                  <p className="mt-3 text-sm text-destructive">{deleteProblemMutation.error.message}</p>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Pill>Examples</Pill>
            <span className="text-sm text-muted-foreground">
              Show players how input and output should look before the hidden checks start.
            </span>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] 2xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
            <div className="min-w-0 space-y-3 xl:max-h-[640px] xl:overflow-y-auto xl:pr-2">
              {problem?.examples.length ? (
                problem.examples.map((example, index) => (
                  <Card
                    key={example.id}
                    className={`cursor-pointer border-border/80 shadow-none transition-colors ${
                      editingExampleId === example.id ? "bg-muted" : "bg-white hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      setEditingExampleId(example.id);
                      setExampleDraft({
                        input_data: example.input_data,
                        output_data: example.output_data,
                        explanation: example.explanation ?? "",
                        order_index: example.order_index
                      });
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">Example {index + 1}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{example.order_index + 1}</Badge>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={!canEditAdvanced || deleteExampleMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteExampleMutation.mutate(example.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {example.explanation || "No explanation added yet."}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-border/80 bg-white shadow-none">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No examples yet. Add at least one so players can understand the format quickly.
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <Label>Example input</Label>
                <Textarea
                  value={exampleDraft.input_data}
                  placeholder="What input should the player see?"
                  onChange={(event) => setExampleDraft((prev) => ({ ...prev, input_data: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expected output</Label>
                <Textarea
                  value={exampleDraft.output_data}
                  placeholder="What output should the example produce?"
                  onChange={(event) => setExampleDraft((prev) => ({ ...prev, output_data: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Optional explanation</Label>
                <Textarea
                  value={exampleDraft.explanation}
                  placeholder="Explain why this example works."
                  onChange={(event) => setExampleDraft((prev) => ({ ...prev, explanation: event.target.value }))}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={exampleDraft.order_index}
                    onChange={(event) =>
                      setExampleDraft((prev) => ({ ...prev, order_index: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Button
                    type="button"
                    disabled={!canEditAdvanced}
                    onClick={() => saveExampleMutation.mutate()}
                  >
                    {saveExampleMutation.isPending
                      ? "Saving..."
                      : editingExampleId
                        ? "Save example"
                        : "Add example"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      setEditingExampleId(null);
                      setExampleDraft(nextExampleDraft(problem));
                    }}
                  >
                    New example
                  </Button>
                  {editingExampleId ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canEditAdvanced || deleteExampleMutation.isPending}
                      onClick={() => deleteExampleMutation.mutate(editingExampleId)}
                    >
                      {deleteExampleMutation.isPending ? "Deleting..." : "Delete example"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {saveExampleMutation.error?.message || deleteExampleMutation.error?.message ? (
            <p className="mt-4 text-sm text-destructive">
              {saveExampleMutation.error?.message ?? deleteExampleMutation.error?.message}
            </p>
          ) : null}
        </Panel>

        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Pill tone="accent">Tests</Pill>
            <span className="text-sm text-muted-foreground">
              Keep at least one hidden test. Visible tests help players understand the task, while hidden ones keep the final check fair.
            </span>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] 2xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]">
            <div className="min-w-0 space-y-3 xl:max-h-[700px] xl:overflow-y-auto xl:pr-2">
              {problem?.tests.length ? (
                problem.tests.map((test, index) => (
                  <Card
                    key={test.id}
                    className={`cursor-pointer border-border/80 shadow-none transition-colors ${
                      editingTestId === test.id ? "bg-muted" : "bg-white hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      setEditingTestId(test.id);
                      setTestDraft({
                        input_data: test.input_data,
                        expected_output: test.expected_output,
                        kind: test.kind,
                        weight: test.weight,
                        order_index: test.order_index
                      });
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">Test {index + 1}</div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{testKindLabel(test.kind)}</Badge>
                          <Badge variant="outline">weight {test.weight}</Badge>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={!canEditAdvanced || deleteTestMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteTestMutation.mutate(test.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {test.input_data || "Empty input"}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-border/80 bg-white shadow-none">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No checks yet. You need at least three tests and at least one hidden test before validation.
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <Label>Test input</Label>
                <Textarea
                  value={testDraft.input_data}
                  placeholder="What data should be sent to the solution?"
                  onChange={(event) => setTestDraft((prev) => ({ ...prev, input_data: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Expected output</Label>
                <Textarea
                  value={testDraft.expected_output}
                  placeholder="What output should the checker accept?"
                  onChange={(event) =>
                    setTestDraft((prev) => ({ ...prev, expected_output: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Test type</Label>
                  <Select value={testDraft.kind} onValueChange={(value) => setTestDraft((prev) => ({ ...prev, kind: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a test type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sample">Visible example</SelectItem>
                      <SelectItem value="hidden">Hidden checker</SelectItem>
                      <SelectItem value="edge">Edge case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Weight</Label>
                  <Input
                    type="number"
                    value={testDraft.weight}
                    onChange={(event) => setTestDraft((prev) => ({ ...prev, weight: Number(event.target.value) }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={testDraft.order_index}
                    onChange={(event) =>
                      setTestDraft((prev) => ({ ...prev, order_index: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Button type="button" disabled={!canEditAdvanced} onClick={() => saveTestMutation.mutate()}>
                    {saveTestMutation.isPending
                      ? "Saving..."
                      : editingTestId
                        ? "Save test"
                        : "Add test"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      setEditingTestId(null);
                      setTestDraft(nextTestDraft(problem));
                    }}
                  >
                    New test
                  </Button>
                  {editingTestId ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canEditAdvanced || deleteTestMutation.isPending}
                      onClick={() => deleteTestMutation.mutate(editingTestId)}
                    >
                      {deleteTestMutation.isPending ? "Deleting..." : "Delete test"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {saveTestMutation.error?.message || deleteTestMutation.error?.message ? (
            <p className="mt-4 text-sm text-destructive">
              {saveTestMutation.error?.message ?? deleteTestMutation.error?.message}
            </p>
          ) : null}
        </Panel>

        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Pill tone="warn">Reference solution</Pill>
            <span className="text-sm text-muted-foreground">
              This is the solution we use to verify that your task is solvable and your tests are correct.
            </span>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {[
              {
                title: "1. Save the code",
                done: hasReferenceSolution && !hasUnsavedReferenceChanges,
                active: hasUnsavedReferenceChanges || !hasReferenceSolution,
                body: hasReferenceSolution && !hasUnsavedReferenceChanges
                  ? "The latest code is already saved."
                  : "Store the latest version of the solution from the editor."
              },
              {
                title: "2. Check the solution",
                done: referencePassed,
                active: validationInProgress || (hasReferenceSolution && !referencePassed),
                body: validationInProgress
                  ? "The check is running now."
                  : referencePassed
                    ? "The saved solution passed the current tests."
                    : "Run the check to make sure this version really works."
              },
              {
                title: "3. Publish for duels",
                done: isPublishedLive,
                active: !isPublishedLive,
                body: isPublishedLive
                  ? "This task is already live in duel rooms."
                  : canPublish
                    ? "Everything is ready. Publish this version to make it available in duel rooms."
                  : nextAction
              }
            ].map((step) => (
              <Card
                key={step.title}
                className={`shadow-none ${
                  step.done
                    ? "border-emerald-200 bg-emerald-50"
                    : step.active
                      ? "border-border/80 bg-white"
                      : "border-border/60 bg-muted/20"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        step.done ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 min-w-0 overflow-hidden rounded-[1.25rem] border border-border/80 bg-white">
            <CodeEditor value={referenceCode} onChange={setReferenceCode} height={540} />
          </div>
          <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={!canEditAdvanced} onClick={() => referenceMutation.mutate()}>
                  {referenceMutation.isPending ? "Saving..." : "Save code"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canEditAdvanced || validationInProgress}
                  onClick={() => validateMutation.mutate()}
                >
                  {validateMutation.isPending || validationInProgress
                    ? "Checking..."
                    : hasUnsavedReferenceChanges
                      ? "Save and check solution"
                      : "Check solution"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  disabled={!canEditAdvanced || !canPublish || validationInProgress}
                  onClick={() => publishMutation.mutate()}
                >
                  {publishMutation.isPending ? "Publishing..." : isPublishedLive ? "Already live" : "Publish for duels"}
                </Button>
              </div>
              {referenceMutation.error?.message || validateMutation.error?.message || publishMutation.error?.message ? (
                <p className="mt-3 text-sm text-destructive">
                  {referenceMutation.error?.message ??
                    validateMutation.error?.message ??
                    publishMutation.error?.message}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">{referenceStatus.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{referenceStatus.description}</p>
              {!canPublish ? (
                <p className="mt-2 text-sm leading-6 text-amber-700">Next step: {nextAction}</p>
              ) : null}
              {problem?.reference_solution?.last_validated_at ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last successful check: {formatDateTime(problem.reference_solution.last_validated_at)}
                </p>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <div className="min-w-0 space-y-6 xl:sticky xl:top-4 xl:self-start">
        <Panel className="min-w-0">
          <Pill>Checklist</Pill>
          <div className="mt-5 space-y-3 text-sm">
            {[
              {
                label: "Draft basics saved",
                ok: Boolean(problemId || basics.title.length >= 3)
              },
              {
                label: "At least one visible example",
                ok: stats.examples > 0
              },
              {
                label: "At least three tests",
                ok: stats.tests >= 3
              },
              {
                label: "At least one hidden test",
                ok: stats.hiddenTests >= 1
              },
              {
                label: "Reference solution saved",
                ok: Boolean(problem?.reference_solution)
              },
              {
                label: "Reference solution passed the check",
                ok: referencePassed
              }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white p-3">
                <CheckCircle2 className={`h-4 w-4 ${item.ok ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="min-w-0">
          <Pill tone="accent">Status</Pill>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border-border/80 bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Current state</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Status: {statusLabel}</p>
                <p>Examples: {stats.examples}</p>
                <p>Tests: {stats.tests}</p>
                <p>Published versions: {stats.versions}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Last update</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{problem ? formatDateTime(problem.updated_at) : "The draft will appear here after creation."}</p>
                {problem?.active_version_id ? <p>Published version: {problem.active_version_id}</p> : <p>Not published yet.</p>}
              </CardContent>
            </Card>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <Pill>How publishing works</Pill>
          <div className="mt-4 space-y-3">
            {[
              {
                icon: PencilLine,
                title: "Write the task",
                body: "Describe the goal, input, output and limits in a way that a player can understand at a glance."
              },
              {
                icon: FlaskConical,
                title: "Add examples and tests",
                body: "Use visible examples for clarity and hidden tests for the real check."
              },
              {
                icon: FileCode2,
                title: "Save a working solution",
                body: "This is the code the system uses to verify that the task is solvable."
              },
              {
                icon: Sparkles,
                title: "Check, then publish",
                body: "After the solution passes the tests, the task becomes ready and you can publish it for duels."
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-border/80 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {problemId ? (
            <div className="mt-4 space-y-3">
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href={`/app/problems/${problemId}`}>
                  Open preview
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={deleteProblemMutation.isPending}
                onClick={() => deleteProblemMutation.mutate()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteProblemMutation.isPending ? "Deleting problem..." : "Delete problem"}
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
