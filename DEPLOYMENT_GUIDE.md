# OxyChat Deployment Guide (Web UI Setup)
Last updated: Jan 20, 2026

Step-by-step guide to deploy OxyChat using the web dashboards for Railway, Vercel, and GitHub Actions.

---

## Overview

| Service | Purpose | Account |
|---------|---------|---------|
| **GitHub** | Code repository, CI/CD | Personal |
| **Vercel** | Frontend hosting (Next.js) | Company |
| **Railway** | Backend hosting (FastAPI) | Company |
| **Supabase** | Database (PostgreSQL) | Already set up |

---

## Part 1: Railway Setup (Backend)

### Step 1.1: Create Railway Account/Project

1. Go to [railway.app](https://railway.app)
2. Sign up with your **company email**
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. You'll be prompted to connect GitHub - click **"Connect GitHub"**
6. In the popup, authorize Railway to access your **personal GitHub**
7. Select the `oxychat` repository

### Step 1.2: Configure the Service

1. Once imported, Railway will create a service. Click on it.
2. Go to **Settings** tab:
   - **Source** section:
     - Root Directory: `backend`
     - Watch Paths: `/backend/**`
   - **Build** section:
     - Builder: `Dockerfile`
     - Dockerfile Path: `Dockerfile` (relative to Root Directory) or `backend/Dockerfile` (if Railway asks for repo-relative path)
   - **Deploy** section:
     - Custom Start Command: *(leave empty, Dockerfile handles it)*

3. Go to **Networking** tab:
   - Click **"Generate Domain"** under Public Networking
   - Copy this URL (e.g., `oxychat-production.up.railway.app`)
   - **Note**: Railway automatically handles port mapping (default port 8000). No manual port configuration needed.
   - **Save this URL** - you'll need it for Vercel and CircleBack

### Step 1.3: Add Environment Variables

1. Go to **Variables** tab
2. Click **"+ New Variable"** for each:

| Variable | Value |
|----------|-------|
| `SUPABASE_DATABASE_URL` | `postgresql+asyncpg://postgres:[PASSWORD]@[PROJECT].pooler.supabase.com:5432/postgres` |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (optional) |
| `ALLOWED_ORIGINS` | `https://oxychat.vercel.app` (update after Vercel setup) |

3. Click **"Deploy"** to apply changes

### Step 1.4: Get Railway Token for CI/CD

1. Click your profile icon (top right) → **"Account Settings"**
2. Go to **"Tokens"** tab
3. Click **"+ New Token"**
4. Name it `github-actions`
5. **Copy and save the token** securely

### Step 1.5: Get Railway Project ID

1. Go back to your project
2. Look at the URL: `https://railway.app/project/[PROJECT-ID]`
3. **Copy the PROJECT-ID** (the part after `/project/`)

---

## Part 2: Vercel Setup (Frontend)

### Step 2.1: Create Vercel Account/Project

1. Go to [vercel.com](https://vercel.com)
2. Sign up with your **company email**
3. Click **"Add New..."** → **"Project"**
4. Click **"Continue with GitHub"**
5. Authorize Vercel to access your **personal GitHub**
6. Find and select the `oxychat` repository
7. Click **"Import"**

### Step 2.2: Configure Build Settings

On the configuration screen:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `frontend` (click Edit, type `frontend`) |
| Build Command | `pnpm run build` |
| Install Command | `pnpm install` |

### Step 2.3: Add Environment Variables

Before clicking Deploy, add environment variables:

1. Expand **"Environment Variables"** section
2. Add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway URL from Step 1.2 (e.g., `https://oxychat-production.up.railway.app`) |

3. Click **"Deploy"**

### Step 2.4: Get Your Vercel Domain

1. After deployment completes, note your domain
2. It will be something like `oxychat.vercel.app` or `oxychat-[random].vercel.app`
3. **Go back to Railway** and update `ALLOWED_ORIGINS` with this URL

### Step 2.5: Get Vercel Tokens for CI/CD

1. Click your profile icon → **"Account Settings"**
2. Go to **"Tokens"** tab
3. Click **"Create"**
4. Name: `github-actions`, Scope: Full Account
5. **Copy and save the token**

### Step 2.6: Get Vercel Project & Org IDs

1. Go to your project in Vercel
2. Click **"Settings"** tab
3. Scroll to **"Project ID"** - **copy it**
4. Look for **"Team ID"** (or Org ID) in the URL or settings - **copy it**
   - If personal account (no team), this is your user ID from Account Settings

---

## Part 3: GitHub Actions Setup

### Step 3.1: Add Repository Secrets

1. Go to your GitHub repository
2. Click **"Settings"** tab
3. Left sidebar: **"Secrets and variables"** → **"Actions"**
4. Click **"New repository secret"** for each:

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `RAILWAY_TOKEN` | Your Railway token | Part 1, Step 1.4 |
| `RAILWAY_PROJECT_ID` | Your Railway project ID | Part 1, Step 1.5 |
| `VERCEL_TOKEN` | Your Vercel token | Part 2, Step 2.5 |
| `VERCEL_ORG_ID` | Your Vercel Org/Team ID | Part 2, Step 2.6 |
| `VERCEL_PROJECT_ID` | Your Vercel Project ID | Part 2, Step 2.6 |
| `SUPABASE_DATABASE_URL` | Your database connection string | Same as Railway |

### Step 3.2: Add Repository Variables

1. Still in **"Secrets and variables"** → **"Actions"**
2. Click **"Variables"** tab
3. Click **"New repository variable"** for each:

| Variable Name | Value |
|---------------|-------|
| `RAILWAY_PRODUCTION_URL` | Your Railway URL (e.g., `https://oxychat-production.up.railway.app`) |
| `VERCEL_PRODUCTION_URL` | Your Vercel URL (e.g., `https://oxychat.vercel.app`) |

### Step 3.3: Create Environments (Optional but Recommended)

1. In Settings, go to **"Environments"**
2. Click **"New environment"**
3. Create two environments:
   - `preview` - for PR deployments
   - `production` - for main branch (optionally add required reviewers)

---

## Part 4: CircleBack Webhook Setup

### Step 4.1: Configure Webhook

1. Go to your CircleBack dashboard
2. Navigate to **Integrations** or **Webhooks** settings
3. Add a new webhook:

| Setting | Value |
|---------|-------|
| URL | `https://[YOUR-RAILWAY-URL]/webhook/circleback` |
| Method | POST |
| Content-Type | application/json |

### Step 4.2: (Optional) Add Webhook Secret

For extra security:
1. Generate a random secret (e.g., use a password generator)
2. Add it to CircleBack webhook settings
3. Add `WEBHOOK_SECRET` variable in Railway with the same value

---

## Part 5: Test Your Deployment

### Step 5.1: Verify Backend

1. Open: `https://[YOUR-RAILWAY-URL]/health`
2. You should see:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "openai": "configured",
    "anthropic": "configured",
    "database": "configured"
  }
}
```

3. Check API docs: `https://[YOUR-RAILWAY-URL]/docs`

