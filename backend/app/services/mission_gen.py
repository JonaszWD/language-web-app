"""Offline mission generator.

Given a scenario + CEFR level, generate a complete, playable mission — vocab,
grammar patterns, the grammar/listening/writing lesson decks, the Final Challenge
scene, and the frontend overlay (icon/coords/levels) — using the SAME LLM stack
as enrichment (Mistral → Claude fallback, strict JSON schemas).

The defining constraint: every exercise reuses **this mission's new vocab plus
the vocab already taught in earlier missions**, and never invents new content
words the learner hasn't been taught. The known set is gathered from the existing
`content/missions/*.json` files and handed to the model; `lint_vocab()` then
verifies the generated content actually respects it (offline, no LLM).

This module is import-safe with no API keys — only `generate_mission()` calls out.
Run it via `backend/scripts/generate_mission.py`.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "missions"
LISTENING_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "listening"


def _llm(prompt: str, schema: dict) -> dict:
    """One structured LLM call (Mistral → Claude) sized for whole lesson decks.

    Reuses enrich's provider config but with a longer Mistral timeout and a much
    larger Claude max_tokens than enrich's per-word default — a full deck of
    all-fields cards is big and truncates at 3500 tokens. Imported lazily so the
    offline linter (--check) runs with no API keys or provider SDKs installed.
    """
    import json as _json

    import anthropic
    import httpx

    from app.config import settings
    from app.services import enrich

    # Mistral first (generous timeout for the sandbox's slow egress).
    if settings.mistral_api_key:
        try:
            payload = {
                "model": enrich._MISTRAL_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "mission_deck", "schema": enrich._strict(schema), "strict": True},
                },
            }
            resp = httpx.post(
                enrich._MISTRAL_URL,
                headers={"Authorization": f"Bearer {settings.mistral_api_key}"},
                json=payload, timeout=120.0,
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            return _json.loads(text)
        except Exception:  # noqa: BLE001 — fall through to Claude
            pass

    # Claude fallback with a deck-sized token budget.
    if settings.claude_api_key:
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        msg = client.messages.create(
            model=enrich._CLAUDE_MODEL,
            max_tokens=16000,
            messages=[{"role": "user", "content": prompt}],
            output_config={"format": {"type": "json_schema", "schema": enrich._strict(schema)}},
        )
        text = next(b.text for b in msg.content if b.type == "text")
        return _json.loads(text)

    raise enrich.EnrichmentError("No LLM provider configured (set MISTRAL_API_KEY or CLAUDE_API_KEY).")

# Function words, connectors and courtesy fillers that are always allowed in
# exercises even though they aren't "taught vocab" — the glue A1 learners have
# from day one. Kept deliberately small; content words must come from the deck.
ALLOWED_GLUE = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "al", "del",
    "de", "a", "en", "con", "sin", "por", "para", "y", "o", "que", "se", "su",
    "mi", "tu", "me", "te", "le", "les", "nos", "no", "sí", "es", "está", "son",
    "están", "soy", "eres", "muy", "más", "menos", "aquí", "allí", "esto", "eso",
    "este", "esta", "ese", "esa", "uno", "dos", "tres", "cuatro", "cinco",
    "seis", "siete", "ocho", "nueve", "diez", "once", "doce",
    "por favor", "gracias", "hola", "buenos", "días", "buenas", "tardes",
    "señor", "señora", "usted", "yo", "tú", "él", "ella", "cómo", "qué",
    "dónde", "cuánto", "cuándo", "hay", "tiene", "tengo", "quiero", "quisiera",
    "algo", "nada", "todo", "bien", "mal", "ahora", "hoy", "luego", "también",
    "un poco", "puede", "puedo", "puedes", "le", "me duele",
    # Core verb forms (ser/estar/tener/necesitar) and connectors a B1 learner
    # already controls — glue, not scenario vocab to teach.
    "estoy", "estás", "está", "tiene", "tienes", "tengo", "necesita", "necesito",
    "necesitas", "si", "día", "días", "semana", "cuánto", "cuánta", "tiempo",
    "vez", "veces", "por qué", "porque", "doctor", "quieres", "quiere",
    "debo", "debe", "debes", "deber", "síntomas", "síntoma", "medicina",
}


def _norm(text: str) -> str:
    """Lowercase, strip accents and punctuation — the comparison key for words."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[¿?¡!.,;:'\"()…]", "", text).strip()


def _words(spanish: str) -> list[str]:
    """Content words in a Spanish string, normalised."""
    return [w for w in _norm(spanish).split() if w]


# Common Spanish inflection endings, longest first. Stripping to a stem lets a
# taught lemma cover its conjugations/plurals (tomar↔tome, oído↔oídos) so the
# linter flags genuinely new words, not every grammatical form of a known one.
_SUFFIXES = (
    "ando", "iendo", "amos", "emos", "imos", "aban", "aria", "ado", "ido",
    "ais", "eis", "an", "en", "as", "es", "ar", "er", "ir", "os", "a", "e",
    "o", "s",
)


