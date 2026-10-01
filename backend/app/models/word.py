import uuid

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    spanish: Mapped[str] = mapped_column(String(255), nullable=False)
    english: Mapped[str] = mapped_column(String(255), nullable=False)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    cefr_level: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Cached Mistral enrichment (gender, synonyms, antonyms, collocations, chunks,
    # frequency, pronunciation, common mistakes, example sentences). Generated
    # lazily on first vocab interaction; see services.enrich.
    enrichment: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Cached Pexels image for the level-2 picture exercise.
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
