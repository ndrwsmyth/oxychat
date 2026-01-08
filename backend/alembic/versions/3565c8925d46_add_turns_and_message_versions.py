"""add_turns_and_message_versions

Revision ID: 3565c8925d46
Revises: dd1d50bc4a78
Create Date: 2026-01-06 16:53:34.377233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3565c8925d46'
down_revision: Union[str, Sequence[str], None] = 'dd1d50bc4a78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add turns table and message versioning fields."""
    # Create turns table
    op.create_table(
        'turns',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('conversation_id', sa.String(length=36), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('conversation_id', 'sequence', name='uq_conversation_sequence')
    )

    # Create indexes for turns
    op.create_index('idx_turns_conversation_id', 'turns', ['conversation_id'])
    op.create_index('idx_turns_conversation_sequence', 'turns', ['conversation_id', 'sequence'])

    # Add new columns to messages (nullable first for backfill)
    op.add_column('messages', sa.Column('turn_id', sa.String(length=36), nullable=True))
    op.add_column('messages', sa.Column('parent_message_id', sa.String(length=36), nullable=True))
    op.add_column('messages', sa.Column('version', sa.Integer(), server_default='1', nullable=True))

    # Backfill turns from existing messages
    # This groups consecutive user->assistant message pairs as turns
    op.execute("""
        INSERT INTO turns (id, conversation_id, sequence, created_at)
        SELECT
            gen_random_uuid()::text as id,
            conversation_id,
            (ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at) - 1) / 2 as sequence,
            MIN(created_at) as created_at
        FROM messages
        GROUP BY conversation_id, (ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at) - 1) / 2
    """)

    # Link messages to their turns
    # Each pair of messages (user, then assistant) belongs to the same turn
    op.execute("""
        UPDATE messages m
        SET turn_id = t.id
        FROM (
            SELECT
                m2.id as message_id,
                (
                    SELECT t.id
                    FROM turns t
                    WHERE t.conversation_id = m2.conversation_id
                    AND t.sequence = (ROW_NUMBER() OVER (PARTITION BY m2.conversation_id ORDER BY m2.created_at) - 1) / 2
                    LIMIT 1
                ) as turn_id
            FROM messages m2
        ) AS turn_mapping
        WHERE m.id = turn_mapping.message_id
    """)

    # Now that backfill is done, make turn_id NOT NULL
    op.alter_column('messages', 'turn_id', nullable=False)

    # Create indexes for messages
    op.create_index('idx_messages_turn_id', 'messages', ['turn_id'])
    op.create_index('idx_messages_parent_message_id', 'messages', ['parent_message_id'])


def downgrade() -> None:
    """Downgrade schema: Remove turns table and message versioning fields."""
    op.drop_index('idx_messages_parent_message_id', table_name='messages')
    op.drop_index('idx_messages_turn_id', table_name='messages')

    op.drop_column('messages', 'version')
    op.drop_column('messages', 'parent_message_id')
    op.drop_column('messages', 'turn_id')

    op.drop_index('idx_turns_conversation_sequence', table_name='turns')
    op.drop_index('idx_turns_conversation_id', table_name='turns')
    op.drop_table('turns')
