ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

ALTER TABLE user_profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS clerk_id TEXT,
  ADD COLUMN IF NOT EXISTS context TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_clerk_id_unique'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_clerk_id_unique UNIQUE (clerk_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id
  ON user_profiles(clerk_id);
