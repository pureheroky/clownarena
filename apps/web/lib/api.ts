export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ApiUser = {
  id: string;
  username: string;
  email: string;
  rating: number;
  clown_tokens_balance: number;
  last_daily_claim_at: string | null;
  created_at: string;
};

export type WalletTransaction = {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type Wallet = {
  balance: number;
  last_daily_claim_at: string | null;
  next_daily_claim_at: string | null;
  transactions: WalletTransaction[];
};

export type Problem = {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  description: string;
  input_spec: string;
  output_spec: string;
  constraints_text: string;
  difficulty: number;
  status: string;
  is_public: boolean;
  is_duel_enabled: boolean;
  is_template_seeded: boolean;
  active_version_id: string | null;
  validation_notes: string | null;
  created_at: string;
  updated_at: string;
  examples: Array<{
    id: string;
    input_data: string;
    output_data: string;
    explanation: string | null;
    order_index: number;
  }>;
  tests: Array<{
    id: string;
    input_data: string;
    expected_output: string;
    kind: string;
    weight: number;
    order_index: number;
  }>;
  reference_solution: {
    id: string;
    language: string;
    code: string;
    validation_status: string;
    needs_validation: boolean;
    validation_error: string | null;
    last_validated_at: string | null;
    updated_at: string;
  } | null;
  versions: Array<{
    id: string;
    version_number: number;
    snapshot_json: Record<string, unknown>;
    created_at: string;
  }>;
};

export type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
  difficulty: number;
  status: string;
  is_template_seeded: boolean;
  active_version_id: string | null;
  validation_notes: string | null;
  updated_at: string;
  tests_count: number;
  examples_count: number;
};

export type DuelCatalogProblem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: number;
  active_version_id: string;
  author_id: string;
  author_username: string;
  updated_at: string;
};

export type DuelCatalog = {
  rated: DuelCatalogProblem[];
  practice: DuelCatalogProblem[];
};

export type Duel = {
  id: string;
  problem_id: string;
  problem_version_id: string;
  created_by: string;
  player1_id: string;
  player2_id: string | null;
  status: string;
  duel_mode: string;
  room_type: "rated" | "practice";
  max_duration_sec: number;
  stake_amount: number;
  room_code: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
  countdown_started_at: string | null;
  ready_deadline_at: string | null;
  winner_id: string | null;
  ended_reason: string | null;
  created_at: string;
  problem_snapshot: {
    title: string;
    description: string;
    input_spec: string;
    output_spec: string;
    constraints_text: string;
    difficulty: number;
    examples: Array<{
      input_data: string;
      output_data: string;
      explanation: string | null;
      order_index: number;
    }>;
    visible_tests: Array<{
      input_data: string;
      expected_output: string;
      order_index: number;
    }>;
  };
  participants: Array<{
    id: string;
    user_id: string;
    username: string;
    seat: number;
    joined_at: string;
    ready_at: string | null;
    final_status: string;
    penalty_seconds: number;
    accepted_at: string | null;
    best_passed_weight: number;
    best_submission_at: string | null;
    disconnect_deadline_at: string | null;
    opponent_progress: string;
  }>;
  stakes: Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    created_at: string;
    settled_at: string | null;
  }>;
  submissions: Array<{
    id: string;
    duel_id: string;
    user_id: string;
    problem_id: string;
    problem_version_id: string;
    language: string;
    status: string;
    passed_tests: number;
    total_tests: number;
    passed_weight: number;
    execution_time_ms: number | null;
    memory_kb: number | null;
    stdout_text: string | null;
    stderr_text: string | null;
    sample_results_json: Array<{
      input_data: string;
      expected_output: string;
      actual_output: string;
      stderr: string;
      status: string;
      execution_time_ms: number | null;
      memory_kb: number | null;
    }>;
    created_at: string;
    finished_at: string | null;
  }>;
};

export type MatchHistoryItem = {
  duel: Duel;
  rating_delta: number;
  wallet_delta: number;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  rating: number;
  clown_tokens_balance: number;
};

export type Leaderboards = {
  rating: LeaderboardEntry[];
  tokens: LeaderboardEntry[];
};

type RequestOptions = RequestInit & {
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "include"
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(response.status, data.detail ?? "Request failed");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  register: (payload: { username: string; email: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<ApiUser>("/auth/me"),
  profile: (username: string) => request<ApiUser>(`/profile/${username}`),
  wallet: () => request<Wallet>("/wallet"),
  claimDaily: () =>
    request<{ balance: number; claimed_amount: number; next_daily_claim_at: string }>(
      "/wallet/daily-claim",
      { method: "POST" }
    ),
  createProblem: (payload: Record<string, unknown>) =>
    request<Problem>("/problems", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateProblem: (problemId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteProblem: (problemId: string) =>
    request<void>(`/problems/${problemId}`, {
      method: "DELETE"
    }),
  addExample: (problemId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/examples`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateExample: (problemId: string, exampleId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/examples/${exampleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteExample: (problemId: string, exampleId: string) =>
    request<Problem>(`/problems/${problemId}/examples/${exampleId}`, {
      method: "DELETE"
    }),
  addTest: (problemId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/tests`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateTest: (problemId: string, testId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/tests/${testId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteTest: (problemId: string, testId: string) =>
    request<Problem>(`/problems/${problemId}/tests/${testId}`, {
      method: "DELETE"
    }),
  upsertReference: (problemId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/reference-solution`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  validateProblem: (problemId: string) =>
    request<Problem>(`/problems/${problemId}/validate`, { method: "POST" }),
  publishProblem: (problemId: string, payload: Record<string, unknown>) =>
    request<Problem>(`/problems/${problemId}/publish`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  myProblems: () => request<ProblemSummary[]>("/problems/mine"),
  duelCatalog: () => request<DuelCatalog>("/problems/duel-catalog"),
  problem: (problemId: string) => request<Problem>(`/problems/${problemId}`),
  leaderboards: () => request<Leaderboards>("/leaderboards"),
  createPrivateDuel: (payload: Record<string, unknown>) =>
    request<Duel>("/duels/private", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  joinPrivateDuel: (room_code: string) =>
    request<Duel>("/duels/join-by-code", {
      method: "POST",
      body: JSON.stringify({ room_code })
    }),
  readyUp: (duelId: string) =>
    request<Duel>(`/duels/${duelId}/ready`, { method: "POST" }),
  submit: (duelId: string, payload: Record<string, unknown>) =>
    request<Duel["submissions"][number]>(`/duels/${duelId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  duel: (duelId: string) => request<Duel>(`/duels/${duelId}`),
  history: () => request<MatchHistoryItem[]>("/duels/history")
};
