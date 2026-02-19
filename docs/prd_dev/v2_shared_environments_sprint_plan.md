# OxyChat V2 Shared Environments - Final Reconciled Sprint Plan

## 1) Final Clarified Decisions

1. Conversations are private per user in V2 (no shared conversation editing yet).
2. Every conversation belongs to a project-like object, including personal workspace containers.
3. Personal model uses synthetic personal client rows (`projects.client_id` remains non-null).
4. Private meeting visibility:
   - attendee-only
   - non-attendees see no trace.
5. Weekly rule:
   - canonical title: `Oxy <> Weekly Planning`
   - matching: normalized exact (`trim + casefold` only, no substring)
   - weekly is an explicit non-private exception by definition.
   - title-only matching is an intentional policy choice for V2 (accepted spoofing risk in non-production branch development).
6. Admin relink of private transcripts is blocked entirely.
7. Unclassified/unrouted transcripts are hidden until classified (fail-closed).
8. Routing sequence for non-private transcripts:
   - attendee client-domain match first
   - title alias match second (to catch internal syncs)
   - client inbox fallback
   - global triage fallback.
9. Admin access is across projects, not private transcripts of meetings they did not attend.
10. Mention sorting remains project-first then global, each newest -> oldest.
11. Keep sprint order `S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7`.
12. Performance strategy:
   - set numeric budgets now
   - early sprints record/report
   - Sprint 7 enforces CI hard gates.

## 2) Shared Conclusions Across 4 Engineer Reviews

1. Migration infrastructure must exist before any Sprint 1 migration tickets.
2. Backfill and NOT NULL enforcement must be race-safe.
3. ACL/no-leak policy must cover all surfaces:
   - list/search/detail
   - mentions
   - chat context injection path
   - tree/count metadata
   - audit timeline visibility.
4. Attendee persistence must be explicit in ingestion; schema alone is insufficient.
5. Some tickets are still too large and must be split (especially `S2-T09`).
6. Regression testing must happen every sprint, not only Sprint 7.
7. Seed fixtures must evolve per sprint to keep demos deterministic.

## 3) Architecture Decisions to Remove Ambiguity

### 3.1 ACL Implementation Choice

Use centralized TypeScript ACL module for all backend routes now (robust with current service-role pattern), plus defense-in-depth RLS tightening for direct transcript table access paths.

### 3.2 Core Schema Additions

1. `clients`
2. `projects` (`client_id` required)
3. `project_aliases`
4. `project_domains`
5. `user_roles`
6. `client_memberships`
7. `project_memberships`
8. `transcript_attendees`
9. `transcript_classification`
10. `transcript_project_links`
11. `documents` (project-owned + `visibility_scope`)
12. `audit_events` (append-only)
13. `conversations.project_id` + safe migration path

### 3.3 Sediment Alignment (V2 Baseline)

1. Keep current package source as `@ndrwsmyth/sediment` pinned to `git+https://github.com/ndrwsmyth/sediment.git#v0.1.1`.
2. Keep core imports from `@ndrwsmyth/sediment` and eval-only imports from `@ndrwsmyth/sediment/eval`.
3. Avoid introducing `@oxy/sediment` or bare `sediment` imports in this repo.
4. Preserve Sediment runtime observability (`request_id`, completion logs, audit correlation) and redacted logging defaults.

## 4) Sprint Plan (Atomic Tickets with Validation)

## Sprint 1 - Migration Infra, Foundations, Safe Project Backfill

**Goal**
Make migrations executable and safe, establish workspace schema and auth foundations, and bootstrap deterministic local/demo setup.

### Ticket Order (explicit dependency chain)

