"""Pexels image search for the level-2 picture exercise.

One cached lookup per word. Returns a medium-size photo URL or None when the
key is missing or no result is found (the level-2 UI falls back to text-only).
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("images")

_URL = "https://api.pexels.com/v1/search"


def find_image(query: str) -> str | None:
    """Return a Pexels image URL for ``query`` (English term), or None."""
    key = settings.pexels_api_key
    if not key:
        return None
    try:
        resp = httpx.get(
            _URL,
            headers={"Authorization": key},
            params={"query": query, "per_page": 1, "orientation": "landscape"},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Pexels lookup failed for %r: %s", query, exc)
        return None

    photos = resp.json().get("photos") or []
    if not photos:
        return None
    return photos[0].get("src", {}).get("medium")
