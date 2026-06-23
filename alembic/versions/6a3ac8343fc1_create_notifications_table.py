"""create_notifications_table

Revision ID: 6a3ac8343fc1
Revises: cf7051e7f1e3
Create Date: 2026-06-23 14:56:51.388753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a3ac8343fc1'
down_revision: Union[str, Sequence[str], None] = 'cf7051e7f1e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("target_currency", sa.String(length=3), nullable=False),
        sa.Column("threshold", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("condition", sa.String(length=10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "base_currency",
            "target_currency",
            "threshold",
            "condition",
            name="uq_user_notification_sub",
        ),
    )
    op.create_index(
        op.f("ix_notification_subscriptions_base_currency"),
        "notification_subscriptions",
        ["base_currency"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_subscriptions_id"), "notification_subscriptions", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_notification_subscriptions_target_currency"),
        "notification_subscriptions",
        ["target_currency"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notification_subscriptions_user_id"),
        "notification_subscriptions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_notification_subscriptions_user_id"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_target_currency"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_id"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_base_currency"), table_name="notification_subscriptions")
    op.drop_table("notification_subscriptions")