# Clitic object pronouns that attach to infinitives/imperatives (recetarme,
# recetarte, tómelo). Stripped before stemming so recetar↔recetarte match.
_CLITICS = ("nos", "melo", "telo", "selo", "me", "te", "se", "les", "le", "los",
            "las", "lo", "la")


def _stem(word: str) -> str:
    """Crude morphological stem of an already-normalised word (≥3-char root)."""
    for cl in _CLITICS:
        if word.endswith(cl) and len(word) - len(cl) >= 4:
            word = word[: -len(cl)]
            break
    for suf in _SUFFIXES:
        if word.endswith(suf) and len(word) - len(suf) >= 3:
            return word[: -len(suf)]
    return word


def load_known_vocab(exclude_id: str | None = None) -> dict[str, list[str]]:
    """Union of vocab already taught by existing missions, as {normalised: [es]}.

    A mission being (re)generated is excluded so its own prior words don't count
    as 'known' against a fresh generation.
    """
    known: dict[str, list[str]] = {}
    for path in sorted(CONTENT_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if exclude_id and data.get("id") == exclude_id:
            continue
        for item in data.get("vocab", []):
            es = item.get("spanish", "")
            for w in _words(es):
                known.setdefault(w, []).append(es)
    return known


def next_order_index() -> int:
    """One past the highest existing mission order_index."""
    highest = 0
    for path in CONTENT_DIR.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        highest = max(highest, int(data.get("order_index", 0)))
    return highest + 1


def allowed_word_set(new_vocab: list[dict], known: dict[str, list[str]]) -> set[str]:
    """The full set of normalised words an exercise may use: taught + new + glue.

    Everything is normalised the same way (accents/case stripped, multi-word
    entries split) so comparison against exercise tokens is apples-to-apples.
    """
    allowed = set(known)  # known keys are already normalised
    for g in ALLOWED_GLUE:
        allowed.update(_words(g))  # split + normalise ("por favor" → por, favor)
    for item in new_vocab:
        allowed.update(_words(item.get("spanish", "")))
    return allowed


# Spanish strings inside a generated mission that must respect the vocab budget.
# (Fields the learner reads/produces; NPC/system English is ignored.)
def _collect_spanish(node: object, out: list[str]) -> None:
    """Walk a generated structure and collect every Spanish string worth checking.
    Heuristic: values under Spanish-bearing keys, plus list items of those."""
    ES_KEYS = {"es", "spanish", "answer", "target", "template", "example_es", "npc",
               "audio", "model", "opening"}
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ES_KEYS and isinstance(v, str):
                out.append(v)
            elif k in ("lines", "examples") and isinstance(v, list):
                for it in v:
                    if isinstance(it, dict) and isinstance(it.get("es"), str):
                        out.append(it["es"])
            else:
                _collect_spanish(v, out)
    elif isinstance(node, list):
        for it in node:
            _collect_spanish(it, out)


def lint_vocab(mission: dict, known: dict[str, list[str]]) -> list[str]:
    """Offline check: flag exercise words outside the allowed (taught+new+glue)
    budget. Returns human-readable violation strings; empty means clean.

    Cloze answers that are proper nouns / numbers are tolerated. This is the
    guardrail that proves the generator respected 'reuse, don't invent'.
    """
    allowed = allowed_word_set(mission.get("vocab", []), known)
    allowed_stems = {_stem(a) for a in allowed}
    strings: list[str] = []
    _collect_spanish(mission, strings)

    violations: list[str] = []
    seen: set[str] = set()
    for s in strings:
        if "http" in s or "://" in s:
            continue  # audio placeholder / URL — not learner-facing Spanish
        raw_tokens = s.split()
        for pos, raw in enumerate(raw_tokens):
            w = _norm(raw)
            if not w or w in allowed or w.isdigit() or w in seen:
                continue
            if not w.strip("_"):  # cloze blank ______
                continue
            if _stem(w) in allowed_stems:  # inflection of a taught word
                continue
            # A capitalised token that isn't the first word is a proper noun
            # (a name / place / brand), not vocab to teach — skip it.
            if pos > 0 and raw[:1].isupper():
                continue
            seen.add(w)
            violations.append(f"'{w}'  (in: {s!r})")
    return violations


# ───────────────────────── LLM generation ─────────────────────────
# One superset "card" schema serves all three lesson decks. The model fills only
# the fields a given kind needs and leaves the rest at their defaults ("" / [] /
# 0); normalisers below strip each card down to its clean per-kind TS shape. This
# is the same all-fields trick the speaking-script schema uses (enrich.py).

_CHOICE = {
    "type": "object",
    "properties": {
        "question": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},
        "answer": {"type": "integer"},
    },
    "required": ["question", "options", "answer"],
}
_LINE = {
    "type": "object",
    "properties": {
        "who": {"type": "string"},
        "es": {"type": "string"},
        "en": {"type": "string"},
        "you": {"type": "boolean"},
        "swap": {"type": "boolean"},
    },
    "required": ["who", "es", "en", "you", "swap"],
}
_CARD = {
    "type": "object",
    "properties": {
        "kind": {"type": "string"},
        "stage": {"type": "integer"},
        # intro
        "mission": {"type": "string"},
        "goals": {"type": "array", "items": {"type": "string"}},
        # learn
        "pattern": {"type": "string"},
        "gloss": {"type": "string"},
        "notice": {"type": "string"},
        "examples": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"es": {"type": "string"}, "en": {"type": "string"}},
                "required": ["es", "en"],
            },
        },
        # recognition / respond / predict / wordSpot / listening MCQs
        "question": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},
        "answer_index": {"type": "integer"},
        "instruction": {"type": "string"},
        # production
        "prompts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"cue": {"type": "string"}, "answer": {"type": "string"}},
                "required": ["cue", "answer"],
            },
        },
        # build (tokens) / review (text)
        "cue": {"type": "string"},
        "answer_tokens": {"type": "array", "items": {"type": "string"}},
        "template": {"type": "string"},
        "answer_text": {"type": "string"},
        "label": {"type": "string"},
        # respond / listening dialogue
        "npc": {"type": "string"},
        "npc_en": {"type": "string"},
        # mission (dialogue finale)
        "intro": {"type": "string"},
        "lines": {"type": "array", "items": _LINE},
        # listening
        "audio": {"type": "string"},
        "speed": {"type": "number"},
        "transcriptEn": {"type": "string"},
        "setup": {"type": "string"},
        "words": {"type": "array", "items": {"type": "string"}},
        "questions": {"type": "array", "items": _CHOICE},
    },
    # Anthropic's strict json_schema requires every property to be listed in
    # `required` (same as enrich._SPEAKING_STAGE). The model fills unused fields
    # with defaults ("" / [] / 0 / false); the normalisers drop them per kind.
    "required": [
        "kind", "stage", "mission", "goals", "pattern", "gloss", "notice",
        "examples", "question", "options", "answer_index", "instruction",
        "prompts", "cue", "answer_tokens", "template", "answer_text", "label",
        "npc", "npc_en", "intro", "lines", "audio", "speed", "transcriptEn",
        "setup", "words", "questions",
    ],
}
_DECK_SCHEMA = {
    "type": "object",
    "properties": {"cards": {"type": "array", "items": _CARD}},
    "required": ["cards"],
}


