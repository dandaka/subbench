import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

async function execute(args: string[]): Promise<{ output: string; status: number }> {
  const process = Bun.spawn(
    ["bun", "run", resolve("packages/cli/src/index.ts"), ...args],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = await new Response(process.stdout).text();
  return { output, status: await process.exited };
}

describe("CLI", () => {
  test("runs the synthetic workflow", async () => {
    const directory = mkdtempSync(join(tmpdir(), "subbench-cli-"));
    directories.push(directory);
    const database = join(directory, "study.db");
    expect((await execute(["--db", database, "init"])).status).toBe(0);
    expect((await execute([
      "--db", database, "load", resolve("examples/synthetic.json"),
    ])).status).toBe(0);
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
    expect((await execute(["--db", database, "validate"])).status).toBe(0);
    const analyzed = await execute(["--db", database, "analyze", "--format", "json"]);
    expect(analyzed.status).toBe(0);
    expect(JSON.parse(analyzed.output)).toHaveLength(1);
  });
});
