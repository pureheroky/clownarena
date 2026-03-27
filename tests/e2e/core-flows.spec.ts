import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
const sampleProblems = JSON.parse(
  readFileSync(path.join(process.cwd(), "docs", "sample-problems.json"), "utf8")
) as SampleProblem[];

type Credentials = {
  username: string;
  email: string;
  password: string;
};

type ProblemSummary = {
  id: string;
  title: string;
};

type ProblemResponse = {
  id: string;
  title: string;
  status: string;
  active_version_id: string | null;
  reference_solution: {
    validation_status: string;
    needs_validation: boolean;
  } | null;
};

type DuelResponse = {
  id: string;
  room_code: string;
  room_type: "rated" | "practice";
  status: string;
  ended_reason: string | null;
};

type SampleProblem = {
  title: string;
  description: string;
  input_spec: string;
  output_spec: string;
  constraints_text: string;
  difficulty: number;
  examples: Array<{
    input_data: string;
    output_data: string;
    explanation?: string;
  }>;
  tests: Array<{
    input_data: string;
    expected_output: string;
    kind: "sample" | "hidden" | "edge";
    weight: number;
  }>;
  reference_solution: {
    code: string;
  };
};

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueCredentials(prefix: string): Credentials {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    username: `${prefix}-${token}`.slice(0, 30),
    email: `${prefix}-${token}@example.com`,
    password: "arena-pass-123"
  };
}

async function expectOk(response: { ok(): boolean; status(): number }, message: string) {
  expect(response.ok(), `${message} (status ${response.status()})`).toBeTruthy();
}

async function registerThroughApi(context: BrowserContext, credentials: Credentials) {
  const response = await context.request.post(`${API_URL}/auth/register`, {
    data: credentials
  });
  await expectOk(response, "register request failed");
}

async function waitForOwnedProblem(context: BrowserContext, title: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await context.request.get(`${API_URL}/problems/mine`);
    await expectOk(response, "loading owned problems failed");
    const problems = (await response.json()) as ProblemSummary[];
    const match = problems.find((item) => item.title === title);
    if (match) {
      return match;
    }
    await wait(1_000);
  }
  throw new Error(`Problem "${title}" was not found in owned problems.`);
}

async function getProblem(context: BrowserContext, problemId: string) {
  const response = await context.request.get(`${API_URL}/problems/${problemId}`);
  await expectOk(response, "loading problem failed");
  return (await response.json()) as ProblemResponse;
}

async function waitForProblemReady(context: BrowserContext, problemId: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const problem = await getProblem(context, problemId);
    if (
      problem.status === "ready_for_duel" &&
      problem.reference_solution?.validation_status === "accepted" &&
      !problem.reference_solution.needs_validation
    ) {
      return problem;
    }
    await wait(2_000);
  }
  throw new Error(`Problem ${problemId} did not become ready_for_duel in time.`);
}

async function createPublishedProblem(
  context: BrowserContext,
  template: SampleProblem,
  titleSuffix: string
) {
  const createResponse = await context.request.post(`${API_URL}/problems`, {
    data: {
      title: `${template.title} ${titleSuffix}`,
      description: template.description,
      input_spec: template.input_spec,
      output_spec: template.output_spec,
      constraints_text: template.constraints_text,
      difficulty: template.difficulty
    }
  });
  await expectOk(createResponse, "creating problem failed");
  const created = (await createResponse.json()) as ProblemResponse;

  for (const [index, example] of template.examples.entries()) {
    const response = await context.request.post(`${API_URL}/problems/${created.id}/examples`, {
      data: { ...example, order_index: index }
    });
    await expectOk(response, "adding example failed");
  }

  for (const [index, testCase] of template.tests.entries()) {
    const response = await context.request.post(`${API_URL}/problems/${created.id}/tests`, {
      data: { ...testCase, order_index: index }
    });
    await expectOk(response, "adding test failed");
  }

  const referenceResponse = await context.request.put(
    `${API_URL}/problems/${created.id}/reference-solution`,
    {
      data: {
        language: "python",
        code: template.reference_solution.code
      }
    }
  );
  await expectOk(referenceResponse, "saving reference solution failed");

  const validateResponse = await context.request.post(`${API_URL}/problems/${created.id}/validate`);
  await expectOk(validateResponse, "starting validation failed");
  await waitForProblemReady(context, created.id);

  const publishResponse = await context.request.post(`${API_URL}/problems/${created.id}/publish`, {
    data: {
      is_public: true,
      is_duel_enabled: true
    }
  });
  await expectOk(publishResponse, "publishing problem failed");
  return (await publishResponse.json()) as ProblemResponse;
}