def _vocab_block(new_vocab: list[dict], known: dict[str, list[str]]) -> str:
    new = "\n".join(f"- {v['spanish']} = {v['english']}" for v in new_vocab)
    prior = ", ".join(sorted({vs[0] for vs in known.values()}))
    return (
        f"NEW words this mission teaches:\n{new}\n\n"
        f"ALREADY-KNOWN words (from earlier missions) you may freely reuse:\n{prior or '(none yet)'}\n\n"
        "HARD RULE: every Spanish sentence you write must be built ONLY from the "
        "NEW words, the ALREADY-KNOWN words, and basic connectors (el/la/un/de/con/"
        "y/por favor/si/aquí/…) plus core ser/estar/tener forms. Do NOT introduce "
        "any other CONTENT word (no new nouns, verbs or adjectives) the learner has "
        "not been taught — reach for a known word instead of a fancier one. If you "
        "need a verb like 'to drink' or 'to say' that isn't listed, rephrase to "
        "avoid it. Keep everything natural and at the stated level."
    )


_META_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "blurb": {"type": "string"},          # one-line globe card
        "icon": {"type": "string"},           # one of the allowed icon names
        "lat": {"type": "number"},
        "lon": {"type": "number"},
        "vocab": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "spanish": {"type": "string"},
                    "english": {"type": "string"},
                    "part_of_speech": {"type": "string"},
                    "example_sentence": {"type": "string"},
                },
                "required": ["spanish", "english", "part_of_speech", "example_sentence"],
            },
        },
        "grammar": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "gloss": {"type": "string"},
                    "example_es": {"type": "string"},
                    "cloze_template": {"type": "string"},
                    "cloze_answer": {"type": "string"},
                },
                "required": ["pattern", "gloss", "example_es", "cloze_template", "cloze_answer"],
            },
        },
        "scene": {
            "type": "object",
            "properties": {
                "role": {"type": "string"},
                "role_en": {"type": "string"},
                "setting": {"type": "string"},
                "opening": {"type": "string"},
                "opening_en": {"type": "string"},
                "goal": {"type": "string"},
            },
            "required": ["role", "role_en", "setting", "opening", "opening_en", "goal"],
        },
    },
    "required": ["title", "description", "blurb", "icon", "lat", "lon", "vocab", "grammar", "scene"],
}

# Icons the frontend <Icon> component knows — the model must pick from these.
_ICONS = ["coffee", "plane", "people", "target", "globe", "headphones", "doc", "spark", "bolt"]


