# Plauda

**A Spanish tutor you talk to.** Plauda (developed under the working name *SpanishUp*) is a full-stack language-learning app built around **spoken conversation**. Learners talk out loud with AI characters in real situations, such as ordering at a café, checking into a hotel or negotiating a contract. They get grammar corrections on what they said, translations of words they don't know, and feedback on their pronunciation, one word at a time. Vocabulary, grammar, listening and writing practice all feed into those conversations, and FSRS-4.5 spaced repetition brings the material back at the right time.

> **Project status: archived.** Development has finished and the repository is kept as a portfolio piece. The app is complete and runs locally with one command, but no hosted version is maintained.

![Hands-free voice conversation with an AI waiter](.github/assets/speaking-conversation.png)

*A real session: the learner speaks hands-free, the mic sends each turn automatically when they pause, and the waiter's reply streams in. The mistake in "La tortilla es muy rico" is corrected inline, the scene's goals tick off on the right, and hovering any unknown word shows its translation.*

## Speech: the core of the app

### Hands-free voice conversation

- The learner taps the mic once and then simply talks. The Web Speech API (`es-ES`) transcribes continuously, a pause of about 1.4 seconds counts as end of turn, and the turn is sent with no button press.
- The mic is muted while the AI character speaks, so the app never transcribes its own voice. It re-arms when the reply finishes. Chrome's forced session restarts and its ~60-second session limit are absorbed without losing what the learner already said.
- Replies are streamed token by token over Server-Sent Events, so the character starts answering immediately. They are spoken with ElevenLabs voices when a key is set, and with the browser's own voice otherwise.
- Every turn is evaluated as structured output alongside the reply: whether the learner was understood, a corrected version of what they said, an English translation, and which of the scene's goals have now been met.
- Words in the character's replies that aren't in the learner's deck are underlined. Hovering one shows its translation.

### A 7-stage speaking ladder in every mission

Each mission generates its own role-play. It moves from fully supported to unscripted: *repeat → choose → fill the gaps → say it from an English cue → short live exchange → branching conversation → free conversation*. At the end comes the **Final Challenge**, a native-speed conversation with no hints. Early stages accept only the target line. Later stages accept any correct way of saying it, because the goal is to communicate rather than recite.

### Pronunciation practice

![Per-word pronunciation feedback](.github/assets/pronunciation.png)

- Each attempt is scored word by word against the target phrase, using the closest of up to five recogniser hypotheses. Short-word near-misses such as *pero* for *perro* are deliberately counted as errors, because those minimal pairs are the sounds being trained.
- Misses are charged to the sounds they contain (rolled R, tapped R, J/soft G, Ñ, LL/Y, Z/soft C, B/V, soft D, pure vowels). That builds a running "sounds to work on" profile, and the drills that come up next are steered toward the weakest one.
- Every score is logged to the backend's skill statistics, so pronunciation shows up on the learner's dashboard.

### How a spoken turn flows

```
mic ─► Web Speech API (es-ES, continuous) ─► ~1.4 s silence ─► POST /api/speaking/turn
                                                                  │
          FastAPI ─► LLM (Claude Haiku / Mistral) ◄────────────────┘
             │  streams reply tokens over SSE, then a final JSON event:
             │  { understood, correction, npc_reply_en, objectives_met }
             ▼
browser renders tokens live ─► TTS (ElevenLabs, or browser voice) ─► mic re-arms
             └─► record_attempt() ─► user_skill_stats ─► dashboard
```

## Everything around it

| Missions | A mission's path |
|---|---|
| ![Missions](.github/assets/missions.png) | ![Mission path](.github/assets/mission-detail.png) |

- **30 missions from A1 to B2.** Each has 12 target words, 3 grammar patterns and an AI speaking scene, and walks through *Context Preview → Listening → Vocabulary → Grammar → Vocabulary → Speaking → Writing → Feedback → Recap → Final Challenge*. When a mission is first opened, an LLM pipeline enriches its vocabulary and writes its speaking script and context preview. Mistral is tried first and Claude Haiku is the fallback, and the results are cached in Postgres.
- **Vocabulary.** A 5-level trainer (recognition → picture + scrambled letters → recall → cloze → free sentence graded by AI), scheduled with FSRS.
- **Grammar.** A 44-topic syllabus from A1 to C1. Every topic is a 7-stage lesson that ends in AI-graded free production and spaced review.
- **Listening.** Checkpointed stories that pause to ask comprehension questions, plus a podcast player: import a YouTube playlist, transcribe episodes with faster-whisper, follow along in a timestamped transcript, and tap any word to save it to your deck.
- **Writing and dashboard.** Guided writing with an AI coach, and a dashboard covering streaks, retention, XP trend, per-skill accuracy and problem sounds.

## Architecture

```
Browser ──► Next.js 15 (App Router, :3000) ──/api/* rewrite──► FastAPI (:8000) ──► PostgreSQL
                                                                  │  ├─► Redis (dashboard cache)
                                                                  │  ├─► APScheduler + thread pool (yt-dlp downloads, faster-whisper)
                                                                  │  └─► Mistral / Claude / DeepL / Pexels / ElevenLabs (all optional)
```