async function waitForDuelFinished(context: BrowserContext, duelId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await context.request.get(`${API_URL}/duels/${duelId}`);
    await expectOk(response, "loading duel state failed");
    const duel = (await response.json()) as DuelResponse;
    if (duel.status === "finished") {
      return duel;
    }
    await wait(2_000);
  }
  throw new Error(`Duel ${duelId} did not finish in time.`);
}

async function chooseSelectOption(page: Page, comboIndex: number, optionName: string | RegExp) {
  await page.locator('[role="combobox"]:visible').nth(comboIndex).click();
  await page.getByRole("option", { name: optionName }).click();
}

async function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("registers through the UI and logs out back to the landing page", async ({ page }) => {
  const credentials = uniqueCredentials("ui-auth");

  await page.goto("/auth");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(credentials.username);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(credentials.username)).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("checks, publishes, and opens a practice room from the editor", async ({ browser }) => {
  test.slow();
  const context = await browser.newContext();
  const credentials = uniqueCredentials("practice");

  await registerThroughApi(context, credentials);

  const page = await context.newPage();
  await page.goto("/app/problems");
  await page.getByRole("button", { name: "Add sample tasks" }).click();
  await expect(page.getByText("Sample tasks added")).toBeVisible({ timeout: 20_000 });

  const problem = await waitForOwnedProblem(context, "Longest Equal Run");
  await page.goto(`/app/problems/${problem.id}/edit`);
  await page.getByRole("button", { name: /Check solution|Save and check solution/ }).click();

  await expect(page.getByText("Check in progress")).toBeVisible({ timeout: 10_000 });
  const publishButton = page.getByRole("button", { name: "Publish for duels" });
  await expect(publishButton).toBeEnabled({ timeout: 90_000 });

  await publishButton.click();
  await expect(page.getByText("Task published successfully")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Task published successfully")).toBeVisible();

  await page.getByRole("link", { name: "Create practice room" }).click();
  await expect(page).toHaveURL(/roomType=practice/);
  await expect(page.getByRole("tab", { name: "Practice room", selected: true })).toBeVisible();
  await page.getByRole("button", { name: "Create practice room" }).click();
  await expect(page.getByRole("link", { name: "Enter duel room" })).toBeVisible();
  await expect(page.getByText("No stakes")).toBeVisible();

  await context.close();
});

test("shows foreign tasks in rated catalog and own tasks in practice catalog", async ({ browser }) => {
  test.slow();
  const ownerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerCredentials = uniqueCredentials("owner");
  const viewerCredentials = uniqueCredentials("viewer");

  await registerThroughApi(ownerContext, ownerCredentials);
  await registerThroughApi(viewerContext, viewerCredentials);

  const ownerProblem = await createPublishedProblem(
    ownerContext,
    sampleProblems[0],
    "owner-catalog"
  );
  const viewerProblem = await createPublishedProblem(
    viewerContext,
    sampleProblems[1],
    "viewer-catalog"
  );

  const page = await viewerContext.newPage();
  await page.goto("/app/duels/private");

  await page.getByRole("tab", { name: "Rated room" }).click();
  await page.locator('[role="combobox"]:visible').first().click();
  await expect(
    page.getByRole("option", { name: new RegExp(escapeForRegex(ownerProblem.title)) })
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: new RegExp(escapeForRegex(viewerProblem.title)) })
  ).toHaveCount(0);
  await page.getByRole("option", { name: new RegExp(escapeForRegex(ownerProblem.title)) }).click();

  await page.getByRole("tab", { name: "Practice room" }).click();
  await page.locator('[role="combobox"]:visible').first().click();
  await expect(
    page.getByRole("option", { name: new RegExp(escapeForRegex(viewerProblem.title)) })
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: new RegExp(escapeForRegex(ownerProblem.title)) })
  ).toHaveCount(0);
  await page.getByRole("option", { name: new RegExp(escapeForRegex(viewerProblem.title)) }).click();

  await ownerContext.close();
  await viewerContext.close();
});

