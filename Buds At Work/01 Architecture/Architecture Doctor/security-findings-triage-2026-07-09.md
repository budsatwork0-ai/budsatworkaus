# Phase 11 Security Findings Triage

Date: 2026-07-09

Scope: the 16 Security findings reported by Architecture Doctor before Phase 11 triage. Blocking CI remains disabled.

## Baseline Policy

Accepted and deferred Security findings are recorded in `architecture-doctor-baseline.json` with owner, reason, review date, and expiry date where applicable. Baselined findings remain visible in Architecture Doctor reports. `needs_manual_review` and deferred findings retain a light health-score impact; `acceptable_baseline` and `detector_false_positive` findings do not.

## Findings

| Finding | Table/file/route | Classification | Evidence | Risk | Smallest safe remediation | Code or migration required |
|---|---|---|---|---|---|---|
| `atlas_table_missing` `expenses` | Atlas table `expenses`; physical table `payables` | `detector_false_positive` | C07 atlas used business term `expenses`; repo uses `payables` in `supabase/migrations/legacy/002_additional_tables_and_rls.sql` and dashboard/API expense flows. | False blocker could encourage duplicate finance schema. | Add Architecture Doctor table alias `expenses -> payables`. | Detector code, completed. |
| `atlas_table_missing` `fundraising_campaigns` | Atlas table `fundraising_campaigns`; physical table `fundraising_items` | `detector_false_positive` | Fundraising migration 136 creates `fundraising_items`; public/admin fundraising code uses fundraising item terminology. | False blocker could create duplicate fundraising tables. | Add Architecture Doctor table alias `fundraising_campaigns -> fundraising_items`. | Detector code, completed. |
| `atlas_table_missing` `ndis_roles` | Atlas table `ndis_roles`; migration stub `20260502004639_035_ndis_roles.sql` | `needs_manual_review` | Local migration says change was applied directly to production and has no SQL body. | If production RLS is absent, NDIS role relationships may be overexposed. | Manually verify production table, grants, RLS, and policies; then add reviewed reconciliation SQL or evidence metadata. | Manual review first; migration only if production is missing coverage. |
| `atlas_table_missing` `users` | Atlas table `users`; physical/auth tables `auth.users` and `profiles` | `detector_false_positive` | Auth migration creates `profiles` linked to `auth.users`; user APIs read profile data. | False blocker could imply an unsafe public `users` table should be created. | Add Architecture Doctor table alias `users -> profiles`. | Detector code, completed. |
| `repo_table_unmapped` `analytics_sessions` | Table `analytics_sessions` | `detector_false_positive` | Visitor analytics migrations create and secure `analytics_sessions`; analytics agent/API use it. | Ownership was missing from manifest, not schema/RLS. | Map table to C12 analytics manifest. | Manifest code, completed. |
| `repo_table_unmapped` `design_latest_audit` | View `design_latest_audit` | `detector_false_positive` | Design migration creates `design_latest_audit` view for latest audit state. | Ownership was missing from manifest; not an unresolved security issue. | Map view to C22 design manifest. | Manifest code, completed. |
| `repo_table_unmapped` `subscription_orders` | Table `subscription_orders` | `detector_false_positive` | Subscription migrations create `subscription_orders`; security cleanup enables RLS. | Ownership was missing from manifest, not schema/RLS. | Map table to C03 order/subscription manifest. | Manifest code, completed. |
| `rls_missing_signal` `agent_workflow_memberships` | Table `agent_workflow_memberships` in `legacy/044_foreman.sql` | `true_positive_fix_now` | Table was created and seeded without RLS in local SQL. | Internal agent workflow metadata could be readable beyond intended staff/service contexts. | Add RLS, admin/owner read policy, and service-role management policy. | Migration completed in `20260709120000_150_agent_workflow_memberships_rls.sql`. |
| `rls_unknown` `expenses` | Logical table `expenses`; physical table `payables` | `detector_false_positive` | Payables migrations enable RLS and admin policies; `expenses` is dashboard language. | False unknown would hide the actual secured physical table. | Reuse table alias `expenses -> payables` for RLS evidence lookup. | Detector code, completed. |
| `rls_missing_signal` `feedback` | Storage bucket `feedback`; physical table `site_feedback` | `detector_false_positive` | API uploads to storage bucket `feedback` and inserts into `site_feedback`; `site_feedback` has RLS policies. | Storage `.from()` was parsed as table `.from()`, producing false table RLS gap. | Add table alias `feedback -> site_feedback` for atlas/RLS evidence. | Detector code, completed. |
| `rls_unknown` `fundraising_campaigns` | Logical table `fundraising_campaigns`; physical table `fundraising_items` | `detector_false_positive` | Migration 136 creates `fundraising_items`, enables RLS, and adds public read policy for live items. | False unknown could encourage duplicate campaign table. | Reuse table alias `fundraising_campaigns -> fundraising_items`. | Detector code, completed. |
| `rls_unknown` `induction_progress` | Column `applicants.induction_progress` | `detector_false_positive` | Migration 016 adds `induction_progress` as an `applicants` column; `applicants` RLS is covered by security cleanup. | Column was modeled as table; no standalone RLS can exist for a column. | Add table alias `induction_progress -> applicants`. | Detector code, completed. |
| `rls_unknown` `ndis_roles` | Atlas table `ndis_roles`; production-applied stub migration | `needs_manual_review` | Local SQL has no table or policy definition; production may contain the actual object. | Unknown RLS state on NDIS role data remains a real verification gap. | Baseline with owner and expiry; verify production and backfill reviewed SQL/evidence. | Manual review first; migration only if production is missing coverage. |
| `rls_unknown` `users` | Logical auth users; physical `profiles` and managed `auth.users` | `detector_false_positive` | Local app-level user table is `profiles`; Supabase manages `auth.users`; profile RLS is covered. | False unknown could imply creating a public `users` table. | Reuse table alias `users -> profiles`. | Detector code, completed. |
| `rls_missing_signal` `v_bud_approval_truth` | View `v_bud_approval_truth` | `detector_false_positive` | Migrations create it as a view; PostgreSQL RLS is table policy evidence, not direct view RLS evidence. | View was scored as a table RLS gap. | Mark discovered migration views as `confirmed_view` rather than missing table RLS. | Detector code, completed. |
| `rls_missing_signal` `v_pending_agent_actions` | View `v_pending_agent_actions` | `detector_false_positive` | Migrations create it as a view over agent actions/approval state. | View was scored as a table RLS gap. | Mark discovered migration views as `confirmed_view` rather than missing table RLS. | Detector code, completed. |

## Deferred Baseline

| Finding | Owner | Review date | Expiry date | Reason |
|---|---|---:|---:|---|
| `atlas_table_missing` `ndis_roles` | Operations / Compliance | 2026-08-08 | 2026-10-07 | Production-applied migration stub has no local SQL body; verify production before adding schema. |
| `rls_unknown` `ndis_roles` | Operations / Compliance | 2026-08-08 | 2026-10-07 | RLS state cannot be proven from repo-local evidence. |