def _generate_meta(scenario: str, level: str, known: dict[str, list[str]], n_new: int) -> dict:
    prior = ", ".join(sorted({vs[0] for vs in known.values()})) or "(none yet)"
    prompt = (
        f"Design a Spanish learning mission. Scenario: \"{scenario}\". CEFR level: {level}.\n"
        f"Teach about {n_new} NEW high-frequency words/phrases for this scenario. Choose "
        "words that COMBINE with the already-known words below to let the learner handle "
        "the scene — reuse the known words, don't relearn them.\n\n"
        f"Already-known words: {prior}\n\n"
        f"icon must be one of: {', '.join(_ICONS)} (closest fit). lat/lon = a real city "
        "where this is spoken. grammar = the 3 core structures (with a cloze each). scene = "
        "the Final Challenge: the NPC role, setting and their opening line + the learner's goal.\n"
        "Every example_sentence and Spanish string must use only the new + known words + connectors."
    )
    return _llm(prompt, _META_SCHEMA)


def _deck_prompt(kind: str, scenario: str, level: str, vocab_block: str, spec: str) -> str:
    return (
        f"Generate the {kind} lesson deck for a Spanish mission. Scenario: \"{scenario}\". "
        f"Level: {level}.\n\n{vocab_block}\n\n{spec}\n\n"
        "Return {cards:[...]}. Each card sets `kind` and ONLY the fields that kind needs; "
        "leave all other fields at defaults (\"\", [], 0, false)."
    )


_GRAMMAR_SPEC = (
    "Use these kinds in order, one structure at a time (3 structures A/B/C):\n"
    "intro{mission,goals[3]} · then per structure: learn{pattern,gloss,examples[2 {es,en}],"
    "notice} → recognition{question,options[3],answer_index} → build{instruction,cue,"
    "answer_tokens[the sentence split into words]} → production{instruction,prompts[2 {cue,"
    "answer}] (cues are COMMUNICATIVE, e.g. 'Ask the doctor where it hurts')}. Re-surface "
    "earlier structures with respond{label,npc,npc_en,options[3],answer_index} and "
    "review{label,template (with ______),cue,answer_text}. End with mission{intro,lines[6, "
    "alternating NPC and you]}: set you=true + en=English paraphrase on the learner's lines; "
    "mark the two interchangeable NPC+you pairs swap=true. ~13-15 cards."
)
_WRITING_SPEC = (
    "Kinds by stage: intro{mission,goals[3]} · copy(stage1){prompt,answer_text (model "
    "sentence),notice} · build(stage2){prompt→cue,answer_tokens,answer_text} · "
    "prompt(stage3){cue,answer_text,notice} · production(stage4){instruction,prompts[2]} · "
    "message(stage6){cue,answer_text} · free(stage7){instruction (full scenario)}. "
    "Everything built from known+new vocab. ~7-8 cards. "
    "Never use English placeholders like '[Your Name]' or '[insert X]' in Spanish text — "
    "use a real Spanish name (e.g. Carlos, Ana) instead."
)
_LISTENING_SPEC = (
    "IMPORTANT: `audio` is the literal SPANISH SENTENCE that gets spoken aloud "
    "(plain text, e.g. 'Me duele la cabeza.') — NEVER a URL, filename or English.\n"
    "Kinds by stage (audio = the Spanish spoken; speed 0.6-1.0; transcriptEn = 'es — en'):\n"
    "intro{mission,goals[3]} · predict(stage1){setup,question,options[3],answer_index,audio,"
    "speed,transcriptEn} · recognition(stage1-2){audio,speed,question,options[3],answer_index,"
    "transcriptEn} · wordSpot(stage2){audio,speed,question→cue,words[3-4],answer_index,"
    "transcriptEn} · conversation(stage5){lines[4 {who,es,en}],questions[2 {question,options,"
    "answer}]} · shadow(stage6){lines[3-4 {who,es,en}]} · challenge(stage7){lines[2],cue→"
    "question,answer_text,transcriptEn}. ~9-10 cards."
)


