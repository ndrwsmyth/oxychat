DROP INDEX IF EXISTS idx_user_profiles_clerk_id;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_clerk_id_unique;

ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS clerk_id,
  DROP COLUMN IF EXISTS context;

ALTER TABLE user_profiles
  ALTER COLUMN id DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_id_fkey'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;
