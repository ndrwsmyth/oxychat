"""add_user_to_conversations

Revision ID: dd1d50bc4a78
Revises: 03fe66298375
Create Date: 2026-01-06 16:52:32.277120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd1d50bc4a78'
down_revision: Union[str, Sequence[str], None] = '03fe66298375'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add user_id, org_id, metadata, status to conversations."""
    # Add new columns (nullable first)
    op.add_column('conversations', sa.Column('user_id', sa.String(length=36), nullable=True))
    op.add_column('conversations', sa.Column('org_id', sa.String(length=36), nullable=True))
    op.add_column('conversations', sa.Column('metadata', sa.JSON(), nullable=True))
    op.add_column('conversations', sa.Column('status', sa.String(length=20), server_default='active', nullable=True))

    # NOTE: Before making user_id NOT NULL, assign existing conversations to the default user:
    # UPDATE conversations SET user_id = '<supabase-user-uuid>' WHERE user_id IS NULL;
    # Then uncomment the next line and run another migration to enforce NOT NULL:
    # op.alter_column('conversations', 'user_id', nullable=False)

    # Create indexes for user-scoped queries
    op.create_index('idx_conversations_user_id', 'conversations', ['user_id'])
    op.create_index('idx_conversations_user_updated', 'conversations', ['user_id', 'updated_at'])
    op.create_index('idx_conversations_status', 'conversations', ['status'])


def downgrade() -> None:
    """Downgrade schema: Remove user_id, org_id, metadata, status from conversations."""
    op.drop_index('idx_conversations_status', table_name='conversations')
    op.drop_index('idx_conversations_user_updated', table_name='conversations')
    op.drop_index('idx_conversations_user_id', table_name='conversations')

    op.drop_column('conversations', 'status')
    op.drop_column('conversations', 'metadata')
    op.drop_column('conversations', 'org_id')
    op.drop_column('conversations', 'user_id')