def generate_mission(
    scenario: str, level: str, mission_id: str, topics: list[str] | None = None
) -> dict:
    """Generate a full mission. Returns a dict with `backend` (mission JSON for
    content/missions/) and `frontend` (overlay + lesson decks for the client).

    `topics` tags the mission with its topic vocabulary (e.g. ["travel"]) —
    the small fixed set that maps 1:1 to onboarding motivation options (see
    services.missions.MOTIVATION_TOPIC_MAP) — for the "recommended for you"
    signal on GET /missions. Purely editorial: the author picks it, it isn't
    inferred from the scenario text.
    """
    known = load_known_vocab(exclude_id=mission_id)
    order_index = next_order_index()

    meta = _generate_meta(scenario, level, known, n_new=12)
    vblock = _vocab_block(meta["vocab"], known)

    grammar_deck = _llm(
        _deck_prompt("grammar", scenario, level, vblock, _GRAMMAR_SPEC), _DECK_SCHEMA
    )
    writing_deck = _llm(
        _deck_prompt("writing", scenario, level, vblock, _WRITING_SPEC), _DECK_SCHEMA
    )
    listening_deck = _llm(
        _deck_prompt("listening", scenario, level, vblock, _LISTENING_SPEC), _DECK_SCHEMA
    )

    tag = f"{level} · {scenario.split()[-1].title()}"
    backend = {
        "id": mission_id,
        "order_index": order_index,
        "title": meta["title"],
        "description": meta["description"],
        "level": level,
        "topics": topics or [],
        "vocab": meta["vocab"],
        "grammar": meta["grammar"],
        "speaking_scene": meta["scene"],
    }
    frontend = {
        "overlay": {
            "id": mission_id,
            "icon": meta["icon"] if meta["icon"] in _ICONS else "globe",
            "title": meta["title"],
            "blurb": meta["blurb"],
            "tag": tag,
            "lat": meta["lat"],
            "lon": meta["lon"],
            "levels": _LEVELS(scenario),
        },
        "grammar": {"title": meta["title"], "cards": _norm_cards(grammar_deck["cards"], "grammar")},
        "listening": {"title": meta["title"], "cards": _norm_cards(listening_deck["cards"], "listening")},
        "writing": {"title": meta["title"], "cards": _norm_cards(writing_deck["cards"], "writing")},
    }
    return {"backend": backend, "frontend": frontend, "known_count": len(known)}


def _decks(scenario: str, level: str, vblock: str) -> dict:
    """Generate the three lesson decks (constrained to the vocab in `vblock`)."""
    grammar = _llm(_deck_prompt("grammar", scenario, level, vblock, _GRAMMAR_SPEC), _DECK_SCHEMA)
    writing = _llm(_deck_prompt("writing", scenario, level, vblock, _WRITING_SPEC), _DECK_SCHEMA)
    listening = _llm(_deck_prompt("listening", scenario, level, vblock, _LISTENING_SPEC), _DECK_SCHEMA)
    return {
        "grammar": {"cards": _norm_cards(grammar["cards"], "grammar")},
        "listening": {"cards": _norm_cards(listening["cards"], "listening")},
        "writing": {"cards": _norm_cards(writing["cards"], "writing")},
    }


