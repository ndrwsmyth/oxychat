-- ============================================================================
-- OxyChat Migration: Model Consistency + Claude 4.6 Naming Cleanup
-- ============================================================================
-- Purpose:
-- 1) Align conversations.model default with backend DEFAULT_MODEL.
-- 2) Migrate legacy Claude 4.5 model keys to official Claude 4.6 IDs.
-- 3) Repair invalid/empty/null model values to the canonical default.
--
-- Canonical default:
--   claude-sonnet-4-6
--
-- Run context:
-- - Execute once in Supabase SQL Editor (target environment only).
-- - Safe to re-run (idempotent updates using WHERE filters).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: Align DB default with backend DEFAULT_MODEL
-- ----------------------------------------------------------------------------
ALTER TABLE conversations
  ALTER COLUMN model SET DEFAULT 'claude-sonnet-4-6';

-- ----------------------------------------------------------------------------
-- Step 2: Upgrade legacy Claude naming (4.5 -> 4.6)
-- ----------------------------------------------------------------------------
UPDATE conversations
SET model = 'claude-sonnet-4-6'
WHERE model = 'claude-sonnet-4.5';

UPDATE conversations
SET model = 'claude-opus-4-6'
WHERE model = 'claude-opus-4.5';

-- ----------------------------------------------------------------------------
-- Step 3: Repair invalid, empty, or null values
-- ----------------------------------------------------------------------------
UPDATE conversations
SET model = 'claude-sonnet-4-6'
WHERE model IS NULL
   OR btrim(model) = ''
   OR model NOT IN (
     'claude-sonnet-4-6',
     'claude-opus-4-6',
     'gpt-5.2',
     'grok-4'
   );

COMMIT;

-- ----------------------------------------------------------------------------
-- Post-migration validation queries
-- ----------------------------------------------------------------------------
-- 1) Verify default:
-- SELECT column_default
-- FROM information_schema.columns
-- WHERE table_name = 'conversations' AND column_name = 'model';
--
-- 2) Verify no legacy/invalid values remain:
-- SELECT model, COUNT(*) AS count
-- FROM conversations
-- GROUP BY model
-- ORDER BY count DESC;
--
-- 3) Quick sanity check for invalid rows (should be 0):
-- SELECT COUNT(*) AS invalid_count
-- FROM conversations
-- WHERE model IS NULL
--    OR btrim(model) = ''
--    OR model NOT IN ('claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-5.2', 'grok-4');

-- ----------------------------------------------------------------------------
-- Rollback guidance (manual)
-- ----------------------------------------------------------------------------
-- If rollback is required:
-- 1) Restore previous default explicitly:
--    ALTER TABLE conversations ALTER COLUMN model SET DEFAULT 'gpt-5.2';
-- 2) Restore row values from backup/snapshot taken before this migration.
--    (Do not attempt automatic reverse mapping without a pre-migration backup.)
