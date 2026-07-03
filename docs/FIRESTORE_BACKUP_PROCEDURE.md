# Firestore Backup Procedure

Status: Procedure Doc (Investigation + Runbook, not yet executed)

## Purpose

Kompari is about to enter a sequence of Firestore write / migration phases:

- hit/miss 台帳 (ledger)
- Settlement additive 実装
- 候補編集警告 (candidate edit warnings)
- Candidate ID 再検討
- その他 Firestore write / migration を伴う作業

Before any of these phases begins, a backup and restore procedure must exist and be
verified. This document defines that procedure. It does not perform any of the
operations it describes — enabling PITR, creating a backup schedule, switching to
Blaze, or running a restore are all left as explicit, human-performed steps.

## Current Project State

- Kompari is currently small, but the data is already valuable (real predictions,
  real results, historical record).
- Current production scale: **13 events**, **61 predictions**.
- `events` / `predictions` are the source of truth for the product.
- `result.winner` is the Result Settlement SoT (source of truth for what actually
  happened).
- `outcome` (hit/miss judgement) is non-authoritative — it is derived from
  `result.winner`, not an independent record.
- My AI is MVP non-display / non-ranking, but its data is preserved and must not be
  lost in any backup/restore operation.
- Mock predictions are excluded from performance/ranking calculations, but they are
  still data and still need to survive backup/restore.
- A backup procedure must exist and be restore-tested before any write/migration
  phase listed above begins.

## Recommended Policy

Recommended backup policy for Kompari MVP:

- **PITR: enable.**
- **Scheduled backups: daily.**
- **Retention:** long for the current phase (on the order of several weeks up to the
  14-week maximum), but this is a cost/safety tradeoff to revisit as data grows —
  not a permanently fixed maximum. See "Retention and Cost Tradeoff" below.
- **Restore: always to a new database first.** Never restore directly into
  production without manual review.
- Before any write/migration phase, confirm a recent backup exists and restore has
  been verified at least once.
- Firebase Console / Google Cloud Console operations (enabling PITR, creating
  schedules, running restores) are performed by the human operator (user), not by
  Claude Code.
- Claude Code's role is limited to producing this procedure doc and the checklists
  in it — not executing any part of it.
- GCS export automation is out of scope for now — it solves a problem (indefinite
  retention beyond 14 weeks) that Kompari does not have yet.

PITR and scheduled backups solve different risks and are complementary, not
redundant:

- **PITR** covers short-term accidental writes/deletes — recovery window up to 7
  days, minute-level granularity, effectively zero recovery-time objective for
  surgical fixes (e.g. "undo the bad write from 20 minutes ago").
- **Scheduled backups** cover longer retention — full-database snapshots that
  survive well past the 7-day PITR window, used for slower, larger-scope recovery
  or as an audit trail.
- Backup is not considered "established" until a restore has actually been
  performed onto a new database and verified — an unrestored backup is an
  unverified assumption.
- No production overwrite without manual review, ever — every restore target is a
  new database, and promoting recovered data back into production (if ever needed)
  is a separate, explicit, manual decision.

## Why PITR + Scheduled Backup

Firestore Native mode offers three distinct recovery primitives, and Kompari should
use two of them together:

| Mechanism | Window | Granularity | Primary use |
|---|---|---|---|
| PITR | Up to 7 days back | 1-minute versions | Undo a recent accidental write/delete; stale reads; clone to inspect recent history |
| Scheduled backups | Up to 14 weeks retention | Daily/weekly snapshot | Recover from an issue discovered later than 7 days out; longer audit trail |
| Export to GCS (via PITR) | Indefinite | Point-in-time export | Long-term archival beyond 14 weeks — not needed yet |

Neither PITR nor scheduled backups are free — both require billing (Blaze) to be
enabled, since they are explicitly excluded from the Spark plan's free quota.

Restoring from either PITR or a scheduled backup always creates a **new** Firestore
database in the same project — it does not overwrite the existing production
database. This is the mechanism-level reason "restore to a new database first" is
safe by default, not just a Kompari policy choice.

## What We Are Not Doing Yet

Explicitly out of scope for this document and for the current phase:

- Switching to the Blaze plan (a precondition for everything below, but not done
  by this task).
- Enabling PITR.
- Creating a scheduled backup.
- Performing any restore, clone, or export.
- Automating GCS exports for indefinite retention.
- Writing to or deleting from production Firestore in the course of this
  investigation.
- Running any `gcloud` commands.
- Creating or storing any service account JSON or other credentials.

This document is a runbook to be executed by the human operator when ready, and a
checklist to confirm before any future write/migration phase.

## Blaze Plan Requirement

