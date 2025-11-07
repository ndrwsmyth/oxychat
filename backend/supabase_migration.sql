-- Migration script for Supabase
-- Creates the meetings table with all indexes and constraints
-- This can be run manually in Supabase SQL Editor, or tables will be auto-created via init_db()

CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL,
    doc_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    date VARCHAR(50) NOT NULL,
    attendees JSONB NOT NULL,
    transcript JSONB NOT NULL,
    raw_payload JSONB NOT NULL,
    formatted_content TEXT NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'circleback',
    processed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_id ON meetings(meeting_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_id ON meetings(doc_id);

-- Create indexes for querying
CREATE INDEX IF NOT EXISTS idx_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_title ON meetings(title);
CREATE INDEX IF NOT EXISTS idx_meeting_id ON meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_doc_id ON meetings(doc_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

