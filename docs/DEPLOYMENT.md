# OxyChat Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ENVIRONMENTS                               │
├─────────────────┬─────────────────────┬─────────────────────────────┤
│     LOCAL       │      STAGING        │        PRODUCTION           │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ localhost:3000  │ Vercel preview      │ oxychat.oxy.co              │
│ (Next.js dev)   │                     │ (Vercel)                    │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ localhost:8000  │ Railway staging     │ Railway production          │
│ (Hono dev)      │                     │                             │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ Supabase DEV    │ Supabase DEV        │ Supabase PROD               │
│ (shared)        │ (shared)            │ (separate project)          │
├─────────────────┼─────────────────────┼─────────────────────────────┤
│ Clerk DEV       │ Clerk DEV           │ Clerk PROD                  │
│ (shared)        │ (shared)            │ (separate instance)         │
└─────────────────┴─────────────────────┴─────────────────────────────┘
```

**Key principle**: Local and Staging share dev resources. Production is fully isolated.

---

## Services Overview

| Service | Purpose | Dev/Staging | Production |
|---------|---------|-------------|------------|
| Vercel | Frontend hosting | Preview deploys | `oxychat.oxy.co` |
| Railway | Backend hosting | Staging service | Production service |
| Supabase | Database + storage | Dev project | Prod project (separate) |
| Clerk | Authentication | Development mode | Production mode |

---

## 1. Clerk Setup

### Development Instance (Local + Staging)

1. Create app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Configure in **Development** mode:
   - **User & Authentication** → **Social connections** → Enable Google only
   - **User & Authentication** → **Restrictions** → **Allowlist** → Add `oxy.so`
   - **Webhooks** → Add endpoint (see below)

### Webhook Setup

| Environment | URL |
|-------------|-----|
| Staging | `https://[your-vercel-app].vercel.app/api/webhooks/clerk` |
| Production | `https://oxychat.oxy.co/api/webhooks/clerk` |

Subscribe to: `user.created`, `user.updated`

### Local Dev Workaround

Local won't receive webhooks. Options:
1. **Sign in via staging first** - user syncs to Supabase, then local works
2. **Manual insert** - add yourself to `user_profiles` table directly
3. **ngrok** - tunnel for local webhook testing (overkill for solo dev)

### Production Instance

When ready for prod:
1. Clerk Dashboard → **API Keys** → switch to **Production**
2. Reconfigure same settings
3. Update webhook URL to production domain

---

## 2. Supabase Setup

### Development Project

1. Create project at [supabase.com](https://supabase.com) → name it `oxychat-dev`
2. Run the schema from `backend/schema.sql`
3. Run Clerk migration (below)

### Clerk Migration

Run in SQL Editor:

```sql
-- Remove old Supabase Auth FK (we use Clerk now)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Auto-generate UUIDs for new users
ALTER TABLE user_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add Clerk columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS context TEXT;
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id ON user_profiles(clerk_id);
```

### Production Project

When ready: create separate `oxychat-prod` project, run same migrations.

---

## 3. Environment Variables

### Frontend

**Local** (`frontend/.env.local`):
```bash
# Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase DEV
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Clerk DEV
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Clerk routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
```

**Vercel** (set in Dashboard → Settings → Environment Variables):

| Variable | Preview | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_API_URL` | Railway staging URL | Railway prod URL |
| `NEXT_PUBLIC_SUPABASE_URL` | DEV | PROD |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DEV | PROD |
| `SUPABASE_SERVICE_KEY` | DEV | PROD |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | DEV secret | PROD secret |

### Backend

**Local** (`backend/.env`):
```bash
PORT=8000
NODE_ENV=development

# Supabase DEV
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Clerk DEV
CLERK_SECRET_KEY=sk_test_...

# LLM
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**Railway** (set in Dashboard → Variables):

| Variable | Staging | Production |
|----------|---------|------------|
| `PORT` | 8000 | 8000 |
| `NODE_ENV` | staging | production |
| `SUPABASE_URL` | DEV | PROD |
| `SUPABASE_SERVICE_KEY` | DEV | PROD |
| `CLERK_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `ANTHROPIC_API_KEY` | (shared) | (shared) |
| `OPENAI_API_KEY` | (shared) | (shared) |

---

## 4. Vercel Setup

1. Import `ndrwsmyth/oxychat` repo at [vercel.com](https://vercel.com)
2. Framework Preset: **Next.js** (auto-detected)
3. Set **Root Directory** to `frontend`
4. Build & Output Settings:
   - **Build Command**: leave as default (`next build`)
   - **Output Directory**: leave as default
   - **Install Command**: override to `pnpm install`
5. Add environment variables (see above)
6. Deploy

**Custom domain** (production): Settings → Domains → Add `oxychat.oxy.co`

---

## 5. Railway Setup

1. Create project at [railway.app](https://railway.app)
2. Deploy from GitHub → select repo
3. Configure service:
   - **Root Directory**: `backend`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm start`
4. Add environment variables

### Environments

Railway supports multiple environments. For now, use single environment (staging). When ready for prod:
- Create "Production" environment in project settings
- Set prod env vars
- Deploy manually or from tags

---

## 6. Deployment Flow

### Current (Pre-v1)

```
Push to main → Vercel preview + Railway staging
Manual deploy → Production (when ready)
```

### Future (Post-v1)

```
main branch      → Staging (auto)
production branch → Production (auto)
```

Can use git worktrees to work on both branches simultaneously.

---

## 7. Local Development

```bash
# Install
pnpm install

# Set up env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit with your DEV keys

# Run
pnpm start
```

Frontend: http://localhost:3000
Backend: http://localhost:8000

---

## 8. Claude Code PR Reviews

To enable automated PR reviews:

1. Install [Claude Code GitHub App](https://github.com/apps/claude) on the repo
2. Create `.github/claude-code.yml`:

```yaml
# Auto-review PRs
auto_review:
  enabled: true

# Review criteria
review:
  - Check for security issues
  - Verify TypeScript types
  - Check for accessibility (ARIA labels, keyboard nav)
  - Ensure CSS uses design tokens (no hardcoded values)
  - Verify error handling
```

3. PRs will get automated review comments

---

## 9. Production Checklist

Before going live:

- [ ] Create Supabase production project
- [ ] Run migrations on prod database
- [ ] Enable Clerk production mode
- [ ] Set prod webhook URL in Clerk
- [ ] Configure all Vercel prod env vars
- [ ] Configure all Railway prod env vars
- [ ] Set up custom domain DNS
- [ ] Test full auth flow end-to-end
- [ ] Fill in team who's who in `backend/src/lib/constants.ts`

---

## Quick Reference

| Environment | Frontend | Backend |
|-------------|----------|---------|
| Local | `localhost:3000` | `localhost:8000` |
| Staging | `[app].vercel.app` | `[app].up.railway.app` |
| Production | `oxychat.oxy.co` | Railway prod URL |
