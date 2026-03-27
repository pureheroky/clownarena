import { z } from "zod";

import { type ProblemImportPayload } from "@/lib/problem-templates";

const exampleSchema = z.object({
  input_data: z.string(),
  output_data: z.string(),
  explanation: z.string().optional().default(""),
  order_index: z.number().int().nonnegative().optional()
});

const testSchema = z.object({
  input_data: z.string(),
  expected_output: z.string(),
  kind: z.enum(["sample", "hidden", "edge"]),
  weight: z.number().int().positive().optional(),
  order_index: z.number().int().nonnegative().optional()
});

const referenceSolutionSchema = z.object({
  code: z.string().min(1)
});

const importedProblemSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10),
  input_spec: z.string().optional().default(""),
  output_spec: z.string().optional().default(""),
  constraints_text: z.string().optional().default(""),
  difficulty: z.number().int().min(1).max(5).optional().default(2),
  examples: z.array(exampleSchema).default([]),
  tests: z.array(testSchema).default([]),
  reference_solution: referenceSolutionSchema
});

const importedPayloadSchema = z.union([
  importedProblemSchema,
  z.array(importedProblemSchema).min(1)
]);

export function parseProblemImportJson(text: string): ProblemImportPayload[] {
  const parsed = importedPayloadSchema.parse(JSON.parse(text));
  const items = Array.isArray(parsed) ? parsed : [parsed];

  return items.map((item) => ({
    title: item.title,
    description: item.description,
    input_spec: item.input_spec,
    output_spec: item.output_spec,
    constraints_text: item.constraints_text,
    difficulty: item.difficulty,
    examples: item.examples.map((example, index) => ({
      input_data: example.input_data,
      output_data: example.output_data,
      explanation: example.explanation ?? "",
      order_index: example.order_index ?? index
    })),
    tests: item.tests.map((test, index) => ({
      input_data: test.input_data,
      expected_output: test.expected_output,
      kind: test.kind,
      weight: test.weight ?? 1,
      order_index: test.order_index ?? index
    })),
    reference_solution: item.reference_solution.code
  }));
}
