import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MissionVocabResponse(BaseModel):
    id: uuid.UUID
    order_index: int
    spanish: str
    english: str
    example_sentence: Optional[str]
    part_of_speech: Optional[str]
    enrichment: Optional[dict] = None
    image_url: Optional[str] = None
    # The current user's 1-5 vocabulary-training level for this word (from their
    # UserCard). None when the word isn't in the user's deck yet.
    level: Optional[int] = None

    model_config = {"from_attributes": True}


class GrammarPatternResponse(BaseModel):
    """One of the mission's ~3 grammar structures — enough for the client to
    match a hardcoded GrammarLesson review card to its backend pattern_id and
    post an FSRS review for it."""

    id: uuid.UUID
    order_index: int
    pattern: str
    gloss: str
    example_es: str
    cloze_template: str
    cloze_answer: str

    model_config = {"from_attributes": True}


class MissionSummary(BaseModel):
    """Lightweight list item — no vocab, just enough to render the tab."""

    id: str
    order_index: int
    title: str
    description: Optional[str]
    vocab_count: int


class MissionResponse(BaseModel):
    id: str
    order_index: int
    title: str
    description: Optional[str]
    enrichment_status: str
    # The LLM-generated 7-stage speaking role-play. None until enrichment runs.
    speaking: Optional[dict] = None
    vocab: list[MissionVocabResponse]
    grammar: list[GrammarPatternResponse] = []
    # The current user's progress: None if never started, else "available" or
    # "completed". Drives whether the client offers the guided first playthrough
    # or the free practice menu.
    status: Optional[str] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SpeakingTurn(BaseModel):
    """One line of the running free-conversation history (stages 5-7)."""

    speaker: str   # "npc" | "learner"
    text: str


class SpeakingTurnRequest(BaseModel):
    """A learner utterance to evaluate against a free-conversation stage."""

    role: str                 # the NPC persona, e.g. "camarero"
    setting: str              # scene, e.g. "a café in Spain"
    goal: str                 # what the learner must accomplish this stage
    history: list[SpeakingTurn] = []
    utterance: str            # what the learner just said
    # Browser SpeechRecognition's own confidence (0-1) for this utterance, when
    # available — a rough, free proxy for pronunciation clarity (no phonetic
    # scoring exists in the stack). None on browsers that don't report it.
    confidence: Optional[float] = None


class SpeakingScene(BaseModel):
    """The Final Challenge scene — everything the client needs to cold-open the
    conversation. No hints, no scaffolding: just the role, setting, goal and the
    NPC's very first line."""

    role: str            # NPC persona in Spanish, e.g. "camarero"
    role_en: str
    setting: str         # scene, e.g. "a café in Spain"
    goal: str            # what a successful interaction covers (internal, not shown)
    opening: str         # NPC's first line in Spanish — shown immediately
    opening_en: str


class SpeakingTurnResponse(BaseModel):
    understood: bool          # did the learner's Spanish achieve the intent?
    npc_reply: str            # the NPC's in-character next line (Spanish)
    npc_reply_en: str         # English translation of npc_reply
    correction: str           # gentle post-hoc fix, "" when none needed
    done: bool                # has the scene's goal been fully completed?


class MissionEnrichStatus(BaseModel):
    """Enrichment progress for the 'preparing mission' window."""

    mission_id: str
    status: str          # pending | processing | ready
    enriched: int
    total: int


class MissionStartResponse(BaseModel):
    """Result of making a mission available for the current user."""

    mission_id: str
    status: str
    vocab_added: int


class MissionCompleteResponse(BaseModel):
    """Result of finishing a mission's Final Challenge."""

    mission_id: str
    status: str
    completed_at: Optional[datetime] = None