`S1-T00 -> S1-T00b -> S1-T00c -> S1-T01 -> S1-T02 -> S1-T03 -> (S1-T04,S1-T05,S1-T06,S1-T07,S1-T08,S1-T09,S1-T10) -> S1-T11 -> S1-T12 -> S1-T13 -> S1-T14 -> S1-T14b -> S1-T15 -> S1-T16 -> S1-T17 -> (S1-T18a,S1-T18b,S1-T19,S1-T20,S1-T21,S1-T22) -> S1-T23`

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S1-T00 | Set up versioned migration framework (ordered apply/rollback + state tracking) | migration smoke: up/down/rerun |
| S1-T00b | Reconcile `user_profiles` schema with auth middleware (`clerk_id`, `context`) | auth middleware integration test |
| S1-T00c | Sediment package/import guardrail check | verify `@ndrwsmyth/sediment#v0.1.1`, import paths, and CI auth/pnpm consistency |
| S1-T01 | Add enums (`role`, workspace/doc scopes) | migration test |
| S1-T02 | Create `clients` table | FK/uniqueness tests |
| S1-T03 | Create `projects` table (`client_id` non-null, supports personal projects via synthetic client) | FK tests + personal client fixture test |
| S1-T04 | Create `project_aliases` table | normalized uniqueness test |
| S1-T05 | Create `project_domains` table | normalized uniqueness test |
| S1-T06 | Create `user_roles` table | read-path role test |
| S1-T07 | Create `client_memberships` table | membership join tests |
| S1-T08 | Create `project_memberships` table | membership join tests |
| S1-T09 | Create `transcript_attendees` table | schema test |
| S1-T10 | Create `audit_events` table (append-only) | insert/read invariant test |
| S1-T11 | Add nullable `conversations.project_id` | migration test |
| S1-T12 | Add idempotent personal client + personal project bootstrap | concurrent bootstrap race test |
| S1-T13 | Enforce write-path project assignment on conversation create/update | route test; no new nulls |
| S1-T14 | Implement re-entrant backfill runner for `conversations.project_id` | resumable backfill test |
| S1-T14b | Add zero-null verification gate after backfill and before constraints | locked assertion test: null count == 0 |
| S1-T15 | Apply final constraints (`NOT NULL`, FK validation) | migration + rollback test |
| S1-T16 | Add centralized TypeScript ACL module and baseline invariants | ACL negative-path tests |
| S1-T17 | Add admin auth guard middleware (moved earlier) | unauthorized admin API tests |
| S1-T18a | Add early backend client CRUD APIs (admin-only) | endpoint contract tests |
| S1-T18b | Add early backend project CRUD APIs (admin-only) | endpoint contract tests |
| S1-T19 | Add alias/domain admin mutation APIs (admin-only) | endpoint tests |
| S1-T20 | Add `/api/workspaces/tree` endpoint (no transcript-derived counts in V2) | ACL-filtered integration test |
| S1-T21 | Add seed/bootstrap command with explicit fixture spec | clean-seed smoke test |
| S1-T22 | Add workspace-tree performance baseline (50 clients, 200 projects) | p95 report (< 250ms target) |
| S1-T23 | S1 demo validation gate | run S1 flow from clean seed |

## Sprint 2 - Classification, Ingestion Idempotency, No-Leak Enforcement

**Goal**
Implement deterministic transcript classification and enforce hidden-until-classified policy across all data surfaces.

### Ticket Order (explicit dependency chain)

`S2-T00 -> S2-T00b -> S2-T00c -> S2-T01 -> S2-T02 -> S2-T06a -> S2-T06b -> S2-T07 -> S2-T08 -> S2-T03 -> S2-T04 -> S2-T05 -> (S2-T09a,S2-T09b,S2-T09c,S2-T09d,S2-T09e1,S2-T09e2,S2-T09f,S2-T09g) -> S2-T10 -> S2-T11 -> S2-T12 -> S2-T13 -> S2-T14 -> S2-T15 -> S2-T16 -> S2-T17 -> S2-T18 -> S2-LAST`

### Temporary Scope Constraint

Do not ingest non-dummy sensitive transcripts before `S2-T09f` is complete.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S2-T00 | Persist/upsert `transcript_attendees` from webhook payload during ingest | ingestion integration test |
| S2-T00b | Backfill `transcript_attendees` from historical `raw_json` | backfill fixture test |
| S2-T00c | Backfill historical transcript classification and project links before visibility enforcement | backfill runner test with existing fixture transcripts |
| S2-T01 | Create `transcript_classification` table (`UNIQUE(transcript_id)`) | migration + uniqueness test |
| S2-T02 | Create `transcript_project_links` table + uniqueness constraints | migration + duplicate guard tests |
| S2-T06a | Add DB idempotency constraints for webhook retries | includes attendee dedupe `UNIQUE(transcript_id, normalized_email)`; duplicate-delivery test |
| S2-T06b | Add webhook retry semantics/ACK behavior | retried request integration test |
| S2-T07 | Normalize attendee/title matching helpers | case/whitespace tests |
| S2-T08 | Implement centralized visibility function (hide unclassified) | function invariants test |
| S2-T03 | Add `classifyTranscriptVisibilityTask` (weekly explicit non-private exception + fail-closed default hidden) | rule matrix tests |
| S2-T04 | Add `resolveProjectLinksTask` (domain -> title -> fallback chain) | precedence tests |
| S2-T05 | Make ingest atomic envelope (transcript + attendees + classification + links + audit) | rollback matrix test for each failing sub-write; hidden-until-classified verification |
| S2-T09a | Apply visibility function to transcript list endpoint | no-leak list test |
| S2-T09b | Apply visibility function to transcript search endpoint | no-leak search test |
| S2-T09c | Apply visibility function to transcript detail endpoint | no-leak detail test |
| S2-T09d | Apply visibility function to mention-source endpoint | no-leak mention test |
| S2-T09e1 | Audit tree/count surfaces for metadata leaks | negative-path tree metadata tests |
| S2-T09e2 | Audit conversation/reference surfaces for metadata leaks | negative-path reference tests |
| S2-T09f | Enforce ACL on chat mention injection path before context load | guessed-ID exploit test |
| S2-T09g | End-to-end private meeting ingestion-to-denial test across all surfaces | webhook -> classify -> deny on list/search/detail/mention/chat-context/tree/audit path tests |
| S2-T10 | Weekly exact normalization tests (trailing spaces, substring should fail) | edge-case tests |
| S2-T11 | Client inbox fallback for known client | routing test |
| S2-T12 | Global triage fallback for unknown client | routing test |
| S2-T13 | Block admin relink of private transcripts | policy test (403) |
| S2-T14 | Add routing audit event writes | audit row tests |
| S2-T15 | RLS defense-in-depth for transcripts direct select paths | policy test + docs |
| S2-T16 | Classification performance baseline | dataset: 200 transcripts, avg 4 attendees, 10 concurrent webhooks; p95 < 300ms classify step |
| S2-T17 | Extend seed fixtures with classification scenarios | fixture coverage test |
| S2-T18 | Add CI regression pipeline for cumulative suites on PRs | CI run on PR test |
| S2-LAST | Run S2 demo flow + S1 regression suite on clean seed | regression gate pass |