test("creates a rated room, finishes the duel, and records rated history", async ({ browser }) => {
  test.slow();
  const ownerContext = await browser.newContext();
  const challengerContext = await browser.newContext();
  const ownerCredentials = uniqueCredentials("rated-owner");
  const challengerCredentials = uniqueCredentials("rated-challenger");

  await registerThroughApi(ownerContext, ownerCredentials);
  await registerThroughApi(challengerContext, challengerCredentials);

  const publishedProblem = await createPublishedProblem(
    ownerContext,
    sampleProblems[0],
    "rated-flow"
  );

  const challengerPage = await challengerContext.newPage();
  await challengerPage.goto("/app/duels/private");
  await challengerPage.getByRole("tab", { name: "Rated room" }).click();
  await chooseSelectOption(challengerPage, 0, new RegExp(escapeForRegex(publishedProblem.title)));
  await challengerPage.getByRole("button", { name: "Create rated room" }).click();
  await expect(challengerPage.getByRole("link", { name: "Enter duel room" })).toBeVisible();

  const roomCode = (await challengerPage.locator("text=/^[A-Z0-9]{6}$/").textContent())?.trim();
  expect(roomCode).toBeTruthy();

  const duelLink = challengerPage.getByRole("link", { name: "Enter duel room" });
  const duelHref = await duelLink.getAttribute("href");
  expect(duelHref).toBeTruthy();
  const duelId = duelHref!.split("/").pop()!;

  await duelLink.click();
  await expect(challengerPage.getByText("Rated room")).toBeVisible();
  await expect(challengerPage.getByText("This room changes both rating and token balance.")).toBeVisible();

  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto("/app/duels/private");
  await ownerPage.getByPlaceholder("Enter the room code you received").fill(roomCode!);
  await ownerPage.getByRole("button", { name: "Join by code" }).click();
  await expect(ownerPage.getByRole("link", { name: "Enter duel room" })).toBeVisible();
  await ownerPage.getByRole("link", { name: "Enter duel room" }).click();
  await expect(ownerPage.getByText("Rated room")).toBeVisible();

  await expectOk(
    await challengerContext.request.post(`${API_URL}/duels/${duelId}/ready`),
    "challenger ready failed"
  );
  await expectOk(
    await ownerContext.request.post(`${API_URL}/duels/${duelId}/ready`),
    "owner ready failed"
  );

  await wait(5_000);
  await expectOk(
    await challengerContext.request.post(`${API_URL}/duels/${duelId}/submit`, {
      data: {
        code: sampleProblems[0].reference_solution.code,
        language: "python"
      }
    }),
    "submission failed"
  );

  await waitForDuelFinished(challengerContext, duelId);

  await challengerPage.goto("/app/history");
  await expect(challengerPage.getByText(roomCode!)).toBeVisible();
  await expect(challengerPage.getByText("Rated room")).toBeVisible();
  await expect(challengerPage.getByText("No rating change")).toHaveCount(0);
  await expect(challengerPage.getByText("No token change")).toHaveCount(0);

  await ownerContext.close();
  await challengerContext.close();
});