def generate_lessons(mission_id: str, level: str, scenario: str | None = None) -> dict:
    """Generate ONLY the three lesson decks for an already-authored mission,
    reusing its committed vocab/grammar/scene. Leaves the backend JSON untouched;
    returns just the frontend lesson entry (grammar/listening/writing decks).

    Use when a mission's content is hand-curated but its lessons should be
    machine-generated under the known+new vocab constraint.
    """
    path = CONTENT_DIR / f"{mission_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"No mission JSON at {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    known = load_known_vocab(exclude_id=mission_id)
    scenario = scenario or data.get("title", mission_id)

    vblock = _vocab_block(data.get("vocab", []), known)
    decks = _decks(scenario, level, vblock)
    title = data.get("title", mission_id)
    for deck in decks.values():
        deck["title"] = title
    return {"frontend": decks, "vocab": data.get("vocab", []), "known": known}


def _LEVELS(scenario: str) -> list[dict]:
    """The fixed 6-step planet ladder every mission shows."""
    return [
        {"name": "Listening", "learn": f"Hear the {scenario} phrases in context before drilling them.", "minutes": 4},
        {"name": "Grammar", "learn": "The core structures — noticed one at a time, then practised.", "minutes": 5},
        {"name": "Vocabulary", "learn": "Image recognition, active recall and pronunciation of every new word.", "minutes": 6},
        {"name": "Speaking", "learn": "Talk to an AI partner and complete the interaction naturally.", "minutes": 6},
        {"name": "Writing", "learn": "Write the phrases, then use them in a short message.", "minutes": 5},
        {"name": "Final Challenge", "learn": "The real conversation — no hints, native speed, multiple responses.", "minutes": 7},
    ]


# Map the all-fields generated cards to the clean per-kind TS shapes the frontend
# card components expect (answer_index → answer, answer_tokens → answer, …).
# `deck` disambiguates the `build` kind: the grammar trainer's build wants
# {cue, answer:string[]}, the writing trainer's wants {stage, bank, answer:string}.
def _norm_cards(cards: list[dict], deck: str = "grammar") -> list[dict]:
    out: list[dict] = []
    for c in cards:
        k = c.get("kind")
        if k == "intro":
            out.append({"kind": "intro", "mission": c.get("mission", ""), "goals": c.get("goals", [])})
        elif k == "learn":
            card = {"kind": "learn", "pattern": c.get("pattern", ""), "gloss": c.get("gloss", ""),
                    "examples": c.get("examples", [])}
            if c.get("notice"):
                card["notice"] = c["notice"]
            out.append(card)
        elif k == "recognition":
            card = {"kind": "recognition", "question": c.get("question", ""),
                    "options": c.get("options", []), "answer": c.get("answer_index", 0)}
            if c.get("stage"):
                card["stage"] = c["stage"]
            if c.get("audio"):
                card.update(audio=c["audio"], speed=c.get("speed", 0.8))
            if c.get("transcriptEn"):
                card["transcriptEn"] = c["transcriptEn"]
            out.append(card)
        elif k == "production":
            card = {"kind": "production", "prompts": c.get("prompts", [])}
            if c.get("instruction"):
                card["instruction"] = c["instruction"]
            if c.get("stage"):
                card["stage"] = c["stage"]
            out.append(card)
        elif k == "build":
            tokens = c.get("answer_tokens") or c.get("bank") or []
            if deck == "writing":  # writing build: bank + assembled string answer
                out.append({"kind": "build", "stage": c.get("stage", 2),
                            "prompt": c.get("prompt") or c.get("cue", ""), "bank": tokens,
                            "answer": c.get("answer_text") or " ".join(tokens)})
            else:  # grammar build: cue + ordered token array
                card = {"kind": "build", "cue": c.get("cue") or c.get("prompt", ""), "answer": tokens}
                if c.get("instruction"):
                    card["instruction"] = c["instruction"]
                out.append(card)
        elif k == "respond":
            out.append({"kind": "respond", "label": c.get("label", "Reply"), "npc": c.get("npc", ""),
                        "npc_en": c.get("npc_en", ""), "options": c.get("options", []),
                        "answer": c.get("answer_index", 0)})
        elif k == "review":
            out.append({"kind": "review", "label": c.get("label", "Quick review"),
                        "template": c.get("template", ""), "cue": c.get("cue", ""),
                        "answer": c.get("answer_text", "")})
        elif k == "mission":
            out.append({"kind": "mission", "intro": c.get("intro", ""), "lines": [
                {kk: vv for kk, vv in ln.items() if kk in ("who", "es", "en", "you", "swap") and vv not in ("", False)}
                | {"who": ln.get("who", ""), "es": ln.get("es", "")}
                for ln in c.get("lines", [])
            ]})
        # ── writing-only kinds ──
        elif k == "copy":
            card = {"kind": "copy", "stage": 1, "prompt": c.get("question") or c.get("cue", ""),
                    "model": c.get("answer_text", "")}
            if c.get("notice"):
                card["note"] = c["notice"]
            out.append(card)
        elif k == "prompt":
            card = {"kind": "prompt", "stage": 3, "prompt": c.get("cue", ""), "answer": c.get("answer_text", "")}
            if c.get("notice"):
                card["hint"] = c["notice"]
            out.append(card)
        elif k == "message":
            out.append({"kind": "message", "stage": 6, "prompt": c.get("cue", ""),
                        "target": c.get("answer_text", ""), "examples": c.get("options", [])})
        elif k == "free":
            out.append({"kind": "free", "stage": 7, "scenario": c.get("instruction", "")})
        # ── listening-only kinds ──
        elif k == "predict":
            out.append({"kind": "predict", "stage": c.get("stage", 1), "audio": c.get("audio", ""),
                        "speed": c.get("speed", 0.7), "setup": c.get("setup", ""),
                        "question": c.get("question", ""), "options": c.get("options", []),
                        "answer": c.get("answer_index", 0), "transcriptEn": c.get("transcriptEn", "")})
        elif k == "wordSpot":
            out.append({"kind": "wordSpot", "stage": c.get("stage", 2), "audio": c.get("audio", ""),
                        "speed": c.get("speed", 0.8), "prompt": c.get("cue") or c.get("question", ""),
                        "words": c.get("words", []), "answer": c.get("answer_index", 0),
                        "transcriptEn": c.get("transcriptEn", "")})
        elif k == "conversation":
            out.append({"kind": "conversation", "stage": c.get("stage", 5), "speed": c.get("speed", 1.0),
                        "lines": c.get("lines", []), "questions": c.get("questions", [])})
        elif k == "shadow":
            out.append({"kind": "shadow", "stage": c.get("stage", 6), "speed": c.get("speed", 0.9),
                        "lines": c.get("lines", [])})
        elif k == "challenge":
            out.append({"kind": "challenge", "stage": c.get("stage", 7), "speed": c.get("speed", 1.0),
                        "lines": c.get("lines", []), "prompt": c.get("question") or c.get("cue", ""),
                        "answer": c.get("answer_text", ""), "transcriptEn": c.get("transcriptEn", "")})
    return out


# ────────────────────── checkpointed narrative listening items ──────────────────────
# A ListeningItem is NOT a lesson deck like the three above — it's one continuous
# narrative transcript with comprehension checkpoints inserted at points in it, the
# primary Listening-tab mechanic (see models.listening_item / services.listening).
# Unlike a mission's `_LISTENING_SPEC` deck (short heterogeneous drill cards), a story
# introduces NO new vocabulary — it only reuses what's already taught, so there's no
# "new vocab" side of the ledger the way generate_mission() has. Transcript +
# checkpoints are generated in a SINGLE LLM call so questions stay grounded in what
# the narrative actually says.

_STORY_SENTENCE = {
    "type": "object",
    "properties": {
        "sentence_id": {"type": "integer"},
        "speaker": {"type": "string"},
        "text_es": {"type": "string"},
        "text_en": {"type": "string"},
    },
    "required": ["sentence_id", "speaker", "text_es", "text_en"],
}
_STORY_CHECKPOINT = {
    "type": "object",
    "properties": {
        "after_sentence_id": {"type": "integer"},
        "type": {"type": "string"},  # predict|comprehension|inference|vocab_in_context|delayed_recall
        "prompt": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},  # empty = free text
        "correct_answer": {"type": "string"},
        "linked_concept_type": {"type": "string"},  # "vocab" | "grammar_pattern" | ""
        "linked_concept_id": {"type": "string"},    # spanish word, or grammar pattern text; "" if none
        "difficulty_tag": {"type": "string"},        # "easy" | "medium" | "hard"
    },
    "required": [
        "after_sentence_id", "type", "prompt", "options", "correct_answer",
        "linked_concept_type", "linked_concept_id", "difficulty_tag",
    ],
}
_STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "sentences": {"type": "array", "items": _STORY_SENTENCE},
        "checkpoints": {"type": "array", "items": _STORY_CHECKPOINT},
    },
    "required": ["title", "sentences", "checkpoints"],
}

