from __future__ import annotations

from alembic import command
from alembic.config import Config

from app.config import BACKEND_DIR
from app.db import engine


def upgrade_db() -> None:
    """Apply Alembic migrations to head using the application's engine."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
