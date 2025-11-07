# Quick Setup Guide: Supabase + ngrok

This guide walks you through verifying your Supabase setup and configuring ngrok to expose your webhook endpoint.

## Part 1: Verify Supabase Setup

### Step 1: Check Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and open your project dashboard
2. Make sure your project is active and provisioned

### Step 2: Get Your Database Connection String

1. In Supabase Dashboard, go to **Settings → Database**
2. Scroll to **Connection Pooling → Direct Connection**
3. Copy the connection string (URI format)
4. Replace `[YOUR-PASSWORD]` with your actual database password
5. Convert it to asyncpg format by adding `+asyncpg` after `postgresql`:
   ```
   postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
   ```

### Step 3: Set Environment Variable

In your terminal (where you'll run the backend):

```bash
export SUPABASE_DATABASE_URL="postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
```

**Tip**: You can also create a `.env` file in the `backend/` directory:
```bash
cd backend
echo 'SUPABASE_DATABASE_URL="postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"' >> .env
```

### Step 4: Run the SQL Migration Script

1. Open Supabase Dashboard → **SQL Editor**
2. Open the file `backend/supabase_migration.sql` in your editor
3. Copy the entire contents of that file
4. Paste it into the SQL Editor
5. Click **Run** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
6. Verify the tables were created:
   - Go to **Table Editor** in the Supabase Dashboard
   - You should see a `meetings` table with all the columns

**Alternative**: If you skip this step, the app will auto-create tables when you start it (via `init_db()`), but running the SQL script ensures indexes and triggers are set up correctly.

### Step 5: Test Database Connection

Start your backend server:

```bash
cd backend
uv sync
export OPENAI_API_KEY="sk-proj-..."  # if you need it
export SUPABASE_DATABASE_URL="postgresql+asyncpg://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"
uv run uvicorn app.main:app --reload --port 8000
```

If it starts without errors, your Supabase connection is working! You should see:
- Server starting on `http://127.0.0.1:8000`
- No database connection errors

## Part 2: Set Up ngrok Tunneling

### Step 1: Install ngrok

**macOS (using Homebrew)**:
```bash
brew install ngrok/ngrok/ngrok
```

**Or download directly**:
- Go to [ngrok.com/download](https://ngrok.com/download)
- Download for your OS
- Extract and add to your PATH

### Step 2: Sign Up for ngrok (Free Account)

1. Go to [ngrok.com](https://ngrok.com) and sign up for a free account
2. After signing up, go to **Your Authtoken** page
3. Copy your authtoken

### Step 3: Configure ngrok

Run this command (replace `YOUR_AUTHTOKEN` with your actual token):
```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### Step 4: Start ngrok Tunnel

Make sure your backend is running on port 8000, then in a **new terminal window**:

```bash
ngrok http 8000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`) - this is your public webhook URL.

### Step 5: Test Your Webhook Endpoint

Your webhook endpoint will be available at:
```
https://[YOUR-NGROK-URL].ngrok-free.app/webhook/circleback
```

Test it with curl:
```bash
curl -X POST https://[YOUR-NGROK-URL].ngrok-free.app/webhook/circleback \
  -H "Content-Type: application/json" \
  -d '[{"id": 123, "name": "Test Meeting"}]'
```

You should get a response like:
```json
{
  "status": "success",
  "processed": 1,
  "total": 1,
  "errors": null
}
```

### Step 6: Verify Data in Supabase

1. Go to Supabase Dashboard → **Table Editor**
2. Click on the `meetings` table
3. You should see the test meeting data you just sent

## Troubleshooting

### Database Connection Issues

- **Error**: "SUPABASE_DATABASE_URL environment variable is required"
  - **Fix**: Make sure you've exported the environment variable before starting the server

- **Error**: "Connection refused" or SSL errors
  - **Fix**: Double-check your connection string format (should be `postgresql+asyncpg://...`) and the password is correct

### ngrok Issues

- **Error**: "authtoken not found"
  - **Fix**: Run `ngrok config add-authtoken YOUR_AUTHTOKEN`

- **Warning**: ngrok free tier shows a warning page
  - **Fix**: This is normal for free accounts. Visitors need to click through the warning page. For production, consider upgrading to a paid plan.

### Webhook Not Receiving Data

- Check that your backend is running: `curl http://localhost:8000/health`
- Check ngrok is forwarding: Look at the ngrok terminal for request logs
- Check backend logs for any errors when requests come in

## Next Steps

Once everything is working:

1. Use your ngrok URL (`https://[YOUR-NGROK-URL].ngrok-free.app/webhook/circleback`) as the webhook URL in CircleBack
2. For production, you'll want to:
   - Set up a custom domain with ngrok (paid plan)
   - Or deploy your backend to a cloud service (Vercel, Railway, etc.)
   - Set up proper webhook secret authentication (set `WEBHOOK_SECRET` environment variable)