- **Same-origin API.** The browser only ever calls `/api/*` on the frontend. Next.js rewrites those requests to the backend over the internal Docker network.
- **Auth.** A JWT in an httpOnly `access_token` cookie. Server components forward the cookie to `/auth/me`.
- **Backend layering.** `routers/` (HTTP) → `services/` (logic) → `models/` (SQLAlchemy 2.0), with Pydantic `schemas/` and hand-written Alembic migrations (head: `0028`).
- **Content as code.** Missions and listening stories are version-controlled JSON (`backend/content/`) and are upserted on every boot by `seed.py`. The frontend lesson decks live in `frontend/src/content/`.
- **Spaced repetition.** FSRS-4.5 is ported to Python (`services/srs.py`), and the same scheduler is used for vocabulary cards and grammar patterns.

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind + hand-rolled CSS, react-three-fiber (mission globe) |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, APScheduler |
| Data | PostgreSQL 16, Redis 7 |
| AI / media | Mistral Small, Claude Haiku, DeepL, Pexels, ElevenLabs, faster-whisper, yt-dlp |
| Tooling | Docker Compose, uv, ruff, mypy, ESLint, GitHub Actions |

## Getting started

Requirements: Docker with Compose v2.

```bash
git clone https://github.com/JonaszWD/Language-web-app.git
cd Language-web-app
cp .env.example .env      # works as-is for local use
make dev                  # builds and starts db, redis, backend, frontend
```

Open <http://localhost:3000> and create an account. The onboarding flow includes a short placement test. On boot the backend runs `alembic upgrade head` and `python seed.py`, so a fresh clone needs no extra steps.

### API keys (all optional)

The app runs without any keys. Each key turns on one group of features:

| Variable | Enables |
|---|---|
| `MISTRAL_API_KEY` | Mission enrichment, AI grading of sentences and grammar production, speaking turns (primary provider) |
| `CLAUDE_API_KEY` | Fallback for everything above (Claude Haiku) |
| `DEEPL_API_KEY` | Tap-to-translate in podcast transcripts and word glosses |
| `PEXELS_API_KEY` | Pictures for level-2 vocabulary exercises |
| `ELEVENLABS_API_KEY` | Natural NPC voices and two-voice long-form stories (the browser's TTS is used otherwise) |

## Development

```bash
make dev       # full stack with hot reload (backend: uvicorn --reload, frontend: next dev)
make migrate   # alembic upgrade head
make seed      # re-upsert missions + listening stories from backend/content/
make logs      # tail every service
make stop      # docker compose down
make clean     # down + drop volumes (wipes the database and downloaded audio)
```

Checks (the same ones CI runs on every push):

```bash
cd backend  && uv sync --dev && uv run ruff check . && uv run mypy app/ && uv run pytest
cd frontend && npm install && npm run lint && npx tsc --noEmit
```

New migration: `docker compose exec backend alembic revision -m "message"`, then edit the file under `backend/alembic/versions/`. Migrations are written by hand, without autogenerate.

### Authoring content

New missions and listening stories are generated offline and committed as JSON:

```bash
# inside the backend container; needs MISTRAL_API_KEY or CLAUDE_API_KEY
python scripts/generate_mission.py --scenario "At the pharmacy" --level A2
python scripts/generate_mission.py --story --scenario "Losing your passport" --level B1
python scripts/generate_mission.py --check m029-pharmacy   # offline vocabulary-budget lint
```

The generator only uses vocabulary taught by earlier missions plus the new mission's own words, and `--check` reports any word that falls outside that budget.

## Project structure

```
backend/
  app/
    routers/      auth, missions, study, vocab, grammar, listening, speaking, writing,
                  podcasts, stats, goals, tts, words
    services/     srs (FSRS), missions, mission_gen, enrich (LLM), vocab, listening,
                  podcast (yt-dlp + whisper), skill_stats, translate, tts, ...
    models/       SQLAlchemy models (all imported in models/__init__.py)
    schemas/      Pydantic request/response models
  alembic/        hand-written migrations 0001–0028
  content/        missions/*.json, listening/*.json (seeded on boot)
  scripts/        generate_mission.py, seed_listening_items.py
frontend/
  src/app/        routes: (app)/home, missions, grammar, listening, speaking, vocabulary,
                  writing; login; register (5-screen onboarding); planet (globe demo)
  src/components/ screens/, lesson engines (Grammar/Listening/Writing/Speaking),
                  PodcastPlayer, PronunciationPractice, FreeChat, VocabTrainer
  src/content/    generated mission decks + A2–C1 grammar lessons
docker-compose.yml          local dev
docker-compose.prod.yml     self-hosted production (only :3000 published)
docker-compose.deploy.yml   prebuilt GHCR images (used by the manual CD workflow)
```

## Deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Only the frontend is published (port 3000). It proxies `/api` to the backend, which runs with migrations and seeding on boot and **a single uvicorn worker**. One worker is required because the podcast scheduler and the download/transcription queue run in-process. Set `ENABLE_SCHEDULER=0` if you need more workers. The Whisper model cache and podcast audio are kept in named volumes.

The `CD` GitHub workflow is manual-only now. It builds images to GHCR and can roll them out to a host over SSH.

## Known limitations

- Voice input relies on the browser's speech recogniser, so the voice features work in Chrome, Edge and Safari. Other browsers fall back to a text box. Pronunciation scoring checks whether each word came through clearly, not phoneme-level accuracy.
- Per-sound pronunciation history and grammar-lesson progress are kept in `localStorage`, so they don't follow a learner across devices.
- The globe view's optional 3D city layer is switched off because the Kenney building models it uses are not bundled.
- Automated tests cover only the pure logic (FSRS scheduler, answer normalisation). There are no API or UI tests yet; those paths are checked by lint, type checks in CI and manual end-to-end runs.

## License

[MIT](LICENSE) © 2026 Jonasz
