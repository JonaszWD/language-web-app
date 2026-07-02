from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSetting(Base):
    """Tiny key-value store for global app settings (e.g. auto-transcribe)."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
