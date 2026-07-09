import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

async function execute(args: string[]): Promise<{ output: string; error: string; status: number }> {
  const process = Bun.spawn(
    ["bun", "run", resolve("packages/cli/src/index.ts"), ...args],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = await new Response(process.stdout).text();
  const error = await new Response(process.stderr).text();
  return { output, error, status: await process.exited };
}

describe("CLI", () => {
  test("analyzes a clean bundle and reports one result", async () => {
    const directory = mkdtempSync(join(tmpdir(), "subbench-cli-"));
    directories.push(directory);
    const database = join(directory, "study.db");
    expect((await execute(["--db", database, "init"])).status).toBe(0);
    expect((await execute([
      "--db", database, "load", resolve("examples/synthetic.json"),
    ])).status).toBe(0);
    expect((await execute(["--db", database, "validate"])).status).toBe(0);
    const analyzed = await execute(["--db", database, "analyze", "--format", "json"]);
    expect(analyzed.status).toBe(0);
    const records = JSON.parse(analyzed.output);
    expect(records).toHaveLength(1);
    expect(records[0].publishable).toBe(true);
  });

  test("a manual run makes the study non-publishable and fails closed", async () => {
    const directory = mkdtempSync(join(tmpdir(), "subbench-cli-"));
    directories.push(directory);
    const database = join(directory, "study.db");
    await execute(["--db", database, "init"]);
    await execute(["--db", database, "load", resolve("examples/synthetic.json")]);
    const captured = await execute([
      "--db", database, "run",
      "--measurement-id", "1",
      "--benchmark-source-id", "1",
      "--task-id", "captured-task",
      "--environment", "clean-demo-v1",
      "--pre-usage", "45",
      "--post-usage", "53",
      "--api-cost", "2",
      "--",
      "bun", "-e", "process.exit(0)",
    ]);
    expect(captured.status).toBe(0);
    expect(captured.output).toContain("recorded run 6");

    // Manual (hand-entered) evidence is a publishability issue: validate now reports it.
    const validated = await execute(["--db", database, "validate"]);
    expect(validated.status).toBe(1);
    expect(validated.error).toContain("[publishability]");

    // analyze without --force fails closed on the publishable measurement.
    const blocked = await execute(["--db", database, "analyze", "--format", "json"]);
    expect(blocked.status).toBe(1);

    // --force computes but stamps the row non-publishable.
    const forced = await execute(["--db", database, "analyze", "--format", "json", "--force"]);
    expect(forced.status).toBe(0);
    const records = JSON.parse(forced.output);
    expect(records).toHaveLength(1);
    expect(records[0].publishable).toBe(false);
  });
});
