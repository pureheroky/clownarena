"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { AppContentFallback } from "@/components/app-content-fallback";
import { CodeEditor } from "@/components/code-editor";
import { DuelFeed } from "@/components/duel-feed";
import { useFeedback } from "@/components/feedback-provider";
import { Panel, Pill } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL, api } from "@/lib/api";
import { duelRoomTypeLabel, duelStatusLabel, formatDateTime } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

type LiveEvent = {
  event: string;
  duel_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default function ActiveDuelPage() {
  const params = useParams<{ id: string }>();
  const { notify } = useFeedback();
  const { user, isAuthenticated, isLoading } = useSession();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [code, setCode] = useState(
    "import sys\n\n\ndef solve(data: str) -> str:\n    return data.strip()\n\n\nif __name__ == '__main__':\n    print(solve(sys.stdin.read()))"
  );
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const duelQuery = useQuery({
    queryKey: ["duel", params.id],
    queryFn: () => api.duel(params.id),
    enabled: Boolean(isAuthenticated && params.id),
    refetchInterval: (query) => {
      const duel = query.state.data;
      if (!duel) {
        return 4_000;
      }
      return duel.status === "finished" || duel.status === "cancelled" || duel.status === "expired"
        ? false
        : 4_000;
    }
  });

  useEffect(() => {
    if (!isAuthenticated || !params.id) return;
    const socket = new WebSocket(`${API_URL.replace("http", "ws")}/ws/duels/${params.id}`);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as LiveEvent;
      setEvents((current) => [payload, ...current].slice(0, 20));
      void queryClient.invalidateQueries({ queryKey: ["duel", params.id] });
    };
    return () => socket.close();
  }, [isAuthenticated, params.id, queryClient]);

  const readyMutation = useMutation({
    mutationFn: () => api.readyUp(params.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duel", params.id] });
      notify({
        tone: "success",
        title: "Ready confirmed",
        description: "You are marked as ready for the room countdown."
      });
    }
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submit(params.id, { code, language: "python" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duel", params.id] });
      notify({
        tone: "success",
        title: "Submission sent",
        description: "Your Python solution is now being checked."
      });
    }
  });

  const currentParticipant = useMemo(
    () => duelQuery.data?.participants.find((participant) => participant.user_id === user?.id),
    [duelQuery.data?.participants, user?.id]
  );
  const opponent = useMemo(
    () => duelQuery.data?.participants.find((participant) => participant.user_id !== user?.id),
    [duelQuery.data?.participants, user?.id]
  );
  const latestSubmission = useMemo(
    () => duelQuery.data?.submissions.find((submission) => submission.user_id === user?.id),
    [duelQuery.data?.submissions, user?.id]
  );
  const participantsBySeat = useMemo(
    () => [...(duelQuery.data?.participants ?? [])].sort((left, right) => left.seat - right.seat),
    [duelQuery.data?.participants]
  );
  const winnerParticipant = useMemo(
    () => duelQuery.data?.participants.find((participant) => participant.user_id === duelQuery.data?.winner_id),
    [duelQuery.data?.participants, duelQuery.data?.winner_id]
  );
  const duelFinished = duelQuery.data?.status === "finished";
  const resultHeadline = useMemo(() => {
    if (!duelQuery.data) {
      return "";
    }
    if (duelQuery.data.ended_reason === "draw") {
      return "Draw";
    }
    if (winnerParticipant) {
      return `${winnerParticipant.username} wins`;
    }
    return "Duel finished";
  }, [duelQuery.data, winnerParticipant]);
  const resultSubline = useMemo(() => {
    if (!duelQuery.data) {
      return "";
    }
    if (duelQuery.data.winner_id === user?.id) {
      return "You solved it first.";
    }
    if (duelQuery.data.winner_id && duelQuery.data.winner_id !== user?.id && winnerParticipant) {
      return `${winnerParticipant.username} finished ahead of the other player.`;
    }
    return "The room ended without a single winner.";
  }, [duelQuery.data, user?.id, winnerParticipant]);

  useEffect(() => {
    if (duelFinished) {
      setShowFinishedModal(true);
      return;
    }
    setShowFinishedModal(false);
  }, [duelFinished, duelQuery.data?.id]);

  if (isLoading) {
    return (
      <AppContentFallback
        title="Opening duel room"
        description="Syncing the match state, event feed and your latest room data."
      />
    );
  }

  if (!isAuthenticated || !user) {
    return <Panel>Sign in first to enter this duel room.</Panel>;
  }

  if (!duelQuery.data) {
    return (
      <AppContentFallback
        title="Syncing duel state"
        description="Waiting for the latest room update before rendering the live match."
      />
    );
  }

  return (
    <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.95fr)]">
      <AnimatePresence>
        {duelFinished && showFinishedModal ? (
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/42 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-2xl rounded-[2rem] border border-border/80 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            >
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Duel finished</p>
                <h2 className="mt-4 text-4xl font-semibold text-foreground">{resultHeadline}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{resultSubline}</p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr]">
                <Card className="border-border/80 bg-muted/50 shadow-none">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Player one</p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {participantsBySeat[0]?.username ?? "Waiting..."}
                    </p>
                  </CardContent>
                </Card>
                <div className="flex items-center justify-center text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
                  vs
                </div>
                <Card className="border-border/80 bg-muted/50 shadow-none">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Player two</p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {participantsBySeat[1]?.username ?? "Waiting..."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link href="/app">Go to overview</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  onClick={() => {
                    setShowFinishedModal(false);
                    resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  View duel results
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Panel className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="accent">{duelStatusLabel(duelQuery.data.status)}</Pill>
          <Pill>{duelRoomTypeLabel(duelQuery.data.room_type)}</Pill>
          <Pill>Room {duelQuery.data.room_code}</Pill>
          <Pill tone="warn">
            {duelQuery.data.room_type === "rated"
              ? `Stake ${duelQuery.data.stake_amount}`
              : "No stakes"}
          </Pill>
        </div>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">Live duel room</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/80 bg-muted/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">You</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {currentParticipant?.username ?? user.username}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Penalty: {currentParticipant?.penalty_seconds ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/80 bg-white shadow-none">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Opponent</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{opponent?.username ?? "Waiting..."}</p>
              <p className="mt-2 text-sm capitalize text-muted-foreground">
                Progress: {opponent?.opponent_progress ?? "thinking"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Ready: {opponent?.ready_at ? "yes" : "no"}</p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => readyMutation.mutate()}
            disabled={duelQuery.data.status !== "waiting_for_opponent"}
          >
            {readyMutation.isPending ? "Readying..." : "Ready"}
          </Button>
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            variant="secondary"
            disabled={duelQuery.data.status !== "active"}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Python"}
          </Button>
        </div>
        {readyMutation.error?.message || submitMutation.error?.message ? (
          <p className="mt-3 text-sm text-destructive">
            {readyMutation.error?.message ?? submitMutation.error?.message}
          </p>
        ) : null}
        <div className="mt-6 min-w-0 overflow-hidden rounded-[1.35rem] border border-border/80 bg-white">
          <CodeEditor value={code} onChange={setCode} />
        </div>

        <div className="mt-8 space-y-6">
          <Pill>Task</Pill>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">
            {duelQuery.data.problem_snapshot.title}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {duelQuery.data.problem_snapshot.description}
          </p>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Input</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {duelQuery.data.problem_snapshot.input_spec}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Output</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {duelQuery.data.problem_snapshot.output_spec}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Constraints</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {duelQuery.data.problem_snapshot.constraints_text}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 2xl:grid-cols-2">
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Examples</p>
                <div className="mt-4 space-y-4">
                  {duelQuery.data.problem_snapshot.examples.map((example, index) => (
                    <div key={`${example.order_index}-${index}`} className="rounded-2xl border border-border/70 bg-muted/40 p-4">
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
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Visible tests</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  These are the public sample checks you can use while solving the task.
                </p>
                <div className="mt-4 space-y-4">
                  {duelQuery.data.problem_snapshot.visible_tests.map((testCase, index) => (
                    <div key={`${testCase.order_index}-${index}`} className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                      <p className="text-sm font-medium text-foreground">Sample test {index + 1}</p>
                      <div className="mt-3 grid gap-3 2xl:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Input</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{testCase.input_data}</pre>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected output</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-foreground">{testCase.expected_output}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!duelQuery.data.problem_snapshot.visible_tests.length ? (
                    <p className="text-sm text-muted-foreground">This task has no public sample tests.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Panel>

      <div className="min-w-0 space-y-6">
        {duelFinished ? (
          <div ref={resultSectionRef}>
            <Panel>
              <Pill tone="accent">Results</Pill>
              <h2 className="mt-4 text-3xl font-semibold text-foreground">{resultHeadline}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{resultSubline}</p>
              <div className="mt-6 grid gap-4">
                {participantsBySeat.map((participant) => (
                  <Card key={participant.id} className="border-border/80 bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-foreground">{participant.username}</p>
                          <p className="mt-1 text-sm capitalize text-muted-foreground">
                            {participant.final_status.replaceAll("_", " ")}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>Penalty: {participant.penalty_seconds}s</p>
                          <p>
                            Accepted: {participant.accepted_at ? formatDateTime(participant.accepted_at) : "No"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
        <Panel>
          <Pill>Room summary</Pill>
          <div className="mt-4 grid gap-3">
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Room type</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {duelRoomTypeLabel(duelQuery.data.room_type)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {duelQuery.data.room_type === "rated"
                    ? "This room changes both rating and token balance."
                    : "This room is practice-only and does not affect rating or tokens."}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current phase</p>
                <p className="mt-2 text-xl font-semibold capitalize text-foreground">
                  {duelStatusLabel(duelQuery.data.status)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Opponent progress: {opponent?.opponent_progress ?? "thinking"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/80 bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Latest submission</p>
                <p className="mt-2 text-xl font-semibold capitalize text-foreground">
                  {latestSubmission?.status?.replaceAll("_", " ") ?? "Nothing submitted yet"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {latestSubmission
                    ? `${latestSubmission.passed_tests}/${latestSubmission.total_tests} tests passed`
                    : "Submit a Python solution to see the latest result here."}
                </p>
              </CardContent>
            </Card>
          </div>
        </Panel>
        <Panel>
          <Pill>Visible output</Pill>
          {!latestSubmission ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Submit once to inspect your output on the public sample tests.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {latestSubmission.sample_results_json.length ? (
                latestSubmission.sample_results_json.map((result, index) => (
                  <Card key={`${index}-${result.status}`} className="border-border/80 bg-white shadow-none">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">Sample run {index + 1}</p>
                        <Badge variant="outline" className="capitalize">
                          {result.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Input</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/45 p-3 text-xs text-foreground">{result.input_data}</pre>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected output</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/45 p-3 text-xs text-foreground">{result.expected_output}</pre>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your output</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/45 p-3 text-xs text-foreground">{result.actual_output || "(empty output)"}</pre>
                        </div>
                      </div>
                      {result.stderr ? (
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Error output</p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-rose-50 p-3 text-xs text-rose-900">{result.stderr}</pre>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <Card className="border-border/80 bg-white shadow-none">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Program output</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/45 p-3 text-xs text-foreground">
                        {latestSubmission.stdout_text || "(empty output)"}
                      </pre>
                    </CardContent>
                  </Card>
                  {latestSubmission.stderr_text ? (
                    <Card className="border-border/80 bg-white shadow-none">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Error output</p>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-rose-50 p-3 text-xs text-rose-900">
                          {latestSubmission.stderr_text}
                        </pre>
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              )}
            </div>
          )}
        </Panel>
        <Panel>
          <Pill>Event feed</Pill>
          <ScrollArea className="mt-4 h-[480px] pr-2">
            <DuelFeed events={events} />
          </ScrollArea>
        </Panel>
      </div>
    </div>
  );
}
