# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Conventions

- Do not use emojis in code, UI, or copy. Use symbols/icons instead (e.g. the existing `Icon` component, unicode glyphs, or SVGs).

## Overview

Plauda (working name SpanishUp) — full-stack Spanish-learning web app. The core loop is **missions**: scenario units (A1-B2) that walk the learner through Context Preview → Listening → Vocabulary → Grammar → Speaking → Writing → Feedback → Vocabulary Recap → Final Challenge. Standalone tabs cover each skill (Grammar syllabus A1-C1, Listening stories + YouTube podcast player, Speaking AI chat + pronunciation practice, Writing, Vocabulary). Words and grammar patterns are scheduled with FSRS.

Stack: Next.js 15 (App Router) frontend, FastAPI backend, PostgreSQL, Redis, all wired via Docker Compose. The project is archived (portfolio state); see README.md.

## Commands

Everything runs through Docker Compose (Makefile wraps it):

```
make dev      # docker compose up --build — full stack on :3000 (web), :8000 (api); backend migrates + seeds on boot
make migrate  # alembic upgrade head  (inside backend container)
make seed     # python seed.py — upserts missions + listening stories from backend/content/
make logs     # tail all services
make stop     # compose down
make clean    # compose down -v  (drops volumes — wipes db + downloaded audio)
```

Checks (mirrors CI):
- Backend: `cd backend && uv sync --dev && uv run ruff check . && uv run mypy app/` (Python 3.12; pyproject deps mirror requirements.txt — keep both in sync and re-run `uv lock`).
- Frontend: `cd frontend && npm run lint && npx tsc --noEmit`.

Single-service iteration:
- Backend uvicorn runs with `--reload`; volume-mounted, so Python edits hot-reload.
- Frontend `next dev` hot-reloads via the `./frontend:/app` mount. Don't run `next build` locally while the dev container is up — it shares `.next`.

New Alembic migration: `docker compose exec backend alembic revision -m "msg"` then edit under `backend/alembic/versions/` (current head is `0028_listening_long_form`). No autogenerate convention in use — migrations are hand-written.

There is no test suite.

## Architecture

### Request path
Browser → Next.js (`:3000`) → `next.config.js` rewrites `/api/:path*` → backend (`BACKEND_URL`, default `http://backend:8000`). The frontend never calls the backend origin directly from the browser; everything is same-origin `/api/*`. Server Components fetch the backend internally via `BACKEND_URL` (see [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)).

### Auth
JWT in an `access_token` **cookie** (not bearer header). Backend issues/reads it; `get_current_user` in [backend/app/dependencies.py](backend/app/dependencies.py) pulls it from the cookie. Server-side `requireAuth()` / `getMe()` forward the cookie to `/auth/me`. `/register` is the full 5-screen onboarding (test-first, real auth at the end), not a bare signup form.

### Backend layering ([backend/app/](backend/app/))
`routers/` (HTTP) → `services/` (logic) → `models/` (SQLAlchemy). `schemas/` holds Pydantic I/O. Routers: `auth, words, study, stats, podcasts, vocab, grammar, writing, missions, goals, speaking, tts, listening`. All models must be imported in [models/__init__.py](backend/app/models/__init__.py) so Alembic/metadata sees them.

### Missions & content
- Canonical content is JSON: `backend/content/missions/*.json` (vocab, grammar patterns, speaking scene, topics) and `backend/content/listening/*.json` (checkpointed stories). [seed.py](backend/seed.py) upserts both and syncs `mission_goals` from each mission's `topics`.
- Frontend lesson decks for missions (grammar/listening/writing cards + overlay) live in `frontend/src/content/generated-missions.json`; the A2-C1 grammar syllabus lessons live in [frontend/src/content/grammar-lessons.ts](frontend/src/content/grammar-lessons.ts).
- `backend/scripts/generate_mission.py` generates new missions/stories with an LLM; `--check <id>` lints vocabulary budget offline.
- On first open, `services/missions.py` + `services/enrich.py` enrich a mission's vocab and generate its speaking script and context preview (Mistral primary, Claude Haiku fallback), cached on the `missions` row.
- Mission step ladder is built client-side in [missionData.ts](frontend/src/components/screens/missions/missionData.ts) (`buildMissionSteps`).

### Podcast pipeline ([backend/app/services/podcast.py](backend/app/services/podcast.py))
YouTube playlists are imported as feeds (UI: [PodcastPlayer.tsx](frontend/src/components/PodcastPlayer.tsx), reached from the Listening tab). yt-dlp extracts metadata immediately; **audio downloads run on a background ThreadPoolExecutor**; **transcription (faster-whisper) runs on demand** (or auto, gated by the `auto_transcribe` row in `app_settings`). Episodes carry independent `download_status` and `transcript_status` state machines (constants in [models/podcast.py](backend/app/models/podcast.py)).

A 30-min APScheduler job refreshes feeds. On startup, `_recover_jobs()` in [main.py](backend/app/main.py) resets stale `pending` states and re-queues downloads whose audio file vanished. **Single uvicorn worker is required** — the scheduler + in-process download/transcription queue assume one process. Disable the scheduler with `ENABLE_SCHEDULER=0` if running multiple workers.

### SRS ([backend/app/services/srs.py](backend/app/services/srs.py))
FSRS-4.5 ported to Python (hardcoded `W` weights). Ratings 1=Again/2=Hard/3=Good/4=Easy; states new→learning→review→relearning. `UserCard` (vocab) and `UserGrammarCard` (grammar patterns) store per-user scheduling state.

### Skill stats & dashboard
`services/skill_stats.record_attempt()` rolls every graded answer into `user_skill_stats` (per skill) and busts the Redis dashboard cache. `GET /stats/dashboard` aggregates those rows plus `vocab_extra`, `grammar_extra` and `progress_extra` (retention, consistency, XP trend...). Pronunciation practice scores client-side and logs via `POST /speaking/pronunciation`.

### Word→vocab ([backend/app/services/translate.py](backend/app/services/translate.py))
Tapping a transcript word calls DeepL (`DEEPL_API_KEY`) to translate and save it as a card. Key optional — when unset the translate+save endpoint returns a clear 502.

## Deployment

- **Local:** `docker-compose.yml` — exposes db/redis/backend/frontend ports for dev.
- **Self-hosted prod:** `docker-compose.prod.yml` — only frontend `:3000` is published; it proxies `/api` to the backend over the internal network. Backend command does `alembic upgrade head && python seed.py && uvicorn ... --workers 1`. Persists whisper model cache and podcast audio in named volumes.
- **CD:** `.github/workflows/cd.yml` is `workflow_dispatch` only (archived project) — builds images to GHCR and deploys `docker-compose.deploy.yml` over SSH.

## Gotchas

- Pin `bcrypt==3.2.2` — bcrypt 4.x breaks passlib's `detect_wrap_bug`.
- Backend Dockerfile installs deps with `uv pip install --system` and needs `ffmpeg` (yt-dlp/whisper).
- Frontend Dockerfiles use `npm install`, not `npm ci` (package-lock.json is committed but not enforced).
- `CORS_ORIGINS` is comma-separated in env; it's read as a raw string and split by the `settings.cors_origins` property in [config.py](backend/app/config.py) (a list-typed field would make pydantic-settings JSON-decode it and crash).
- Client components that read `localStorage` must do so after mount (hydration); the codebase uses a targeted `eslint-disable-next-line react-hooks/set-state-in-effect` for that pattern.

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature-slug>/` (local-markdown tracker; no external issue system). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles use their default strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily by `/domain-modeling`). See `docs/agents/domain.md`.
