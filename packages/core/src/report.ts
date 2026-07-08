import type { ReportRecord } from "./types.ts";

const headers = [
  "provider", "plan", "model", "surface", "grade", "promotion", "n", "success_rate",
  "success_ci", "median_drain", "p90_drain", "tasks_per_period", "tasks_ci", "svi",
  "api_value_multiple", "break_even_tasks", "window",
] as const;

export function renderJson(records: ReportRecord[]): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}

function csvCell(value: unknown): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderCsv(records: ReportRecord[]): string {
  const rows = [
    headers.join(","),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(",")),
  ];
  return `${rows.join("\n")}\n`;
}

export function renderMarkdown(records: ReportRecord[]): string {
  const visible = [
    "provider", "plan", "model", "grade", "promotion", "n", "success_rate",
    "success_ci", "tasks_per_period", "svi", "api_value_multiple", "break_even_tasks",
  ] as const;
  const lines = [
    "# SubBench V1 Results",
    "",
    "> Estimates combine published neutral-harness economics with native-product quota "
      + "calibration. Native harness outcomes may differ.",
    "",
    `| ${visible.join(" | ")} |`,
    `|${visible.map(() => "---").join("|")}|`,
    ...records.map((record) => `| ${visible.map((key) => record[key]).join(" | ")} |`),
    "",
    "Baseline and promotion measurements are reported separately. Results are time-bound "
      + "to the measurement window and should be treated as stale afterward.",
    "",
  ];
  return lines.join("\n");
}
