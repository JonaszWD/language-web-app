"""Offline mission generator.

Given a scenario + CEFR level, generate a complete, playable mission — vocab,
grammar patterns, the grammar/listening/writing lesson decks, the Final Challenge
scene, and the frontend overlay (icon/coords/levels) — using the SAME LLM stack
as enrichment (Gemini → Claude fallback, strict JSON schemas).

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

from app.services import enrich as enrich_service

CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "missions"

# Function words, connectors and courtesy fillers that are always allowed in
# exercises even though they aren't "taught vocab" — the glue A1 learners have
# from day one. Kept deliberately small; content words must come from the deck.
ALLOWED_GLUE = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "al", "del",
    "de", "a", "en", "con", "sin", "por", "para", "y", "o", "que", "se", "su",
    "mi", "tu", "me", "te", "le", "les", "nos", "no", "sí", "es", "está", "son",
    "están", "soy", "eres", "muy", "más", "menos", "aquí", "allí", "esto", "eso",
    "este", "esta", "ese", "esa", "tres", "dos", "uno", "cuatro", "cinco",
    "por favor", "gracias", "hola", "buenos", "días", "buenas", "tardes",
    "señor", "señora", "usted", "yo", "tú", "él", "ella", "cómo", "qué",
    "dónde", "cuánto", "cuándo", "hay", "tiene", "tengo", "quiero", "quisiera",
}


def _norm(text: str) -> str:
    """Lowercase, strip accents and punctuation — the comparison key for words."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[¿?¡!.,;:'\"()…]", "", text).strip()


def _words(spanish: str) -> list[str]:
    """Content words in a Spanish string, normalised."""
    return [w for w in _norm(spanish).split() if w]


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
    """The full set of normalised words an exercise may use: taught + new + glue."""
    allowed = set(known) | set(ALLOWED_GLUE)
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
    strings: list[str] = []
    _collect_spanish(mission, strings)

    violations: list[str] = []
    seen: set[str] = set()
    for s in strings:
        for w in _words(s):
            if not w or w in allowed or w.isdigit() or w in seen:
                continue
            # Capitalised single token in the original ⇒ likely a name; skip.
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
    "required": ["kind"],
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
        "y/por favor/…). Do NOT introduce any other content word the learner has "
        "not been taught. Keep everything natural and at the stated level."
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
    return enrich_service._call(prompt, _META_SCHEMA)


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
    "Everything built from known+new vocab. ~7-8 cards."
)
_LISTENING_SPEC = (
    "Kinds by stage (audio = the Spanish spoken; speed 0.6-1.0; transcriptEn = 'es — en'):\n"
    "intro{mission,goals[3]} · predict(stage1){setup,question,options[3],answer_index,audio,"
    "speed,transcriptEn} · recognition(stage1-2){audio,speed,question,options[3],answer_index,"
    "transcriptEn} · wordSpot(stage2){audio,speed,question→cue,words[3-4],answer_index,"
    "transcriptEn} · conversation(stage5){lines[4 {who,es,en}],questions[2 {question,options,"
    "answer}]} · shadow(stage6){lines[3-4 {who,es,en}]} · challenge(stage7){lines[2],cue→"
    "question,answer_text,transcriptEn}. ~9-10 cards."
)


def generate_mission(scenario: str, level: str, mission_id: str) -> dict:
    """Generate a full mission. Returns a dict with `backend` (mission JSON for
    content/missions/) and `frontend` (overlay + lesson decks for the client)."""
    known = load_known_vocab(exclude_id=mission_id)
    order_index = next_order_index()

    meta = _generate_meta(scenario, level, known, n_new=12)
    vblock = _vocab_block(meta["vocab"], known)

    grammar_deck = enrich_service._call(
        _deck_prompt("grammar", scenario, level, vblock, _GRAMMAR_SPEC), _DECK_SCHEMA
    )
    writing_deck = enrich_service._call(
        _deck_prompt("writing", scenario, level, vblock, _WRITING_SPEC), _DECK_SCHEMA
    )
    listening_deck = enrich_service._call(
        _deck_prompt("listening", scenario, level, vblock, _LISTENING_SPEC), _DECK_SCHEMA
    )

    tag = f"{level} · {scenario.split()[-1].title()}"
    backend = {
        "id": mission_id,
        "order_index": order_index,
        "title": meta["title"],
        "description": meta["description"],
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
        "grammar": {"title": meta["title"], "cards": _norm_cards(grammar_deck["cards"])},
        "listening": {"title": meta["title"], "cards": _norm_cards(listening_deck["cards"])},
        "writing": {"title": meta["title"], "cards": _norm_cards(writing_deck["cards"])},
    }
    return {"backend": backend, "frontend": frontend, "known_count": len(known)}


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
def _norm_cards(cards: list[dict]) -> list[dict]:
    out: list[dict] = []
    for c in cards:
        k = c.get("kind")
        if k == "intro":
            out.append({"kind": "intro", "mission": c.get("mission", ""), "goals": c.get("goals", [])})
        elif k == "learn":
            card = {"kind": "learn", "pattern": c.get("pattern", ""), "gloss": c.get("gloss", ""),
                    "examples": c.get("examples", [])}
            if c.get("notice"): card["notice"] = c["notice"]
            out.append(card)
        elif k == "recognition":
            card = {"kind": "recognition", "question": c.get("question", ""),
                    "options": c.get("options", []), "answer": c.get("answer_index", 0)}
            if c.get("stage"): card["stage"] = c["stage"]
            if c.get("audio"): card.update(audio=c["audio"], speed=c.get("speed", 0.8))
            if c.get("transcriptEn"): card["transcriptEn"] = c["transcriptEn"]
            out.append(card)
        elif k == "production":
            card = {"kind": "production", "prompts": c.get("prompts", [])}
            if c.get("instruction"): card["instruction"] = c["instruction"]
            if c.get("stage"): card["stage"] = c["stage"]
            out.append(card)
        elif k == "build":
            card = {"kind": "build", "cue": c.get("cue", ""), "answer": c.get("answer_tokens", [])}
            if c.get("instruction"): card["instruction"] = c["instruction"]
            if c.get("stage"):  # writing build: bank + string answer
                card = {"kind": "build", "stage": c["stage"], "prompt": c.get("cue", ""),
                        "bank": c.get("answer_tokens", []), "answer": " ".join(c.get("answer_tokens", []))}
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
            if c.get("notice"): card["note"] = c["notice"]
            out.append(card)
        elif k == "prompt":
            card = {"kind": "prompt", "stage": 3, "prompt": c.get("cue", ""), "answer": c.get("answer_text", "")}
            if c.get("notice"): card["hint"] = c["notice"]
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
