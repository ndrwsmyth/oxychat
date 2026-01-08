"""add_fulltext_search

Revision ID: bbd8f475d95b
Revises: 42bb1d341541
Create Date: 2026-01-06 18:12:45.103836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bbd8f475d95b'
down_revision: Union[str, Sequence[str], None] = '42bb1d341541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add full-text search indexes to conversations and messages."""
    # Add tsvector columns for full-text search
    op.execute("ALTER TABLE conversations ADD COLUMN title_tsv tsvector")
    op.execute("ALTER TABLE messages ADD COLUMN content_tsv tsvector")

    # Populate tsvector columns from existing data
    op.execute("UPDATE conversations SET title_tsv = to_tsvector('english', title)")
    op.execute("UPDATE messages SET content_tsv = to_tsvector('english', content)")

    # Create GIN indexes for fast full-text search
    op.execute("CREATE INDEX idx_conversations_title_tsv ON conversations USING GIN(title_tsv)")
    op.execute("CREATE INDEX idx_messages_content_tsv ON messages USING GIN(content_tsv)")

    # Create trigger function to auto-update tsvector for conversations
    op.execute("""
        CREATE FUNCTION conversations_title_tsv_trigger() RETURNS trigger AS $$
        BEGIN
            NEW.title_tsv := to_tsvector('english', NEW.title);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    # Create trigger for conversations
    op.execute("""
        CREATE TRIGGER conversations_title_tsv_update
            BEFORE INSERT OR UPDATE ON conversations
            FOR EACH ROW EXECUTE FUNCTION conversations_title_tsv_trigger()
    """)

    # Create trigger function to auto-update tsvector for messages
    op.execute("""
        CREATE FUNCTION messages_content_tsv_trigger() RETURNS trigger AS $$
        BEGIN
            NEW.content_tsv := to_tsvector('english', NEW.content);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    # Create trigger for messages
    op.execute("""
        CREATE TRIGGER messages_content_tsv_update
            BEFORE INSERT OR UPDATE ON messages
            FOR EACH ROW EXECUTE FUNCTION messages_content_tsv_trigger()
    """)


def downgrade() -> None:
    """Downgrade schema: Remove full-text search indexes and triggers."""
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS messages_content_tsv_update ON messages")
    op.execute("DROP TRIGGER IF EXISTS conversations_title_tsv_update ON conversations")

    # Drop trigger functions
    op.execute("DROP FUNCTION IF EXISTS messages_content_tsv_trigger()")
    op.execute("DROP FUNCTION IF EXISTS conversations_title_tsv_trigger()")

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS idx_messages_content_tsv")
    op.execute("DROP INDEX IF EXISTS idx_conversations_title_tsv")

    # Drop columns
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS content_tsv")
    op.execute("ALTER TABLE conversations DROP COLUMN IF EXISTS title_tsv")
