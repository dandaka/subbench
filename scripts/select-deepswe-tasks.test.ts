import { describe, expect, test } from "bun:test";
import { importEconomics } from "./select-deepswe-tasks.ts";

const tasks = [
  {
    id: "a",
    language: "go",
    repository: "r",
    repository_url: "u",
    base_commit_hash: "a".repeat(40),
  },
];
const config = {
  model: "m",
  reasoning_effort: "high",
  config: { temperature: 0 },
};
describe("DeepSWE economics importer", () => {
  test("filters effort/config before aggregation and rejects absent cells", () => {
    const trials = [
      {
        task_name: "a",
        model: "m",
        included_in_score: true,
        passed: true,
        cost_usd: 1,
        n_agent_steps: 1,
        agent_duration_seconds: 1,
        reasoning_effort: "high",
        config: { temperature: 0 },
      },
      {
        task_name: "a",
        model: "m",
        included_in_score: true,
        passed: false,
        cost_usd: 99,
        n_agent_steps: 1,
        agent_duration_seconds: 1,
        reasoning_effort: "low",
        config: { temperature: 0 },
      },
    ];
    const imported = importEconomics(tasks, trials, [config], config);
    expect(imported.economics[0]!.avg_cost_usd).toBe(1);
    expect(() =>
      importEconomics(
        tasks,
        trials,
        [{ ...config, reasoning_effort: "xhigh" }],
        { ...config, reasoning_effort: "xhigh" },
      ),
    ).toThrow(/economics gap/);
  });
});
