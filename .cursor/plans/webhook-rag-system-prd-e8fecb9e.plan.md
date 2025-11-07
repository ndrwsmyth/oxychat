<!-- e8fecb9e-ae0f-41fa-8300-d0b880f521bf ceb5b5d7-f38f-442c-816c-be99962b7447 -->
# Webhook-to-Storage System Implementation Plan

This plan implements a simplified data pipeline from webhook ingestion through structured storage, enabling meeting transcripts to be available in the chat interface. Embedding/RAG features are deferred for future phases.

## Architecture Overview

1. **Webhook Listener** → Receives JSON payloads (open for local dev, with production auth notes)
2. **Raw Storage (PostgreSQL)** → Stores original JSON in structured columns with JSONB
3. **Serialization Processor** → Extracts business context and adds formatted markdown string to same table
4. **Client Integration** → Pushes last 10 meetings to frontend for @entity tagging
5. **Search Integration** → Basic SQL-based search (vector search deferred)

## Implementation Steps

### Phase 1: Database Setup and Dependencies

**Files to modify:**

- `backend/pyproject.toml` - Add dependencies

**New files:**

- `backend/app/database.py` - PostgreSQL setup and models

**Dependencies to add:**

- `sqlalchemy>=2.0` - ORM for PostgreSQL
- `psycopg2-binary>=2.9` or `asyncpg>=0.29` - PostgreSQL driver
- `pydantic>=2.0` - Data validation (verify version)

**Note:** ChromaDB dependencies removed - not needed for this phase

### Phase 2: Webhook Listener

**File: `backend/app/webhook.py`**

- FastAPI endpoint: `POST /webhook/circleblock` (or configurable path)
- Accepts array of meeting objects
- **SECURITY NOTE:** Currently open/unauthenticated for local dev. For production:
  - Add header-based secret validation (e.g., `X-Webhook-Secret`)
  - Use environment variable `WEBHOOK_SECRET` for validation
  - Reject requests without valid secret
- JSON payload parsing and validation
- Error handling and logging