## Sprint 3 - Sidebar Hierarchy and URL Canonicalization

**Goal**
Deliver client/project folder UX with correct URL canonical behavior and transcript tag contract.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S3-T00 | Add backend transcript DTO contract for client/project tags | API contract tests |
| S3-T01 | Add `useWorkspaces` data hook | hook tests |
| S3-T02 | Build folder tree sidebar component | component tests |
| S3-T03 | Reduce sidebar logo size + hit target | visual regression check |
| S3-T04 | Add selected project URL state | navigation tests |
| S3-T05 | Add project filter to conversation list API | route tests |
| S3-T06 | Scope conversation hook by project | hook tests |
| S3-T07 | New chat scoped to selected project | integration test |
| S3-T08 | Breadcrumb context (`client / project`) | UI test |
| S3-T09 | Project-aware empty state | manual validation |
| S3-T10 | Project-switch loading state stabilization | unit test |
| S3-T11 | Unauthorized project selection guard | route+UI tests |
| S3-T12 | Keyboard shortcut behavior check | manual check |
| S3-T13 | Render transcript tags in panel from DTO contract | UI test |
| S3-T14 | URL conflict canonicalization (`?project` vs `?c`) | E2E URL correction test |
| S3-T15 | Sidebar performance baseline | dataset: 50 clients, 200 projects, 2000 conversations; p95 query < 250ms, p95 render < 120ms |
| S3-T16 | Extend seed with multi-client/multi-project conversation fixtures | fixture coverage test |
| S3-LAST | Run S3 demo flow + S1+S2 regression suite on clean seed | regression gate pass |

## Sprint 4 - Mention Scope + Project Overview Prompt Injection

**Goal**
Implement project-first mentions and safe overview injection with bounded prompt impact.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S4-T01 | Add project-overview retrieval task | task test |
| S4-T02 | Inject overview into prompt with structured markers | pipeline integration test |
| S4-T02b | Enforce ACL on overview retrieval before prompt injection | ACL denial/injection absence tests |
| S4-T03 | Add scoped mention query endpoint | contract test |
| S4-T04 | Enforce mention ordering per bucket | ordering test |
| S4-T05 | Add scope badges in popover | component test |
| S4-T06 | Guard mention-pill editor regressions | regression tests |
| S4-T07 | Add transcript panel project filter | manual validation |
| S4-T08 | Personal-chat global fallback path | route test |
| S4-T09 | Emit truncation metadata | integration test |
| S4-T10 | Add overview size limit/truncation policy | policy tests |
| S4-T11 | Mention endpoint performance baseline | p95 report (< 350ms @ 500 transcripts + 100 docs) |
| S4-T12 | Chat latency benchmark with context injection | dataset: full overview + 10 mention contexts; first SSE token p95 < 2s |
| S4-T13 | Extend seed with mention and overview-load fixtures | fixture coverage test |
| S4-LAST | Run S4 demo flow + S1-S3 regression suite on clean seed | regression gate pass |

## Sprint 5 - Admin Console + Project Operations

