# ChatKit Python Backend

> For the steps to run both fronend and backend apps in this repo, please refer to the README.md at the top directory insteaad.

This FastAPI service wires up a minimal ChatKit server implementation with tools for weather and theme switching.

## Features

- **ChatKit endpoint** at `POST /chatkit` that streams responses using the ChatKit protocol when the optional ChatKit Python package is installed.
- **Guardrail-ready system prompt** extracted into `app/constants.py` so it is easy to modify.
- **REST helpers**
  - `GET  /health` – surface a basic health indicator
  - `GET  /api/meetings/recent` – get recent meetings from database
- **Webhook endpoint** at `POST /webhook/circleback` – receives meeting data and stores it in Supabase

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (recommended) or `pip`
- OpenAI API key
- Supabase project (for database)

### Database Setup (Supabase)

1. **Create a Supabase project** (if you don't have one):
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for the project to finish provisioning

2. **Get your database connection string**:
   - In Supabase Dashboard, go to **Settings → Database**
   - Scroll to **Connection Pooling → Direct Connection**
   - Copy the connection string (URI format)
   - Replace `[YOUR-PASSWORD]` with your database password
   - The connection string should look like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
     ```
   - Convert it to asyncpg format by adding `+asyncpg` after `postgresql`:
     ```
     postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
     ```

3. **Set up environment variable**:
   ```bash
   export SUPABASE_DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"
   ```

4. **Create database tables** (choose one method):
   - **Option A**: Run the SQL migration manually:
     - Open Supabase Dashboard → SQL Editor
     - Copy and paste the contents of `supabase_migration.sql`
     - Click "Run"
   - **Option B**: Let the app create tables automatically:
     - Tables will be created automatically when you start the server (via `init_db()`)

### Running the Backend

To enable the realtime assistant you need to install both the ChatKit Python package and the OpenAI SDK, then provide an `OPENAI_API_KEY` environment variable.

```bash
uv sync
export OPENAI_API_KEY=sk-proj-...
export SUPABASE_DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"
uv run uvicorn app.main:app --reload
```

The server will start on `http://127.0.0.1:8000` and automatically create database tables if they don't exist.

## Raw Markdown Transcripts

Place `.md` files in `app/raw_transcripts/` and restart the backend. They will be exposed as `@doc_{slug}` tags derived from filenames (lowercased; non-alphanumeric → `_`; repeated `_` collapsed).

Examples from this repo:

- `Oxy <> Weekly Planning.md` → `@doc_oxy_weekly_planning`
- `Craig - Oxy.md` → `@doc_craig_oxy`
- ` Andrew Fitasy Check In.md` → `@doc_andrew_fitasy_check_in`
- `Oxy Internal Sales Planning.md` → `@doc_oxy_internal_sales_planning`
- `Soraban <> Oxy - Weekly Sync.md` → `@doc_soraban_oxy_weekly_sync`

Notes:
- The transcript "summary" is optional and omitted from context if missing.
- The full Markdown file content is passed to the model as the transcript body.