**Incoming JSON structure:**

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
  "actionItems": [...],
  "transcript": [
    { "speaker": "John Appleseed", "text": "Hey, how's it going?", "timestamp": 4.56 },
    { "speaker": "Samantha Grey", "text": "Going well...", "timestamp": 18.32 }
  ],
  "insights": {...}
}]
```

**File: `backend/app/main.py`**

- Register webhook route
- Health check endpoint update (optional)

### Phase 3: Database Schema (Single Table Approach)

**File: `backend/app/database.py`**

- PostgreSQL database initialization
- Connection management (environment variable: `DATABASE_URL`)
- Single table: `meetings`
  - `id` (primary key, auto-increment)
  - `meeting_id` (integer, from JSON `id` field, unique index)
  - `doc_id` (text, formatted as `doc_{meeting_id}`, unique index)
  - `title` (text, from JSON `name`)
  - `date` (text, formatted from JSON `createdAt`)
  - `attendees` (JSONB, array of attendee objects)
  - `transcript` (JSONB, array of transcript entries)
  - `raw_payload` (JSONB, stores full original JSON for reference)
  - `formatted_content` (text, markdown-formatted string combining title, date, attendees, transcript)
  - `source` (text, e.g., "circleblock")
  - `processed` (boolean flag, default true since we process immediately)
  - `created_at` (timestamp, auto-set)
  - `updated_at` (timestamp, auto-set)
- Indexes: `meeting_id`, `doc_id`, `date` (for sorting), `title` (for search)
- CRUD operations

### Phase 4: Serialization Processor

**File: `backend/app/processor.py`**

- `process_meeting_data(raw_json: dict)` function:
  - Extracts structured fields:
    - `id` → `meeting_id` (from JSON `id`)
    - `name` → `title`
    - `createdAt` → `date` (formatted as YYYY-MM-DD)
    - `attendees` → stored as JSONB array
    - `notes` → text content (may be empty)
    - `transcript` → stored as JSONB array (preserve speaker, text, timestamp)
  - Generates formatted markdown string (`formatted_content`):
    ```
    # {title}
    
    **Date:** {date}
    
    **Attendees:**
 - {attendee.name} ({attendee.email})
    ...
    
    ## Notes
    {notes}
    
    ## Transcript
    [{timestamp}] {speaker}: {text}
    ...
    ```

  - Creates complete meeting record with all fields
  - Returns serialized data ready for database insertion

**File: `backend/app/models.py`**

- `Meeting` Pydantic model:
  - `id` (int, optional, database auto-generated)
  - `meeting_id` (int, original ID from JSON)
  - `doc_id` (str, formatted as `doc_{meeting_id}`)
  - `title` (str)
  - `date` (str, formatted date)
  - `attendees` (list of dicts)
  - `notes` (str, optional)
  - `transcript` (list of dicts)
  - `raw_payload` (dict, full original JSON)
  - `formatted_content` (str, full markdown-formatted string)
  - `source` (str)
  - `processed` (bool)
- Compatible with existing `Transcript` structure (`id`, `title`, `date`, `content`)

### Phase 5: Webhook Processing Flow

**File: `backend/app/webhook.py` (update)**

- After receiving webhook payload:

  1. Validate JSON structure
  2. For each meeting in array:

     - Call `process_meeting_data()` to serialize
     - Insert/update into `meetings` table
     - Handle duplicates (update existing if `meeting_id` exists)

  1. Return success response

**File: `backend/app/database.py` (update)**

- `save_meeting(meeting: Meeting)` - Insert or update meeting
- `get_meeting_by_doc_id(doc_id: str)` - Retrieve by doc_id
- `get_recent_meetings(limit: int)` - Get last N meetings by date

### Phase 6: Client Integration

**File: `backend/app/main.py`**

- New endpoint: `GET /api/meetings/recent?limit=10`
- Returns last 10 processed meetings:
  ```json
  {
    "meetings": [
      {"id": "doc_1234", "title": "Event Venue Review", "date": "2023-07-25"}
    ]
  }
  ```


**File: `frontend/src/lib/config.ts`** (if needed)

- Add API endpoint configuration

**File: `frontend/src/components/ChatKitPanel.tsx`** (check current implementation)

- Fetch recent meetings on component mount
- Pass to ChatKit for @entity menu population
- ezure compatibility with existing `@doc_*` tagging

### Phase 7: Update Transcript Store

**File: `backend/app/transcripts.py`**

- Modify to read from both:
  - File-based transcripts (existing)
  - Database-backed meetings (new)
- Update `get_transcript(doc_id)`:
  - First check database for `doc_id`
  - Fall back to file-based transcripts
- Update `list_recent(limit)`:
  - Combine database meetings + file transcripts
  - Sort by date, return most recent
- Maintain backward compatibility

**File: `backend/app/converters.py`**

- Update `TranscriptAwareConverter` to use database meetings
- When `@doc_*` tag is referenced, retrieve from database if available
- Format `formatted_content` for LLM context

### Phase 8: Basic Search (Deferred: Vector Search)

**File: `backend/app/search.py` (optional, basic SQL search)**

- `search_meetings(query: str, limit: int)` function
- Use PostgreSQL full-text search on `title`, `notes`, `formatted_content`
- Or simple ILIKE queries for MVP
- Return matching meetings

**Note:** Vector/embedding search will be added in future phase when ChromaDB is integrated

## Key Design Decisions

1. **Single PostgreSQL database**: One database, one table (`meetings`) for simplicity
2. **No ChromaDB yet**: Skip embedding/chunking for now, add later as separate phase
3. **Dual-storage in same table**: 

   - Structured columns (meeting_id, title, date, attendees, notes, transcript, raw_payload)
   - `formatted_content` column for easy prompt injection (single markdown string)

4. **Processing strategy**: Synchronous in webhook handler - process immediately on receipt
5. **ID format**: Maintain `doc_*` prefix for compatibility (`doc_{meeting_id}`)
6. **Webhook security**: Open for local dev, comment notes in code for production auth
7. **Search**: Basic SQL search for now, vector search deferred

## Testing Considerations

- Webhook endpoint: Test with sample JSON payloads matching provided structure
- Database: Verify meeting storage (all fields including formatted_content)
- Serialization: Test extraction of id, name, createdAt, attendees, notes, transcript
- Integration: End-to-end flow from webhook → database → client menu
- Transcript retrieval: Verify database meetings work with existing @doc_* tagging

## Environment Variables

Add to `.env` or environment:

- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/oxychat`)
- `WEBHOOK_SECRET` - Secret for webhook authentication (optional for local, see Phase 2 note)
- `OPENAI_API_KEY` - Already exists, not needed for this phase but keep for future

## Future Enhancements (Out of Scope for This Phase)

- ChromaDB integration for vector embeddings
- Advanced chunking strategies
- Vector/semantic search
- Async processing queue (Celery/RQ)
- Authentication improvements (JWT, OAuth)
- Hybrid search (keyword + semantic)