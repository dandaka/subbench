import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  analyzeDatabase,
  initializeDatabase,
  loadBundle,
  openDatabase,
  renderMarkdown,
  validateDatabase,
} from "../src/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("database pipeline", () => {
  test("loads, validates, analyzes, and reports a complete study", () => {
    const directory = mkdtempSync(join(tmpdir(), "subbench-"));
    directories.push(directory);
    const path = join(directory, "study.db");
    initializeDatabase(path);
    const db = openDatabase(path);
    try {
      const counts = loadBundle(db, resolve("examples/synthetic.json"));
      expect(counts.runs).toBe(5);
      expect(validateDatabase(db)).toEqual([]);
      const records = analyzeDatabase(db);
      expect(records).toHaveLength(1);
      expect(records[0]?.provider).toBe("example-ai");
      expect(renderMarkdown(records)).toContain("SubBench V1 Results");
      expect(db.query("SELECT * FROM results").all()).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});
