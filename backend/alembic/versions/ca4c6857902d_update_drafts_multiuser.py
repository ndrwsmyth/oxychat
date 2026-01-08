"""update_drafts_multiuser

Revision ID: ca4c6857902d
Revises: bbd8f475d95b
Create Date: 2026-01-06 18:13:29.230776

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca4c6857902d'
down_revision: Union[str, Sequence[str], None] = 'bbd8f475d95b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add user_id to conversation_drafts and update primary key."""
    # Add user_id column (nullable first for backfill)
    op.add_column('conversation_drafts', sa.Column('user_id', sa.String(length=36), nullable=True))

    # NOTE: Before changing the primary key, assign existing drafts to the default user:
    # UPDATE conversation_drafts SET user_id = '<supabase-user-uuid>' WHERE user_id IS NULL;

    # After backfilling, you can make user_id NOT NULL and update the primary key:
    # 1. op.alter_column('conversation_drafts', 'user_id', nullable=False)
    # 2. op.drop_constraint('conversation_drafts_pkey', 'conversation_drafts', type_='primary')
    # 3. op.create_primary_key('conversation_drafts_pkey', 'conversation_drafts', ['conversation_id', 'user_id'])

    # Create index for user_id
    op.create_index('idx_conversation_drafts_user_id', 'conversation_drafts', ['user_id'])


def downgrade() -> None:
    """Downgrade schema: Remove user_id from conversation_drafts and restore single-column primary key."""
    # Drop index
    op.drop_index('idx_conversation_drafts_user_id', table_name='conversation_drafts')

    # If primary key was changed, restore it:
    # op.drop_constraint('conversation_drafts_pkey', 'conversation_drafts', type_='primary')
    # op.create_primary_key('conversation_drafts_pkey', 'conversation_drafts', ['conversation_id'])

    # Drop user_id column
    op.drop_column('conversation_drafts', 'user_id')
