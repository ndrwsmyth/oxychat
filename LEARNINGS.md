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

## Sprint Learnings - 2026-02-25 (Frontend Sidebar Stabilization)

- Use one source of truth for sidebar state (`collapsed`) and drive visibility from CSS; timer-backed phase state introduces race windows and glitch frames.
- Keep expanded content mounted during open/close transitions; animate visibility, not presence, to avoid blank/pop states on rapid toggles.
- Lock icon-rail x-position for all core icons (logo, new chat, search, workspace, avatar); only labels should fade, icons should not translate laterally.
- Treat the user avatar as a persistent anchor in both states; reserve its slot so it never disappears, jumps, or snaps during transitions.
- Use a fixed three-zone footer layout in expanded mode: left avatar, center theme toggle, right collapse control with right-edge alignment.
- Do not remove established interaction affordances (for example rail click toggle) during stabilization without explicit product sign-off.
- Ensure interactive elements always expose pointer/hover affordance so users can discover click targets.
- Use one shared motion contract (duration + easing) for rail width and content fade/shift to prevent desync between parent and child animation tracks.
- Keep debug alignment overlays for development diagnostics, but gate runtime activation to development only.
- Make rapid-toggle QA a blocking check on desktop and mobile (button, keyboard shortcut, and mobile open/close paths), not only single-path happy flows.

## Sprint Learnings - 2026-02-25 (Sprint 3 Closeout + Perf Validation)

- Keep status docs synchronized with the latest generated benchmark artifacts after every gate rerun; stale numeric claims quickly become contradictory.
- Distinguish benchmark policy from benchmark measurement: if a benchmark is warn-only in gate enforcement, call that out explicitly in closeout docs.
- For high-cardinality sidebar tree loads, move ACL + aggregation into a DB-side function and back it with a partial index to keep p95 query latency within sprint targets.
- Keep RPC-to-legacy fallback behavior for phased migration rollouts so local/staging environments do not break when function availability lags.
- Treat `gate:s3` completion as the source of truth for Sprint 3 closeout (including nested regression gates), not individual command spot checks.

## Sprint Learnings - 2026-02-26 (Sprint 4 Frontend Toolchain Stabilization)

- In mixed-root repos, Tailwind v4 PostCSS resolution can drift to repo root under Turbopack; pin `@tailwindcss/postcss` `base` to frontend project root in `postcss.config.mjs`.
- `next.config` webpack module-resolution tweaks do not guarantee Turbopack CSS/PostCSS resolution behavior; treat webpack and Turbopack as separate execution paths.
- Normalize `dev/build/start` script environments (`NODE_ENV`, clear `NODE_PATH`) to reduce shell-level resolver pollution and non-reproducible local failures.
- Keep Next PostCSS config in supported shape (plugin object map). Invalid plugin shape can mask real resolver issues with generic “Malformed PostCSS Configuration.”
- For “Can’t resolve 'tailwindcss'” traces, use the `using description file:` path as the primary signal; if it points at repo root instead of frontend root, debug root selection first.
