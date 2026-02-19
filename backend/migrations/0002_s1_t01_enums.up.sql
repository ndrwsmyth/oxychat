DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('admin', 'member');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_scope') THEN
    CREATE TYPE workspace_scope AS ENUM ('personal', 'client', 'global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_scope') THEN
    CREATE TYPE document_scope AS ENUM ('project', 'client', 'global');
  END IF;
END
$$;