PITR and scheduled backups both require billing to be enabled on the project —
Google's documentation lists TTL deletes, PITR data, backup data, restore
operations, and clone operations as features with **no free tier**; they require
the Blaze (pay-as-you-go) plan.

Given this, Kompari's current recommendation is: **accept the Blaze switch as a
precondition**, but treat it carefully rather than casually, since it removes the
Spark plan's hard usage ceiling.

Before switching to Blaze:

- Set up a billing budget alert first (see checklist below) — ideally before or
  immediately after the switch, not after backups are already running.
- Confirm current usage is well within Spark free quota (13 events / 61
  predictions is negligible; expect near-zero marginal cost from normal app usage
  even after switching).
- Do not provision any new API keys or service accounts as part of this switch —
  Blaze is a billing account change, not a credentials change.
- Reconfirm the existing policy: no script/REST access to production Firestore.
  Enabling Blaze does not change this — verification of production data continues
  to happen via Firebase Console, by the human operator.

After switching to Blaze, monitor:

- The billing budget alert itself (does it fire, and at what usage).
- Firestore usage graphs in the Firebase Console (reads/writes/storage) for any
  unexpected spike, which would indicate a bug rather than expected growth.
- PITR storage cost once enabled (expected to be small given current data size).
- Backup storage cost once the daily schedule accumulates backups over the
  retention window.

## Retention and Cost Tradeoff

Scheduled backup retention is a cost decision, not just a safety decision:

- Longer retention means more backup storage retained over time — each daily
  backup persists for the full retention period before being purged, so retention
  length directly multiplies the storage bill.
- Daily backups with long retention accumulate many retained backups
  simultaneously (e.g. a 14-week daily retention policy means roughly 98 backups
  exist at once, each billed for storage).
- Kompari's current data size (13 events, 61 predictions) is very small, so even
  a long retention window (several weeks up to the 14-week maximum) is expected to
  cost very little in absolute terms right now.
- This does **not** mean 14 weeks (or any other value) should be treated as
  permanent policy. As events/predictions grow — especially once categories beyond
  horse racing are added — retention should be reviewed against actual storage
  cost at that time.
- Retention is not being fixed at "maximum" in this document. The recommendation
  is "long enough to be useful for the current low data volume," to be revisited
  as a cost/safety tradeoff, not re-derived as a hard requirement.
- Whenever backup settings (schedule, retention) are changed, record the chosen
  retention period and the reason in `docs/MIGRATION_STATUS.md` at the time of the
  change — this document does not maintain a running log itself.

## Budget Alert Checklist

To be performed by the human operator, ideally before or immediately after
switching to Blaze:

- [ ] Open Google Cloud Console → Billing → Budgets & alerts for the Kompari
      billing account.
- [ ] Create a budget scoped to the Kompari project (not the whole billing
      account, if it is shared with other projects).
- [ ] Set a monthly budget amount that is a clear multiple of expected normal
      usage — given current scale (13 events / 61 predictions, Spark-tier read/
      write volume), a small monthly ceiling (e.g. in the low tens of dollars) is
      enough to catch any real problem without being noisy. Pick a concrete number
      when actually configuring this, informed by that day's actual usage
      dashboard, not by this document.
- [ ] Configure threshold alerts at multiple percentages (e.g. 50%, 90%, 100%) so
      there is early warning, not just a single trigger at the limit.
- [ ] Confirm the alert recipient (email) is one the operator actually monitors.
- [ ] Confirm understanding that a budget alert is a **notification only** — it
      does not stop billing or disable the project. It exists so a runaway cost
      is noticed quickly, not so it is prevented automatically.
- [ ] Do not create a new API key or service account to configure this — budget
      alerts are configured directly in Cloud Console under the operator's own
      login.

## Enable PITR Checklist

To be performed by the human operator when ready to proceed (not part of this
task):

- [ ] Confirm Blaze plan is active on the project.
- [ ] Confirm a billing budget alert is already configured (see above).
- [ ] In Google Cloud Console → Firestore → Databases → select the production
      database → enable Point-in-Time Recovery.
- [ ] Note the enablement timestamp — data before this point is not recoverable
      via PITR, and the full 7-day window is only available starting 7 days after
      enablement.
- [ ] Record the enablement date in `docs/MIGRATION_STATUS.md`.
- [ ] Do not treat PITR enablement alone as "backup established" — it becomes
      "established" only after a restore/clone test succeeds (see Restore Test
      Procedure below).

## Enable Scheduled Backup Checklist

To be performed by the human operator when ready to proceed (not part of this
task):

- [ ] Confirm Blaze plan is active and PITR has been enabled first (scheduled
      backups compose with the same underlying infrastructure).
