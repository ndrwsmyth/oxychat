"""add_profiles_table

Revision ID: 03fe66298375
Revises: 
Create Date: 2026-01-06 16:42:04.502865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03fe66298375'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create profiles table linked to Supabase auth.users."""
    # Create profiles table
    op.create_table(
        'profiles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('org_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('idx_profiles_email', 'profiles', ['email'])
    op.create_index('idx_profiles_org_id', 'profiles', ['org_id'])

    # NOTE: After running this migration, manually insert the default user profile:
    # INSERT INTO profiles (id, email, name, metadata) VALUES ('<supabase-user-uuid>', 'your-email@example.com', 'Your Name', '{}');
    # Get the UUID from Supabase Dashboard → Authentication → Users after creating your first user


def downgrade() -> None:
    """Downgrade schema: Drop profiles table."""
    op.drop_index('idx_profiles_org_id', table_name='profiles')
    op.drop_index('idx_profiles_email', table_name='profiles')
    op.drop_table('profiles')
