"""add_tool_tracking_tables

Revision ID: 42bb1d341541
Revises: 3565c8925d46
Create Date: 2026-01-06 18:11:44.018676

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42bb1d341541'
down_revision: Union[str, Sequence[str], None] = '3565c8925d46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add tool tracking tables (ToolCall, AgentStep, RetrievalResult)."""
    # Create tool_calls table
    op.create_table(
        'tool_calls',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('message_id', sa.String(length=36), nullable=True),
        sa.Column('turn_id', sa.String(length=36), nullable=False),
        sa.Column('tool_name', sa.String(length=100), nullable=False),
        sa.Column('input', sa.JSON(), nullable=False),
        sa.Column('output', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for tool_calls
    op.create_index('idx_tool_calls_message_id', 'tool_calls', ['message_id'])
    op.create_index('idx_tool_calls_turn_id', 'tool_calls', ['turn_id'])
    op.create_index('idx_tool_calls_tool_name', 'tool_calls', ['tool_name'])

    # Create agent_steps table
    op.create_table(
        'agent_steps',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('turn_id', sa.String(length=36), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('step_type', sa.String(length=50), nullable=False),
        sa.Column('input_context', sa.JSON(), nullable=True),
        sa.Column('output', sa.JSON(), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for agent_steps
    op.create_index('idx_agent_steps_turn_id', 'agent_steps', ['turn_id', 'sequence'])

    # Create retrieval_results table
    op.create_table(
        'retrieval_results',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('turn_id', sa.String(length=36), nullable=False),
        sa.Column('tool_call_id', sa.String(length=36), nullable=True),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('results', sa.JSON(), nullable=False),
        sa.Column('retrieval_method', sa.String(length=50), server_default='chromadb', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for retrieval_results
    op.create_index('idx_retrieval_results_turn_id', 'retrieval_results', ['turn_id'])
    op.create_index('idx_retrieval_results_tool_call_id', 'retrieval_results', ['tool_call_id'])


def downgrade() -> None:
    """Downgrade schema: Remove tool tracking tables."""
    # Drop retrieval_results table
    op.drop_index('idx_retrieval_results_tool_call_id', table_name='retrieval_results')
    op.drop_index('idx_retrieval_results_turn_id', table_name='retrieval_results')
    op.drop_table('retrieval_results')

    # Drop agent_steps table
    op.drop_index('idx_agent_steps_turn_id', table_name='agent_steps')
    op.drop_table('agent_steps')

    # Drop tool_calls table
    op.drop_index('idx_tool_calls_tool_name', table_name='tool_calls')
    op.drop_index('idx_tool_calls_turn_id', table_name='tool_calls')
    op.drop_index('idx_tool_calls_message_id', table_name='tool_calls')
    op.drop_table('tool_calls')