_STORY_SPEC = (
    "Write transcript sentences (sentence_id sequential starting at 0), alternating "
    "speaker where natural (a narrator, or named characters), each with text_es (the "
    "literal spoken Spanish) and text_en (English gloss). Target roughly 60 seconds of "
    "natural spoken audio in total (approximately 140-170 Spanish words across the whole "
    "transcript) — usually 16-22 sentences, but let sentence count follow the word "
    "target rather than a fixed count.\n\n"
    "Insert exactly 5 checkpoints, spaced out evenly across the story (not clustered at "
    "the start or end) — do NOT over-densify into a quiz. Checkpoint types:\n"
    "  predict — placed BEFORE the moment it concerns (after_sentence_id = the sentence "
    "just before it); ask what happens next; options[3]; correct_answer = the matching "
    "option text.\n"
    "  comprehension — placed after a passage; ask what just happened; options[3] or "
    "leave options empty for free text; correct_answer required either way.\n"
    "  inference — ask the learner to infer something not stated directly (a feeling, a "
    "reason, a relationship between two people). If it draws on one of the grammar "
    "patterns listed below, set linked_concept_type='grammar_pattern' and "
    "linked_concept_id to that pattern's exact text.\n"
    "  vocab_in_context — ask what a specific already-known word meant in this context; "
    "set linked_concept_type='vocab' and linked_concept_id to that exact Spanish word "
    "(it must appear verbatim in one of the text_es sentences); options[3] or free text.\n"
    "  delayed_recall — include exactly ONE, placed near the final sentence, referencing "
    "something from the first third of the story.\n"
    "Use all 5 checkpoint types exactly once each (predict, comprehension, inference, "
    "vocab_in_context, delayed_recall).\n\n"
    "Every checkpoint's prompt, and every option in options[], must be written in "
    "ENGLISH — the learner is asked about the Spanish they just heard, in English. The "
    "one exception: for vocab_in_context, correct_answer (and any options that are the "
    "target word itself) must stay the exact Spanish word as it appears in text_es — "
    "only the prompt wording is English. For every other checkpoint type, correct_answer "
    "is English too, matching its options.\n\n"
    "For any checkpoint with no linked concept, set linked_concept_type='' and "
    "linked_concept_id=''. difficulty_tag is 'easy', 'medium' or 'hard'. Keep pacing "
    "conversational — checkpoints inform curiosity, they don't gate a quiz."
)


def _story_prompt(scenario: str, level: str, vocab_block: str, grammar_patterns: list[dict]) -> str:
    grammar_txt = "\n".join(f"- {g['pattern']}: {g['gloss']}" for g in grammar_patterns) or (
        "(none — this story isn't scoped to a specific mission's grammar)"
    )
    return (
        f"Write a checkpointed narrative Spanish listening story. Scenario: \"{scenario}\". "
        f"CEFR level: {level}.\n\n{vocab_block}\n\n"
        "This story teaches NO new vocabulary — every sentence must be built ONLY from "
        "the already-known words above plus basic connectors. This is a comprehension "
        "story, not a lesson.\n\n"
        f"Grammar patterns available for 'inference' checkpoints (optional):\n{grammar_txt}\n\n"
        f"{_STORY_SPEC}"
    )


