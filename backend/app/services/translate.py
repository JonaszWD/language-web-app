"""Spanish→English word/phrase translation via the DeepL API.

Uses the DeepL REST API directly (httpx) so no extra dependency is needed. The
free and pro tiers share the same protocol but live on different hosts; free
auth keys carry a ":fx" suffix, which we use to pick the right endpoint.
"""
import httpx

from app.config import settings

_FREE_URL = "https://api-free.deepl.com/v2/translate"
_PRO_URL = "https://api.deepl.com/v2/translate"


class TranslationError(Exception):
    """Raised when a translation can't be produced (missing key, API error)."""


def translate_es_en(text: str, context: str | None = None) -> str:
    """Translate Spanish ``text`` to English. Raises TranslationError on failure.

    ``context`` is DeepL's dedicated context parameter: extra surrounding text
    (e.g. the full sentence a tapped word came from) that DeepL reads to
    disambiguate the translation, but never translates or includes in the
    output itself — only ``text`` comes back translated.
    """
    key = settings.deepl_api_key
    if not key:
        raise TranslationError(
            "DeepL is not configured. Set DEEPL_API_KEY in the backend environment."
        )

    url = _FREE_URL if key.endswith(":fx") else _PRO_URL
    data = {"text": text, "source_lang": "ES", "target_lang": "EN-US"}
    if context:
        data["context"] = context
    try:
        resp = httpx.post(
            url,
            headers={"Authorization": f"DeepL-Auth-Key {key}"},
            data=data,
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise TranslationError(
            f"DeepL returned {exc.response.status_code}. Check the API key and quota."
        ) from exc
    except httpx.HTTPError as exc:
        raise TranslationError(f"Could not reach DeepL: {exc}") from exc

    translations = resp.json().get("translations") or []
    if not translations or not translations[0].get("text"):
        raise TranslationError("DeepL returned an empty translation.")
    return translations[0]["text"].strip()