- [ ] In Google Cloud Console → Firestore → Databases → select the production
      database → Scheduled backups → configure.
- [ ] Set recurrence to **daily**.
- [ ] Set retention to the current recommended value (a few weeks up to 14 weeks
      maximum) per the Retention and Cost Tradeoff section above — pick and
      record the actual number chosen at configuration time.
- [ ] Confirm at most one daily and one weekly schedule are configured (Firestore
      allows only one of each per database) — Kompari only needs the daily one for
      now.
- [ ] Record the schedule (recurrence + retention) and date configured in
      `docs/MIGRATION_STATUS.md`.
- [ ] Do not treat schedule creation alone as "backup established" — wait for the
      first backup to actually complete, then proceed to the Restore Test
      Procedure.

## Pre-Write Phase Checklist

To be run before starting **any** of: hit/miss 台帳, Settlement additive
実装, 候補編集警告, Candidate ID 再検討, or any other Firestore write/migration
work:

- [ ] Confirm PITR is enabled and has been enabled for at least the length of time
      needed to cover the intended rollback window for this phase.
- [ ] Confirm a scheduled daily backup exists and has completed at least once
      recently (check the backup list in Cloud Console for a recent timestamp).
- [ ] Confirm at least one restore test has been performed and verified per the
      Restore Test Procedure below — if not, do not proceed with the write phase
      until one is done.
- [ ] Confirm current event/prediction counts (for later comparison if a rollback
      is ever needed) — record them in `docs/MIGRATION_STATUS.md` alongside the
      phase being started.
- [ ] Confirm no uncommitted / unrelated schema changes are mixed into the
      upcoming migration — the write phase should be scoped and reversible on its
      own.

## Restore Test Procedure

This procedure must be completed at least once, with results verified, before
backup is considered "established" for Kompari.

1. Trigger a restore of the most recent scheduled backup (or a PITR-based clone)
   to a **new** Firestore database in the same project — never to the existing
   production database.
2. Wait for the restore operation to complete (this can take a noticeable amount
   of time; it is not instant).
3. Once the new database is accessible, verify the following against known
   production values at the time the backup was taken:
   - `events` collection document count matches expected (currently 13).
   - `predictions` document/array count matches expected (currently 61, however
     predictions are currently stored; see `lib/events.ts` for current shape).
   - If `events/{id}/predictions` subcollections exist in the restored data
     (depending on the data model at the time), confirm their presence and
     count for a sample of events.
   - Spot-check `result.winner` on a few settled events matches the known value.
   - Spot-check `prediction.main` on a few predictions matches the known value.
   - Confirm `outcome` fields (where present) are treated as non-authoritative
     during this check — do not use them as the source of truth for verification;
     `result.winner` is.
4. Record the verification result (pass/fail, what was checked, counts observed)
   in `docs/MIGRATION_STATUS.md`.
5. Decide whether to keep or delete the restored test database:
   - If kept temporarily for further inspection, note that it is a **test**
     database, not to be pointed at by the app's config, and delete it once no
     longer needed.
   - When deleting, delete only the restored test database — never the production
     database — and confirm the correct database ID before running any delete.
6. Only after this procedure has been completed and verified once is the backup
   procedure considered "established" for Kompari.

## Emergency Recovery Decision Tree

```text
Accidental write/delete within 7 days
→ Use PITR / clone / point-in-time read path first

Need older recovery point (beyond 7 days, up to retention window)
→ Use scheduled backup restore to a new database

Need to inspect recovered data before deciding anything
→ Restore/clone to a new database, compare counts and key fields
  (events count, predictions count, result.winner, prediction.main)
  against known-good values before taking any further action

Never overwrite production directly
→ Manual review required before any production recovery operation;
  recovered data is promoted into production only as a deliberate,
  separate, human-reviewed step — never as part of the restore itself
```

## Operational Rules

- Do not run production Firestore scripts unless explicitly approved.
- Prefer Console-based verification for production data over scripts or direct
  API/REST access.
- Before any migration/write phase, confirm backup status per the Pre-Write Phase
  Checklist above.
- Restore to a new database first, always.
- Do not overwrite production directly, ever, regardless of urgency.
- Document every backup/restore operation that is actually performed in
  `docs/MIGRATION_STATUS.md`, including retention chosen and the reason.
- Do not store service account JSON in the repo.
- Do not commit credentials of any kind.
- Do not create automated export infrastructure (e.g. scheduled GCS exports) yet —
  it is out of scope until indefinite retention is actually needed.
- Do not use backup setup as an excuse to expand MVP scope (e.g. do not bundle
  unrelated schema changes into the first restore test).