def _norm_story(raw: dict, *, item_id: str, scenario_tag: str | None, cefr_level: str) -> dict:
    """Map the raw LLM output to the ListeningItem/ListeningCheckpoint DB shape."""
    sentences = [
        {
            "sentence_id": s.get("sentence_id", i),
            "speaker": s.get("speaker", ""),
            "text_es": s.get("text_es", ""),
            "text_en": s.get("text_en", ""),
        }
        for i, s in enumerate(raw.get("sentences", []))
    ]
    checkpoints = [
        {
            "after_sentence_id": c.get("after_sentence_id", 0),
            "type": c.get("type", "comprehension"),
            "prompt": c.get("prompt", ""),
            "options": [o for o in c.get("options", []) if o],
            "correct_answer": c.get("correct_answer", ""),
            "linked_concept_type": c.get("linked_concept_type") or None,
            "linked_concept_id": c.get("linked_concept_id") or None,
            "difficulty_tag": c.get("difficulty_tag") or None,
        }
        for c in raw.get("checkpoints", [])
    ]
    vocab_reused = sorted({w for s in sentences for w in _words(s["text_es"])})
    return {
        "id": item_id,
        "scenario_tag": scenario_tag,
        "cefr_level": cefr_level,
        "title": raw.get("title", item_id),
        "sentences": sentences,
        "vocab_reused": vocab_reused,
        "checkpoints": checkpoints,
    }


def lint_story_vocab(item: dict, allowed: set[str]) -> list[str]:
    """Offline check mirroring lint_vocab's word-budget walk, scoped to a generated
    ListeningItem: every transcript sentence, plus vocab_in_context checkpoint
    answers/options, must stay within the allowed (known+glue) word set. Stories
    introduce no new vocabulary, so unlike lint_vocab there's no per-mission "new
    words" side of the budget — `allowed` is exactly allowed_word_set([], known).
    """
    allowed_stems = {_stem(a) for a in allowed}
    strings: list[str] = [s["text_es"] for s in item.get("sentences", [])]
    for c in item.get("checkpoints", []):
        if c.get("type") == "vocab_in_context":
            strings.append(c.get("correct_answer") or "")
            strings.extend(c.get("options") or [])

    violations: list[str] = []
    seen: set[str] = set()
    for s in strings:
        if not s:
            continue
        for pos, raw in enumerate(s.split()):
            w = _norm(raw)
            if not w or w in allowed or w.isdigit() or w in seen:
                continue
            if _stem(w) in allowed_stems:
                continue
            if pos > 0 and raw[:1].isupper():
                continue
            seen.add(w)
            violations.append(f"'{w}'  (in: {s!r})")
    return violations


def generate_story(
    scenario: str,
    level: str,
    item_id: str,
    scenario_tag: str | None = None,
    vocab: list[str] | None = None,
) -> dict:
    """Generate one checkpointed narrative listening item — transcript + checkpoints
    in a SINGLE LLM call, so questions stay grounded in what the narrative actually
    says. Reuses the same vocab-reuse machinery as generate_mission
    (load_known_vocab/allowed_word_set/_vocab_block); linting is via
    lint_story_vocab, not lint_vocab, since a story's shape isn't a mission's.

    scenario_tag scopes the story to a mission: known vocab is that mission's own
    vocab plus everything taught before it, and its grammar patterns are offered as
    optional 'inference' checkpoint material (Step 5 of the listening feature —
    Mission's Listening step renders items filtered to its own scenario_tag).
    Standalone stories (scenario_tag=None) may reuse anything taught up to `level`
    across every mission, for the unscoped Listening tab picker.

    vocab, when given, REPLACES the known-vocab pool entirely with exactly these
    words/phrases (scenario_tag's own vocab is ignored for this purpose, though its
    grammar patterns are still offered) — the global cross-mission pool otherwise
    used for standalone stories skews toward whatever's been taught so far (heavy
    on travel/café/health words), which reads as off-topic drift for any scenario
    outside that set. Passing a topic-appropriate word list keeps the story on-topic.
    """
    grammar_patterns: list[dict] = []
    mission_data: dict | None = None
    if scenario_tag:
        mission_path = CONTENT_DIR / f"{scenario_tag}.json"
        if not mission_path.exists():
            raise FileNotFoundError(f"No mission JSON at {mission_path} for scenario_tag={scenario_tag}")
        mission_data = json.loads(mission_path.read_text(encoding="utf-8"))
        grammar_patterns = mission_data.get("grammar", [])

    if vocab is not None:
        known: dict[str, list[str]] = {}
        for phrase in vocab:
            phrase = phrase.strip()
            if not phrase:
                continue
            for w in _words(phrase):
                known.setdefault(w, []).append(phrase)
    elif mission_data is not None:
        known = load_known_vocab(exclude_id=scenario_tag)
        # A story never introduces anything new — its own mission's vocab counts
        # as "known" here too (unlike generate_mission, which teaches it as new).
        for v in mission_data.get("vocab", []):
            for w in _words(v.get("spanish", "")):
                known.setdefault(w, []).append(v["spanish"])
    else:
        known = load_known_vocab()

    vblock = _vocab_block([], known)
    prompt = _story_prompt(scenario, level, vblock, grammar_patterns)
    raw = _llm(prompt, _STORY_SCHEMA)
    item = _norm_story(raw, item_id=item_id, scenario_tag=scenario_tag, cefr_level=level)

    allowed = allowed_word_set([], known)
    return {"item": item, "allowed": allowed, "known_count": len(known)}
