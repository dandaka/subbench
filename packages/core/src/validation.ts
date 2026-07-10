import type { Database } from "bun:sqlite";

export interface ValidationIssue {
  measurementId: number | null;
  message: string;
  /**
   * When true this issue only bars publication; a measurement explicitly flagged
   * `publishable = 0` is allowed to carry it. When false it is a hard integrity error
   * that fails validation regardless of the publishable flag.
   */
  publishabilityOnly: boolean;
}

function hard(measurementId: number | null, message: string): ValidationIssue {
  return { measurementId, message, publishabilityOnly: false };
}

function publishability(
  measurementId: number,
  message: string,
): ValidationIssue {
  return { measurementId, message, publishabilityOnly: true };
}

// Full structured validation. `database.ts` renders these into the string list the CLI
// prints, and `analyzeDatabase` inspects them to fail closed on any publishability issue
// for a measurement that still claims `publishable = 1`.
export function collectIssues(db: Database): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const integrity = db
    .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
    .get();
  if (integrity?.integrity_check !== "ok") {
    issues.push(
      hard(
        null,
        `database integrity: ${integrity?.integrity_check ?? "unknown"}`,
      ),
    );
  }

  // Run counts: 5-10 valid runs. <5 is a publishability issue (fail-closed unless flagged);
  // >10 remains a hard warning as before.
  const counts = db
    .query<{ id: number; publishable: number; n: number }, []>(
      `SELECT sm.id, sm.publishable, COUNT(r.id) n
     FROM subscription_measurements sm
     LEFT JOIN runs r ON r.measurement_id=sm.id AND r.promotion=sm.promotion
     GROUP BY sm.id`,
    )
    .all();
  for (const row of counts) {
    if (row.n < 5) {
      issues.push(
        publishability(
          row.id,
          `measurement ${row.id} has ${row.n} calibration runs; v1 requires >=5`,
        ),
      );
    } else if (row.n > 10) {
      issues.push(
        hard(
          row.id,
          `measurement ${row.id} has ${row.n} calibration runs; v1 allows at most 10`,
        ),
      );
    }
  }

  const mixed = db
    .query<{ measurement_id: number }, []>(
      `SELECT measurement_id FROM runs GROUP BY measurement_id
     HAVING MIN(promotion) != MAX(promotion)`,
    )
    .all();
  for (const row of mixed) {
    issues.push(
      hard(
        row.measurement_id,
        `measurement ${row.measurement_id} mixes baseline and promotion runs`,
      ),
    );
  }

  const environments = db
    .query<{ measurement_id: number }, []>(
      `SELECT measurement_id FROM runs GROUP BY measurement_id
     HAVING COUNT(DISTINCT harness_environment_id) > 1`,
    )
    .all();
  for (const row of environments) {
    issues.push(
      hard(
        row.measurement_id,
        `measurement ${row.measurement_id} mixes harness environments`,
      ),
    );
  }

  // Per-run isolation, not a measurement-level summary, is the required evidence.
  const attestation = db
    .query<{ measurement_id: number }, []>(
      `SELECT DISTINCT measurement_id FROM runs
     WHERE isolation_confirmed_at IS NULL OR isolation_confirmed_at=''
        OR isolation_confirmed_by IS NULL OR isolation_confirmed_by=''`,
    )
    .all();
  for (const row of attestation) {
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has a run with no per-run isolation attestation`,
      ),
    );
  }

  // D4: every run on a publishable measurement must carry paired-snapshot evidence.
  // Manual (hand-entered) drain is non-publishable. When a run declares paired-snapshots
  // AND rows exist in usage_snapshots, they must be complete (exactly pre+post).
  const manual = db
    .query<{ measurement_id: number }, []>(
      "SELECT DISTINCT measurement_id FROM runs WHERE evidence_kind = 'manual'",
    )
    .all();
  for (const row of manual) {
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has manual (non-snapshot) runs`,
      ),
    );
  }
  const partial = db
    .query<{ measurement_id: number }, []>(
      `SELECT DISTINCT r.measurement_id
     FROM runs r
     WHERE (SELECT COUNT(*) FROM usage_snapshots s WHERE s.run_id=r.id) != 2
        OR (SELECT COUNT(*) FROM usage_snapshots s WHERE s.run_id=r.id AND s.position='pre') != 1
        OR (SELECT COUNT(*) FROM usage_snapshots s WHERE s.run_id=r.id AND s.position='post') != 1
        OR r.evidence_kind != 'paired-snapshots'`,
    )
    .all();
  for (const row of partial) {
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has runs without exactly one pre and post usage snapshot`,
      ),
    );
  }
  const snapshotMismatch = db
    .query<{ measurement_id: number }, []>(
      `SELECT DISTINCT r.measurement_id FROM runs r
     JOIN usage_snapshots pre ON pre.run_id=r.id AND pre.position='pre'
     JOIN usage_snapshots post ON post.run_id=r.id AND post.position='post'
     LEFT JOIN usage_snapshot_windows pw ON pw.snapshot_id=pre.id AND pw.kind='weekly'
     LEFT JOIN usage_snapshot_windows qw ON qw.snapshot_id=post.id AND qw.kind='weekly'
     WHERE pre.provider != post.provider OR COALESCE(pre.account_id_hash,'') != COALESCE(post.account_id_hash,'')
        OR pw.resets_at IS NULL OR qw.resets_at IS NULL OR pw.resets_at != qw.resets_at
        OR ABS(r.pre_usage-pw.used_percent) > 0.000001 OR ABS(r.post_usage-qw.used_percent) > 0.000001`,
    )
    .all();
  for (const row of snapshotMismatch)
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has mismatched account, reset, or meter values in paired snapshots`,
      ),
    );

  // D1/D4: a publishable study needs a named quota window and a capacity grade better
  // than `unknown`.
  const window = db
    .query<{ id: number }, []>(
      "SELECT id FROM subscription_measurements WHERE quota_window_days IS NULL OR quota_window_days <= 0",
    )
    .all();
  for (const row of window) {
    issues.push(
      publishability(
        row.id,
        `measurement ${row.id} has no quota window (quota_window_days); not publishable`,
      ),
    );
  }
  const grade = db
    .query<{ id: number }, []>(
      "SELECT id FROM subscription_measurements WHERE measurement_grade = 'unknown'",
    )
    .all();
  for (const row of grade) {
    issues.push(
      publishability(
        row.id,
        `measurement ${row.id} has grade 'unknown' capacity; not publishable`,
      ),
    );
  }

  // A Tier A cell is bound to one immutable fixed-set manifest; every run must be a
  // declared member. Non-publishable historical/template rows may intentionally lack it.
  const manifests = db
    .query<{ id: number }, []>(
      "SELECT id FROM subscription_measurements WHERE task_manifest_ref IS NULL",
    )
    .all();
  for (const row of manifests) {
    issues.push(
      publishability(
        row.id,
        `measurement ${row.id} has no immutable task manifest binding`,
      ),
    );
  }
  const outOfManifest = db
    .query<{ measurement_id: number }, []>(
      `SELECT DISTINCT r.measurement_id FROM runs r
     JOIN subscription_measurements sm ON sm.id=r.measurement_id
     WHERE sm.task_manifest_ref IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM task_manifest_entries e
                       WHERE e.manifest_id=sm.task_manifest_ref AND e.task_id=r.task_id)`,
    )
    .all();
  for (const row of outOfManifest) {
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has a task outside its bound manifest`,
      ),
    );
  }
  const incompleteManifest = db
    .query<{ measurement_id: number }, []>(
      `SELECT sm.id measurement_id FROM subscription_measurements sm
     JOIN task_manifest_entries e ON e.manifest_id=sm.task_manifest_ref
     LEFT JOIN runs r ON r.measurement_id=sm.id AND r.task_id=e.task_id
     GROUP BY sm.id,e.id,e.expected_repetitions
     HAVING COUNT(r.id) != e.expected_repetitions`,
    )
    .all();
  for (const row of incompleteManifest) {
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} does not satisfy manifest task repetitions`,
      ),
    );
  }
  const duplicateTasks = db
    .query<{ measurement_id: number }, []>(
      `SELECT r.measurement_id FROM runs r JOIN subscription_measurements sm ON sm.id=r.measurement_id
     JOIN task_manifest_entries e ON e.manifest_id=sm.task_manifest_ref AND e.task_id=r.task_id
     GROUP BY r.measurement_id,r.task_id,e.expected_repetitions HAVING COUNT(*) > e.expected_repetitions`,
    )
    .all();
  for (const row of duplicateTasks)
    issues.push(
      publishability(
        row.measurement_id,
        `measurement ${row.measurement_id} has duplicate task attempts beyond its locked repetitions`,
      ),
    );
  const weakLock = db
    .query<{ id: number }, []>(
      `SELECT id FROM task_manifests WHERE length(manifest_sha256) != 64
       OR length(deepswe_commit) != 40
       OR image_digest NOT GLOB 'sha256:[0-9a-fA-F]*' OR length(image_digest) != 71`,
    )
    .all();
  for (const row of weakLock) {
    issues.push(
      hard(null, `task manifest ${row.id} has invalid immutable lock material`),
    );
  }

  // D3: every measurement resolves to exactly one economics record, or names a gap.
  const economics = db
    .query<{ id: number }, []>(
      `SELECT sm.id FROM subscription_measurements sm
     WHERE sm.task_cost_ref IS NULL AND (sm.economics_gap IS NULL OR sm.economics_gap='')`,
    )
    .all();
  for (const row of economics) {
    issues.push(
      hard(
        row.id,
        `measurement ${row.id} has neither a task_cost_ref nor an economics_gap`,
      ),
    );
  }
  const dangling = db
    .query<{ id: number }, []>(
      `SELECT sm.id FROM subscription_measurements sm
     WHERE sm.task_cost_ref IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM task_costs tc WHERE tc.id=sm.task_cost_ref)`,
    )
    .all();
  for (const row of dangling) {
    issues.push(
      hard(
        row.id,
        `measurement ${row.id} references a missing task_cost (${row.id})`,
      ),
    );
  }
  const ambiguousEconomics = db
    .query<{ id: number }, []>(
      `SELECT sm.id FROM subscription_measurements sm JOIN task_costs tc ON tc.id=sm.task_cost_ref
     WHERE tc.reasoning_effort='' OR tc.configuration_json=''`,
    )
    .all();
  for (const row of ambiguousEconomics)
    issues.push(
      publishability(
        row.id,
        `measurement ${row.id} has ambiguous economics effort/configuration binding`,
      ),
    );

  const incompatible = db
    .query<{ id: number }, []>(
      `SELECT sm.id FROM subscription_measurements sm
     WHERE sm.publishable=1 AND EXISTS (
       SELECT 1 FROM subscription_measurements other
       WHERE other.publishable=1 AND other.id != sm.id
         AND (other.task_manifest_ref != sm.task_manifest_ref
           OR other.quota_window_days != sm.quota_window_days OR other.promotion != sm.promotion)
     )`,
    )
    .all();
  for (const row of incompatible)
    issues.push(
      publishability(
        row.id,
        `measurement ${row.id} is not cross-cell comparable (manifest, quota window, or promotion differs)`,
      ),
    );

  return issues;
}

// Backward-compatible string list for the `validate` CLI command. Includes every issue;
// publishability issues are annotated so an operator sees why a study cannot be published.
export function validateDatabase(db: Database): string[] {
  return collectIssues(db).map((issue) =>
    issue.publishabilityOnly
      ? `${issue.message} [publishability]`
      : issue.message,
  );
}
