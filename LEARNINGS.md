## Sprint Learnings – 2026-02-19

- Validate every required env var for each script path before first run; do not assume one DB URL covers all code paths.
- Distinguish PostgREST config (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`) from direct Postgres config (`SUPABASE_DATABASE_URL`) and test both explicitly.
- After dropping/recreating `public`, always restore schema/table/sequence/routine grants and default privileges before running seed or backfill.
- Make reset/bootstrap scripts fully self-healing; never require manual SQL grant fixes between reset and seed.
- Treat benchmark scripts as data-mutating; isolate their fixtures or clean up after run so validation data is not polluted.
- If a sprint has numeric perf targets, gate should fail on threshold breach or emit a hard WARN with explicit follow-up ownership.
- Run the full end-to-end gate once immediately after implementing scripts, not after multiple downstream tasks.
- Provide shell-safe verification commands (quote correctly) when asking users to inspect env from CLI.