### Step 5.2: Verify Frontend

1. Open your Vercel URL
2. Start a new conversation
3. Send a test message
4. Verify streaming response works

### Step 5.3: Test Webhook

```bash
curl -X POST https://[YOUR-RAILWAY-URL]/webhook/circleback \
  -H "Content-Type: application/json" \
  -d '{"id": 999, "name": "Test Meeting", "date": "2025-01-20"}'
```

Should return: `{"status": "success", ...}`

---

## Part 6: CI/CD Workflow

Once everything is set up, the workflow is:

### For New Features:
```bash
# Create feature branch
git checkout -b feature/my-new-feature

# Make changes, commit
git add .
git commit -m "Add my new feature"

# Push branch
git push -u origin feature/my-new-feature

# Open PR on GitHub
# → CI runs automatically
# → Preview URLs posted in PR comments
```

### To Deploy to Production:
```bash
# Merge PR to main (via GitHub UI or CLI)
git checkout main
git pull
git merge feature/my-new-feature
git push

# → CI/CD runs automatically
# → Deploys to Railway + Vercel
# → Runs database migrations
```

---

## Quick Reference

### URLs After Setup

| Service | URL Pattern |
|---------|-------------|
| Frontend (Prod) | `https://oxychat.vercel.app` |
| Frontend (Preview) | `https://oxychat-[branch]-[user].vercel.app` |
| Backend (Prod) | `https://oxychat-production.up.railway.app` |
| Backend Health | `https://[backend]/health` |
| Backend Docs | `https://[backend]/docs` |
| Webhook | `https://[backend]/webhook/circleback` |

### Environment Variables Summary

**Railway (Backend):**
- `SUPABASE_DATABASE_URL` - Database connection
- `OPENAI_API_KEY` - GPT models
- `ANTHROPIC_API_KEY` - Claude models (optional)
- `ALLOWED_ORIGINS` - Frontend URL(s)
- `WEBHOOK_SECRET` - CircleBack verification (optional)

**Vercel (Frontend):**
- `NEXT_PUBLIC_API_URL` - Backend URL

**GitHub Secrets:**
- `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `SUPABASE_DATABASE_URL`

---

## Troubleshooting

### "CORS error" in browser console
→ Update `ALLOWED_ORIGINS` in Railway to include your Vercel URL

### Railway build fails
→ Check Railway logs, ensure Dockerfile is in `backend/` directory

### Vercel build fails
→ Check build logs, ensure `NEXT_PUBLIC_API_URL` is set

### Webhook not receiving meetings
→ Verify URL ends with `/webhook/circleback` (not just `/webhook`)

### Database connection fails
→ Ensure `SUPABASE_DATABASE_URL` includes `+asyncpg` after `postgresql`

---

## Custom Domain (Optional)

### For Vercel:
1. Project Settings → Domains
2. Add your domain (e.g., `chat.oxy.agency`)
3. Update DNS as instructed

### For Railway:
1. Service Settings → Networking → Custom Domain
2. Add your domain (e.g., `api.oxy.agency`)
3. Update DNS as instructed
4. Update `NEXT_PUBLIC_API_URL` in Vercel
