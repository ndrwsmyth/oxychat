## Sprint Learnings – 2026-02-19

- Validate every required env var for each script path before first run; do not assume one DB URL covers all code paths.
- Distinguish PostgREST config (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`) from direct Postgres config (`SUPABASE_DATABASE_URL`) and test both explicitly.
- After dropping/recreating `public`, always restore schema/table/sequence/routine grants and default privileges before running seed or backfill.
- Make reset/bootstrap scripts fully self-healing; never require manual SQL grant fixes between reset and seed.
- Treat benchmark scripts as data-mutating; isolate their fixtures or clean up after run so validation data is not polluted.
- If a sprint has numeric perf targets, gate should fail on threshold breach or emit a hard WARN with explicit follow-up ownership.
- Run the full end-to-end gate once immediately after implementing scripts, not after multiple downstream tasks.
- Provide shell-safe verification commands (quote correctly) when asking users to inspect env from CLI.

## Sprint Learnings - 2026-02-20

- For `db:reset` failures, classify quickly:
  - `ENOTFOUND` = network/DNS/URL host issue (`SUPABASE_DATABASE_URL`), not schema code.
  - `relation ... does not exist` during baseline apply = schema snapshot ordering/completeness issue.
- Never assume switching to pooler is active; verify the exact runtime host with a one-liner that prints `new URL(process.env.SUPABASE_DATABASE_URL).hostname`.
- In this repo, `seed:s2` depends on `db:reset` success. If reset fails, downstream "missing table" seed errors are secondary and should not be debugged first.
- Keep `backend/schema.sql` baseline self-consistent with migration-era dependencies. If baseline references `projects`, `user_roles`, or memberships, those tables/enums must exist in baseline before references/policies/triggers.
- After major schema edits, validate both:
  - isolated checks (`lint`, `test`)
  - full operational gate (`gate:s2`) to catch reset/bootstrap path bugs not covered by unit tests.
- When giving user runbooks, provide one command per line without bracket wrappers (`[]`) to avoid zsh parse errors during copy/paste.
- For user troubleshooting, ask for exact command output and branch once from the first root cause; avoid sending broad rerun sequences before the primary blocker is fixed.
- Update sprint status docs only after gate evidence is green (for S2: `gate:s2` PASS, benchmark PASS, and S1 regression PASS).