**Goal**
Ship admin project-control surfaces with typed errors and private-event audit redaction. User-role and membership mutation APIs are deferred.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S5-T01 | Admin UI shell/layout | UI tests |
| S5-T02 | Users tab skeleton | UI tests |
| S5-T03 | Projects tab skeleton | UI tests |
| S5-T04a | Projects table editor UI | integration tests |
| S5-T04b | Add backend transcript relink mutation API (non-private only) | endpoint contract + policy tests |
| S5-T04c | Transcript link editor UI | integration tests |
| S5-T05 | Project overview markdown editor UI | editor tests |
| S5-T06 | Add transcript relink conflict lock (10s / 409) | boundary timing test (9.9s/10.1s) |
| S5-T07 | Typed admin error contract (move from S7) | contract tests |
| S5-T08a | Admin audit timeline query + UI | visibility tests |
| S5-T08b | Private-event redaction in admin audit timeline for non-attendee admins | redaction tests |
| S5-T08c | Admin audit-surface leak tests (moved from Sprint 2) | private-event non-leak tests |
| S5-T09 | Admin API performance baseline | dataset: 50 projects, 100 concurrent relink/update ops; p95 < 250ms |
| S5-T10 | Extend seed with project-admin operation fixtures | fixture coverage test |
| S5-LAST | Run S5 demo flow + S1-S4 regression suite on clean seed | regression gate pass |

## Sprint 6 - Markdown Documents and Mentionability

**Goal**
Ship markdown upload, inheritance logic, mention support, and doc lifecycle guards.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S6-T01 | Create `documents` table + indexes | migration test |
| S6-T02 | Configure markdown storage policy (19MB cap) | policy tests |
| S6-T03 | Admin markdown upload endpoint | endpoint tests |
| S6-T04 | Content-hash dedupe | unit tests |
| S6-T05 | Client-level doc inheritance query logic | ACL edge-case tests |
| S6-T06 | Scoped doc mention search endpoint | contract tests |
| S6-T07a | Parse-input doc mention extraction | parser tests |
| S6-T07b | Chat-agent doc context injection | pipeline tests |
| S6-T08 | Admin DnD upload UI | component tests |
| S6-T09 | Upload progress/retry UX | UI state tests |
| S6-T10 | Doc tag rendering in mention/panel views | UI tests |
| S6-T11 | Doc delete endpoint + audit | endpoint tests |
| S6-T12 | Document search performance baseline | dataset: 50 docs up to 19MB, 500 queries; p95 < 500ms |
| S6-T13 | Document lifecycle/orphaning guard (project delete/move handling) | transactional lifecycle tests |
| S6-T14 | Extend seed with document fixtures | fixture tests |
| S6-LAST | Run S6 demo flow + S1-S5 regression suite on clean seed | regression gate pass |

## Sprint 7 - Hardening and Release Stabilization

**Goal**
Turn reports into enforceable release gates and finalize RC package.

### Tickets

| ID | Atomic Ticket | Validation |
|---|---|---|
| S7-T00 | Comprehensive cross-sprint smoke suite (kept) | CI full-suite pass |
| S7-T01 | Expand ACL invariants | integration suite pass |
| S7-T02 | Expand routing determinism suite | regression pass |
| S7-T03 | Sediment `request_id` -> `audit_events` correlation checks | integration test |
| S7-T04 | Final index tune-up verification only (not first index work) | `EXPLAIN ANALYZE` checks |
| S7-T05 | CI hard perf gates using thresholds from S1-S6 | CI policy pass |
| S7-T06 | Release runbook/checklists | checklist sign-off |
| S7-T07 | Observability query pack | query validation |
| S7-T08 | RC stabilization checklist and freeze gate | sign-off |
| S7-LAST | Final go/no-go gate from clean seed | release gate pass |

## 5) Required Test Matrix Additions

1. Private no-leak across list/search/detail/mention/chat-context paths.
2. Weekly match normalization tests (exact normalized only, substring false).
3. Reclassification and relink tests:
   - private relink blocked
   - private events redacted in admin audit timeline for non-attendee admins.
4. Migration concurrency:
   - concurrent conversation writes during backfill
   - interrupted backfill resume.
5. Ingestion idempotency:
   - duplicate webhook deliveries produce stable single classification state.
6. URL canonicalization E2E:
   - frontend URL corrected to conversation’s true project after backend response.
7. Backfill constraint safety:
   - zero-null gate runs before `NOT NULL` enforcement.
8. Admin API ordering safety:
   - admin auth guard is active before any admin mutation endpoints.
9. End-to-end private transcript flow:
   - webhook -> attendee persist -> classify private -> deny non-attendee on all surfaces.

## 6) Deferred to Future Version

1. Admin user-role mutation APIs.
2. Admin user membership mutation APIs.
3. Revocation-next-request user-membership test flows tied to those APIs.
