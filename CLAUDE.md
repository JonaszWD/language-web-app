# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SpanishUp — full-stack Spanish-learning web app. Users import a YouTube podcast (channel/playlist/video), episodes are auto-downloaded and transcribed, and tapped words flow into an FSRS-scheduled flashcard deck.

Stack: Next.js 15 (App Router) frontend, FastAPI backend, PostgreSQL, Redis, all wired via Docker Compose. Brand colour is `#631B08` (dark terracotta).

## Commands

Everything runs through Docker Compose (Makefile wraps it):

```
make dev      # docker compose up --build  — full stack on :3000 (web), :8000 (api)
make migrate  # alembic upgrade head  (inside backend container)
make seed     # python seed.py        (inside backend container)
make logs     # tail all services
make stop     # compose down
make clean    # compose down -v  (drops volumes — wipes db + downloaded audio)
```

Single-service iteration:
- Backend uvicorn runs with `--reload`; volume-mounted, so Python edits hot-reload.
- Frontend `next dev` hot-reloads via the `./frontend:/app` mount.
- Frontend lint: `docker compose exec frontend npm run lint`.

New Alembic migration: `docker compose exec backend alembic revision -m "msg"` then edit under `backend/alembic/versions/` (current head is `0007_app_settings`). No autogenerate convention in use — migrations are hand-written.

There is no test suite. Root `main.py` is a leftover PyCharm stub — ignore it.

## Architecture

### Request path
Browser → Next.js (`:3000`) → `next.config.js` rewrites `/api/:path*` → backend (`BACKEND_URL`, default `http://backend:8000`). The frontend never calls the backend origin directly from the browser; everything is same-origin `/api/*`. Server Components fetch the backend internally via `BACKEND_URL` (see [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)).

### Auth
JWT in an `access_token` **cookie** (not bearer header). Backend issues/reads it; `get_current_user` in [backend/app/dependencies.py](backend/app/dependencies.py) pulls it from the cookie. Server-side `requireAuth()` / `getMe()` forward the cookie to `/auth/me`. `/register` is the full 5-screen onboarding (test-first, real auth at the end), not a bare signup form.

### Backend layering ([backend/app/](backend/app/))
`routers/` (HTTP) → `services/` (logic) → `models/` (SQLAlchemy). `schemas/` holds Pydantic I/O. Routers: `auth, words, study, stats, podcasts, vocab`. All models must be imported in [models/__init__.py](backend/app/models/__init__.py) so Alembic/metadata sees them.

### Podcast pipeline ([backend/app/services/podcast.py](backend/app/services/podcast.py))
A single YouTube source is the active feed. yt-dlp extracts metadata immediately; **audio downloads run on a background ThreadPoolExecutor**; **transcription (faster-whisper) runs on demand** (or auto, gated by the `auto_transcribe` row in the `app_settings` table). Episodes carry independent `download_status` and `transcript_status` state machines (constants in [models/podcast.py](backend/app/models/podcast.py)).

A 30-min APScheduler job refreshes feeds. On startup, `_recover_jobs()` in [main.py](backend/app/main.py) resets stale `pending` states and re-queues downloads whose audio file vanished. **Single uvicorn worker is required** — the scheduler + in-process download/transcription queue assume one process. Disable the scheduler with `ENABLE_SCHEDULER=0` if running multiple workers.

### SRS ([backend/app/services/srs.py](backend/app/services/srs.py))
FSRS-4.5 ported to Python (hardcoded `W` weights). Ratings 1=Again/2=Hard/3=Good/4=Easy; states new→learning→review→relearning. `UserCard` stores per-user scheduling state.

### Word→vocab ([backend/app/services/translate.py](backend/app/services/translate.py))
Tapping a transcript word calls DeepL (`DEEPL_API_KEY`) to translate and save it as a card. Key optional — when unset the translate+save endpoint returns a clear 502.

## Deployment

- **Local:** `docker-compose.yml` — exposes db/redis/backend/frontend ports for dev.
- **Self-hosted prod:** `docker-compose.prod.yml` — only frontend `:3000` is published; it proxies `/api` to the backend over the internal network. Backend command does `alembic upgrade head && python seed.py && uvicorn ... --workers 1`. Persists whisper model cache and podcast audio in named volumes.
- **Railway/Vercel:** backend on Railway (set `CORS_ORIGINS`), frontend on Vercel (set `BACKEND_URL`).

## Gotchas

- Pin `bcrypt==3.2.2` — bcrypt 4.x breaks passlib's `detect_wrap_bug`.
- Backend Dockerfile installs deps with `uv pip install --system` and needs `ffmpeg` (yt-dlp/whisper).
- Frontend Dockerfile uses `npm install` (no lockfile committed), not `npm ci`.
- `CORS_ORIGINS` is comma-separated in env, parsed to a list in [config.py](backend/app/config.py).
