# Webhook Testing Guide

## Step 1: Start the Backend

The backend will automatically create the database tables when it starts.

```bash
cd backend
uv sync  # Install dependencies if you haven't already
uv run uvicorn app.main:app --reload --port 8000
```

You should see output like:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

The database tables will be created automatically on startup.

## Step 2: Send a Test Webhook

Use this sample payload to test the webhook endpoint. Save it to a file or use it directly with curl.

### Sample JSON Payload (`test_webhook.json`)

```json
[{
  "id": 1234,
  "name": "Event Venue Review",
  "createdAt": "2023-07-25T20:30:57.926Z",
  "duration": 1306.09,
  "url": "https://meet.google.com/abc-defgh-xyz",
  "recordingUrl": null,
  "tags": ["Events"],
  "icalUid": "1a2b3c@google.com",
  "attendees": [
    { "name": "John Appleseed", "email": "john@example.com" },
    { "name": "Samantha Grey", "email": "sam@example.com" }
  ],
  "notes": "#### Overview\n*   Several options for event venues were reviewed...",
  "actionItems": [],
  "transcript": [
    { "speaker": "John Appleseed", "text": "Hey, how's it going?", "timestamp": 4.56 },
    { "speaker": "Samantha Grey", "text": "Going well, thanks for asking!", "timestamp": 18.32 },
    { "speaker": "John Appleseed", "text": "Great! Let's discuss the venue options.", "timestamp": 25.10 }
  ],
  "insights": {}
}]
```

### Send the Webhook (without secret - for local dev)

```bash
curl -X POST http://localhost:8000/webhook/circleback \
  -H "Content-Type: application/json" \
  -d @test_webhook.json
```

Or inline:

```bash
curl -X POST http://localhost:8000/webhook/circleback \
  -H "Content-Type: application/json" \
  -d '[{
    "id": 1234,
    "name": "Event Venue Review",
    "createdAt": "2023-07-25T20:30:57.926Z",
    "attendees": [
      { "name": "John Appleseed", "email": "john@example.com" }
    ],
    "notes": "Test notes",
    "transcript": [
      { "speaker": "John", "text": "Hello", "timestamp": 1.0 }
    ]
  }]'
```

### Expected Response

```json
{
  "status": "success",
  "processed": 1,
  "total": 1,
  "errors": null
}
```

## Step 3: Verify Data Was Stored

### Option 1: Check via API Endpoint

```bash
curl http://localhost:8000/api/meetings/recent?limit=10
```

Expected response:
```json
{
  "meetings": [
    {
      "id": "doc_1234",
      "title": "Event Venue Review",
      "date": "2023-07-25"
    }
  ]
}
```

### Option 2: Check Database Directly

```bash
psql -d oxychat -U andrewsmyth
```

Then run:
```sql
-- See all meetings
SELECT id, meeting_id, doc_id, title, date, source, created_at FROM meetings;

-- See formatted content
SELECT doc_id, title, LEFT(formatted_content, 200) as content_preview FROM meetings;

-- See full meeting details
SELECT * FROM meetings WHERE meeting_id = 1234;
```

Exit psql with `\q`

### Option 3: Check Specific Meeting Details

```bash
# Get full details of a specific meeting by doc_id
curl http://localhost:8000/api/meetings/recent | jq '.meetings[] | select(.id == "doc_1234")'
```

## Step 4: Test Multiple Meetings

Send multiple meetings in one payload:

```bash
curl -X POST http://localhost:8000/webhook/circleback \
  -H "Content-Type: application/json" \
  -d '[{
    "id": 1001,
    "name": "Meeting One",
    "createdAt": "2024-01-01T10:00:00Z",
    "attendees": [{"name": "Alice", "email": "alice@example.com"}],
    "notes": "First meeting",
    "transcript": [{"speaker": "Alice", "text": "Hello", "timestamp": 0}]
  }, {
    "id": 1002,
    "name": "Meeting Two",
    "createdAt": "2024-01-02T14:00:00Z",
    "attendees": [{"name": "Bob", "email": "bob@example.com"}],
    "notes": "Second meeting",
    "transcript": [{"speaker": "Bob", "text": "Hi there", "timestamp": 0}]
  }]'
```

Then verify:
```bash
curl http://localhost:8000/api/meetings/recent?limit=10
```

## Troubleshooting

### Database Connection Issues

If you get connection errors, verify:
1. PostgreSQL is running: `pg_isready`
2. Database exists: `psql -l | grep oxychat`
3. DATABASE_URL in `.env` is correct

### Webhook Errors

Check backend logs for detailed error messages. Common issues:
- Missing required fields (id, name, createdAt)
- Invalid JSON format
- Database connection issues

### Verify Tables Exist

```bash
psql -d oxychat -U andrewsmyth -c "\dt"
```

Should show `meetings` table.

