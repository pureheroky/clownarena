"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { AppContentFallback } from "@/components/app-content-fallback";
import { useFeedback } from "@/components/feedback-provider";
import { Panel, Pill } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, Duel, DuelCatalogProblem } from "@/lib/api";
import { difficultyLabel, duelRoomTypeLabel } from "@/lib/formatters";
import { useSession } from "@/lib/use-session";

type RoomType = "rated" | "practice";

function filterProblems(items: DuelCatalogProblem[], search: string) {
  const normalized = search.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((problem) =>
        `${problem.title} ${problem.slug} ${problem.author_username}`.toLowerCase().includes(normalized)
      )
    : items;
  return filtered.slice(0, 60);
}

function ProblemPicker({
  items,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  placeholder,
  emptyTitle,
  emptyDescription,
  isPractice
}: {
  items: DuelCatalogProblem[];
  selectedId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder: string;
  emptyTitle: string;
  emptyDescription: string;
  isPractice: boolean;
}) {
  const filtered = useMemo(() => filterProblems(items, search), [items, search]);

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        className="border-white/15 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/45"
      />
      <div className="rounded-[1.35rem] border border-white/12 bg-white/6 p-2">
        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-2">
            {filtered.map((problem) => {
              const selected = problem.active_version_id === selectedId;
              return (
                <button
                  key={problem.active_version_id}
                  type="button"
                  onClick={() => onSelect(problem.active_version_id)}
                  className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-white/0 bg-white text-primary"
                      : "border-white/10 bg-white/8 text-primary-foreground hover:bg-white/14"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{problem.title}</p>
                      <p
                        className={`mt-1 text-xs ${
                          selected ? "text-primary/70" : "text-primary-foreground/65"
                        }`}
                      >
                        {isPractice ? "Your published task" : `by ${problem.author_username}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs uppercase tracking-[0.2em] ${
                        selected ? "text-primary/60" : "text-primary-foreground/55"
                      }`}
                    >
                      {difficultyLabel(problem.difficulty)}
                    </span>
                  </div>
                </button>
              );
            })}
            {!filtered.length ? (
              <Card className="border-white/10 bg-white/10 text-primary-foreground shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{emptyTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-primary-foreground/75">{emptyDescription}</p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </ScrollArea>
      </div>
      {items.length > filtered.length ? (
        <p className="text-xs text-primary-foreground/65">
          Showing the first {filtered.length} matches. Narrow the search to find a specific task faster.
        </p>
      ) : null}
    </div>
  );
}

export default function PrivateDuelPage() {
  const { notify } = useFeedback();
  const { isAuthenticated, isLoading } = useSession();
  const [created, setCreated] = useState<Duel | null>(null);
  const [roomType, setRoomType] = useState<RoomType>("rated");
  const [ratedProblemVersionId, setRatedProblemVersionId] = useState("");
  const [practiceProblemVersionId, setPracticeProblemVersionId] = useState("");
  const [ratedSearch, setRatedSearch] = useState("");
  const [practiceSearch, setPracticeSearch] = useState("");
  const [stakeAmount, setStakeAmount] = useState(25);
  const [joinCode, setJoinCode] = useState("");

  const catalogQuery = useQuery({
    queryKey: ["duel-catalog"],
    queryFn: api.duelCatalog,
    enabled: isAuthenticated
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedRoomType = searchParams.get("roomType");
    const requestedProblemVersionId = searchParams.get("problemVersionId");
    if (requestedRoomType === "practice") {
      setRoomType("practice");
      if (requestedProblemVersionId) {
        setPracticeProblemVersionId(requestedProblemVersionId);
      }
      return;
    }
    if (requestedProblemVersionId) {
      setRatedProblemVersionId(requestedProblemVersionId);
    }
  }, []);

  const ratedProblems = catalogQuery.data?.rated ?? [];
  const practiceProblems = catalogQuery.data?.practice ?? [];
  const selectedProblemVersionId =
    roomType === "rated" ? ratedProblemVersionId : practiceProblemVersionId;

  const selectedProblem = useMemo(() => {
    const source = roomType === "rated" ? ratedProblems : practiceProblems;
    return source.find((item) => item.active_version_id === selectedProblemVersionId);
  }, [practiceProblems, ratedProblems, roomType, selectedProblemVersionId]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createPrivateDuel({
        room_type: roomType,
        problem_version_id: selectedProblemVersionId,
        stake_amount: roomType === "rated" ? stakeAmount : 0
      }),
    onSuccess: (duel) => {
      setCreated(duel);
      notify({
        tone: "success",
        title: roomType === "rated" ? "Rated room created" : "Practice room created",
        description:
          roomType === "rated"
            ? "Share the room code with your opponent to start the rated match."
            : "Share the room code to practice on your published task."
      });
    }
  });

  const joinMutation = useMutation({
    mutationFn: () => api.joinPrivateDuel(joinCode),
    onSuccess: (duel) => {
      setCreated(duel);
      notify({
        tone: "success",
        title: "Room joined",
        description: "The duel room is ready. Enter the room and confirm you are ready."
      });
    }
  });

  if (isLoading) {
    return (
      <AppContentFallback
        title="Preparing private duel setup"
        description="Loading published tasks, room types and join actions."
      />
    );
  }

  if (!isAuthenticated) {
    return <Panel>Sign in first to create or join a private room.</Panel>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] 2xl:grid-cols-[minmax(0,1.3fr)_minmax(380px,0.8fr)]">
      <Panel className="min-w-0 bg-primary text-primary-foreground">
        <Pill tone="accent">Create room</Pill>
        <h1 className="mt-4 text-4xl font-semibold">Open a private duel room.</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-primary-foreground/75">
          Rated rooms use published tasks from other players and keep stakes on. Practice rooms use one of your own
          published tasks and never change rating or tokens.
        </p>

        <Tabs
          value={roomType}
          onValueChange={(value) => setRoomType(value as RoomType)}
          className="mt-6"
        >
          <TabsList className="grid w-full grid-cols-2 bg-white/10">
            <TabsTrigger value="rated">Rated room</TabsTrigger>
            <TabsTrigger value="practice">Practice room</TabsTrigger>
          </TabsList>

          <TabsContent value="rated" className="mt-5 space-y-5">
            <ProblemPicker
              items={ratedProblems}
              selectedId={ratedProblemVersionId}
              search={ratedSearch}
              onSearchChange={setRatedSearch}
              onSelect={setRatedProblemVersionId}
              placeholder="Search by task title, slug or author"
              emptyTitle={ratedSearch ? "No tasks match this search" : "No rated tasks available right now"}
              emptyDescription={
                ratedSearch
                  ? "Try another title, slug or author name."
                  : "Rated rooms only list published duel tasks from other authors."
              }
              isPractice={false}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-medium">Room impact</p>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/75">
                  Rated rooms reserve the chosen stake from both players, update rating after the duel and settle the
                  token pot at the end.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-primary-foreground/65">Stake</label>
                <Input
                  className="border-white/15 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/45"
                  type="number"
                  min={25}
                  max={500}
                  value={stakeAmount}
                  onChange={(event) => setStakeAmount(Number(event.target.value))}
                />
                <p className="text-xs text-primary-foreground/65">Choose between 25 and 500 clown tokens.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="practice" className="mt-5 space-y-5">
            <ProblemPicker
              items={practiceProblems}
              selectedId={practiceProblemVersionId}
              search={practiceSearch}
              onSearchChange={setPracticeSearch}
              onSelect={setPracticeProblemVersionId}
              placeholder="Search your published tasks"
              emptyTitle={practiceSearch ? "No tasks match this search" : "No practice task available yet"}
              emptyDescription={
                practiceSearch
                  ? "Try another title or slug from your own published tasks."
                  : "Publish one of your own duel-ready tasks first. It will appear here as soon as it goes live."
              }
              isPractice
            />

            <Card className="border-white/10 bg-white/10 text-primary-foreground shadow-none">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Practice rooms do not affect rating or tokens</p>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/75">
                  Use this mode to rehearse on your own published task, review pacing or test the full duel flow with a
                  friend.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedProblem ? (
          <Card className="mt-5 border-white/10 bg-white/10 text-primary-foreground shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{difficultyLabel(selectedProblem.difficulty)}</Pill>
                <Pill tone="accent">
                  {roomType === "rated" ? selectedProblem.author_username : "Your published task"}
                </Pill>
              </div>
              <p className="mt-4 text-lg font-medium">{selectedProblem.title}</p>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/78">{selectedProblem.description}</p>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!selectedProblemVersionId}
            onClick={() => createMutation.mutate()}
            className="bg-white text-primary hover:bg-white/92"
          >
            {createMutation.isPending
              ? "Creating..."
              : roomType === "rated"
                ? "Create rated room"
                : "Create practice room"}
          </Button>
          <p className="text-sm text-primary-foreground/72">
            {roomType === "rated"
              ? "The room code appears as soon as the room is created."
              : "Practice rooms always start with zero stake."}
          </p>
        </div>
        <p className="mt-3 text-sm text-amber-200">{createMutation.error?.message}</p>
      </Panel>

      <div className="space-y-6">
        <Panel>
          <Pill>Join room</Pill>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">Use a room code.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Paste the code you received from the other player and jump straight into the room.
          </p>
          <Input
            className="mt-6"
            placeholder="Enter the room code you received"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
          <Button type="button" onClick={() => joinMutation.mutate()} className="mt-4">
            {joinMutation.isPending ? "Joining..." : "Join by code"}
          </Button>
          <p className="mt-3 text-sm text-destructive">{joinMutation.error?.message}</p>
        </Panel>

        {created ? (
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">{duelRoomTypeLabel(created.room_type)}</Pill>
              <Pill>{created.stake_amount ? `${created.stake_amount} tokens` : "No stakes"}</Pill>
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.24em] text-muted-foreground">Room code</p>
            <p className="mt-2 text-4xl font-semibold uppercase tracking-[0.12em] text-foreground">
              {created.room_code}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {created.room_type === "rated"
                ? "This room affects both rating and token balance."
                : "This room is practice-only and does not affect rating or tokens."}
            </p>
            <Button asChild className="mt-5">
              <Link href={`/app/duels/${created.id}`}>Enter duel room</Link>
            </Button>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
