import { api, Problem } from "@/lib/api";

export type ProblemTemplate = {
  key: string;
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
    order_index: number;
  }>;
  tests: Array<{
    input_data: string;
    expected_output: string;
    kind: "sample" | "hidden" | "edge";
    weight: number;
    order_index: number;
  }>;
  reference_solution: string;
};

export type ProblemImportPayload = Omit<ProblemTemplate, "key">;

export const problemTemplates: ProblemTemplate[] = [
  {
    key: "longest-equal-run",
    title: "Longest Equal Run",
    description:
      "You are given a sequence of integers. Find the length of the longest contiguous block that contains only one repeated value.\n\nIf all numbers are different, the answer is 1.",
    input_spec:
      "The first line contains one integer n — the length of the sequence.\n\nThe second line contains n integers.",
    output_spec:
      "Print one integer — the length of the longest contiguous block of equal numbers.",
    constraints_text:
      "1 <= n <= 200000\nEach number fits in a signed 32-bit integer.",
    difficulty: 2,
    examples: [
      {
        input_data: "8\n1 1 2 2 2 3 3 1\n",
        output_data: "3\n",
        explanation: "The longest block is 2 2 2.",
        order_index: 0
      },
      {
        input_data: "5\n7 7 7 7 7\n",
        output_data: "5\n",
        explanation: "All values are the same, so the whole sequence is one run.",
        order_index: 1
      }
    ],
    tests: [
      {
        input_data: "6\n4 4 1 1 1 2\n",
        expected_output: "3\n",
        kind: "sample",
        weight: 1,
        order_index: 0
      },
      {
        input_data: "7\n5 1 1 1 1 2 2\n",
        expected_output: "4\n",
        kind: "hidden",
        weight: 2,
        order_index: 1
      },
      {
        input_data: "4\n9 8 7 6\n",
        expected_output: "1\n",
        kind: "hidden",
        weight: 2,
        order_index: 2
      },
      {
        input_data: "1\n42\n",
        expected_output: "1\n",
        kind: "edge",
        weight: 1,
        order_index: 3
      }
    ],
    reference_solution: `import sys


def solve(data: str) -> str:
    parts = data.strip().split()
    if not parts:
        return "0"

    n = int(parts[0])
    numbers = list(map(int, parts[1:1 + n]))

    if not numbers:
        return "0"

    best = 1
    current = 1

    for index in range(1, len(numbers)):
        if numbers[index] == numbers[index - 1]:
            current += 1
        else:
            current = 1
        if current > best:
            best = current

    return str(best)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))`
  },
  {
    key: "smallest-missing-non-negative",
    title: "Smallest Missing Non-Negative",
    description:
      "You are given an array of integers. Find the smallest non-negative integer that does not appear in the array.\n\nFor example, if the array contains 0, 1 and 3, the answer is 2.",
    input_spec:
      "The first line contains one integer n.\n\nThe second line contains n integers.",
    output_spec:
      "Print the smallest non-negative integer that is missing from the array.",
    constraints_text:
      "1 <= n <= 200000\nValues can be negative or positive.",
    difficulty: 3,
    examples: [
      {
        input_data: "5\n0 1 2 4 5\n",
        output_data: "3\n",
        explanation: "The smallest missing non-negative value is 3.",
        order_index: 0
      },
      {
        input_data: "4\n1 2 3 4\n",
        output_data: "0\n",
        explanation: "Zero does not appear in the array.",
        order_index: 1
      }
    ],
    tests: [
      {
        input_data: "6\n0 2 1 4 2 0\n",
        expected_output: "3\n",
        kind: "sample",
        weight: 1,
        order_index: 0
      },
      {
        input_data: "5\n-5 -1 -3 -2 -4\n",
        expected_output: "0\n",
        kind: "hidden",
        weight: 2,
        order_index: 1
      },
      {
        input_data: "7\n0 1 2 3 4 5 6\n",
        expected_output: "7\n",
        kind: "hidden",
        weight: 2,
        order_index: 2
      },
      {
        input_data: "8\n2 2 2 0 1 1 3 5\n",
        expected_output: "4\n",
        kind: "edge",
        weight: 1,
        order_index: 3
      }
    ],
    reference_solution: `import sys


def solve(data: str) -> str:
    parts = data.strip().split()
    if not parts:
        return "0"

    n = int(parts[0])
    numbers = list(map(int, parts[1:1 + n]))
    seen = {number for number in numbers if number >= 0}

    answer = 0
    while answer in seen:
        answer += 1

    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))`
  }
];

export async function createProblemFromPayload(
  template: ProblemImportPayload,
  options?: { isTemplateSeeded?: boolean }
): Promise<Problem> {
  const created = await api.createProblem({
    title: template.title,
    description: template.description,
    input_spec: template.input_spec,
    output_spec: template.output_spec,
    constraints_text: template.constraints_text,
    difficulty: template.difficulty,
    is_template_seeded: options?.isTemplateSeeded ?? false
  });

  for (const example of template.examples) {
    await api.addExample(created.id, example);
  }

  for (const test of template.tests) {
    await api.addTest(created.id, test);
  }

  return api.upsertReference(created.id, {
    language: "python",
    code: template.reference_solution
  });
}

export async function createProblemFromTemplate(template: ProblemTemplate): Promise<Problem> {
  return createProblemFromPayload({
    title: template.title,
    description: template.description,
    input_spec: template.input_spec,
    output_spec: template.output_spec,
    constraints_text: template.constraints_text,
    difficulty: template.difficulty,
    examples: template.examples,
    tests: template.tests,
    reference_solution: template.reference_solution
  }, { isTemplateSeeded: true });
}
