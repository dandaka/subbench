import type { ReportRecord } from "./types.ts";

const headers = [
  "provider", "plan", "model", "surface", "grade", "promotion", "publishable", "n",
  "success_rate", "success_ci", "median_drain", "p90_drain", "window_days",
  "window_price", "native_tasks_per_window", "native_tasks_ci",
  "benchmark_equivalent_tasks_per_window", "svi", "svi_ci", "api_value_multiple",
  "break_even_tasks", "economics_gap", "window",
] as const;

export function renderJson(records: ReportRecord[]): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}

function csvCell(value: unknown): string {
  const text = value === null ? "" : String(value);
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
    "provider", "plan", "model", "grade", "publishable", "n", "success_rate",
    "success_ci", "native_tasks_per_window", "svi", "svi_ci", "api_value_multiple",
    "break_even_tasks",
  ] as const;
  const lines = [
    "# SubBench V1 Results",
    "",
    "> Primary metric is native successful tasks per quota window (SVI = native tasks per "
      + "window per window-dollar). The benchmark-equivalent throughput and API comparison, "
      + "where shown, use published neutral-harness pass@1 and are reported only as anchors. "
      + "Native harness outcomes may differ.",
    "",
    `| ${visible.join(" | ")} |`,
    `|${visible.map(() => "---").join("|")}|`,
    ...records.map((record) =>
      `| ${visible.map((key) => record[key] === null ? "—" : record[key]).join(" | ")} |`
    ),
    "",
    "Baseline and promotion measurements are reported separately. Rows marked "
      + "`publishable = false` failed a publishability check and must not be published as "
      + "results. Results are time-bound to the measurement window and should be treated as "
      + "stale afterward.",
    "",
  ];
  const gaps = records.filter((record) => record.economics_gap);
  if (gaps.length > 0) {
    lines.push("## Economics gaps", "");
    for (const record of gaps) {
      lines.push(`- ${record.provider}/${record.model}: ${record.economics_gap}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
