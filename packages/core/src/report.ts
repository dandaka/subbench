import type { ReportRecord } from "./types.ts";

const headers = [
  "provider",
  "plan",
  "model",
  "surface",
  "grade",
  "promotion",
  "publishable",
  "n",
  "success_rate",
  "success_ci",
  "median_drain",
  "p90_drain",
  "window_days",
  "window_price",
  "native_tasks_per_window",
  "native_tasks_ci",
  "benchmark_equivalent_tasks_per_window",
  "svi",
  "svi_ci",
  "api_value_multiple",
  "break_even_tasks",
  "economics_gap",
  "window",
  "task_manifest",
  "target_population",
  "estimand_version",
  "protocol_version",
  "methodology_version",
  "comparison_compatible",
  "conditions",
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
    ...records.map((record) =>
      headers.map((header) => csvCell(record[header])).join(","),
    ),
  ];
  return `${rows.join("\n")}\n`;
}

export function renderMarkdown(records: ReportRecord[]): string {
  const visible = [
    "provider",
    "plan",
    "model",
    "grade",
    "publishable",
    "n",
    "success_rate",
    "success_ci",
    "native_tasks_per_window",
    "svi",
    "svi_ci",
    "api_value_multiple",
    "break_even_tasks",
    "task_manifest",
  ] as const;
  const lines = [
    "# Subbench calibration report",
    "",
    "> **Non-generalization warning:** this is a fixed calibration-set report, not a provider " +
      "ranking and not an estimate of developer work generally. Primary metric: native " +
      "successful tasks per quota window (SVI = native tasks per window-dollar), using all " +
      "observed attempt drain. Benchmark-equivalent/API fields, where shown, are separate " +
      "neutral-harness anchors; native harness outcomes may differ.",
    "",
    `| ${visible.join(" | ")} |`,
    `|${visible.map(() => "---").join("|")}|`,
    ...records.map(
      (record) =>
        `| ${visible.map((key) => (record[key] === null ? "—" : record[key])).join(" | ")} |`,
    ),
    "",
    "Baseline and promotion measurements are reported separately. Rows marked " +
      "`publishable = false` failed a publishability check and must not be published as " +
      "results. Results are time-bound to the measurement window and should be treated as " +
      "stale afterward.",
    "",
  ];
  lines.push(
    "API multiples require an explicit compatible economics binding. Cross-cell comparison also " +
      "requires the same immutable task manifest, quota window, and promotion state; rows that " +
      "fail that gate are not a ranking.",
    "",
  );
  const gaps = records.filter((record) => record.economics_gap);
  if (gaps.length > 0) {
    lines.push("## Economics gaps", "");
    for (const record of gaps) {
      lines.push(
        `- ${record.provider}/${record.model}: ${record.economics_gap}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
