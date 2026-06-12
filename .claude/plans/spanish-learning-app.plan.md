# Plan: Spanish Learning Web App
**Date:** 2026-06-07  
**Complexity:** PRD + Sprint  
**Estimated phases:** 7  
**Total files to create:** ~45

---

## Architecture Decisions

### Cookie / CORS strategy
Next.js rewrites `/api/*` → `http://backend:8000/*` inside Docker (via `next.config.js`).
FastAPI sets `Set-Cookie: httponly; SameSite=Lax; Path=/` — same effective origin from the browser's perspective.
This avoids `SameSite=None; Secure` requirements and simplifies dev.

### FSRS implementation
Port from the reference **py-fsrs** algorithm (not ts-fsrs). The four parameters are:
`stability`, `difficulty`, `reps`, `lapses`, `state` (New/Learning/Review/Relearning).
Rating map: 1=Again, 2=Hard, 3=Good, 4=Easy.

### Redis
Declared in compose. Wired for streak/dashboard caching in `/stats/dashboard` only (TTL 5 min).

---

## Directory Structure

```
Language-web-app/
├── docker-compose.yml
├── .env.example
├── .env                        ← gitignored
├── Makefile
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_initial.py
│   ├── seed.py
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── word.py
│       │   ├── user_card.py
│       │   └── study_session.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── word.py
│       │   ├── study.py
│       │   └── stats.py
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── words.py
│       │   ├── study.py
│       │   └── stats.py
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   └── srs.py
│       └── dependencies.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx               ← redirect to /dashboard or /login
        │   ├── login/
        │   │   └── page.tsx
        │   ├── register/
        │   │   └── page.tsx
        │   ├── dashboard/
        │   │   └── page.tsx
        │   ├── study/
        │   │   └── page.tsx
        │   └── words/
        │       └── page.tsx
        ├── components/
        │   ├── FlashCard.tsx
        │   ├── RatingButtons.tsx
        │   ├── StreakBadge.tsx
        │   └── ProgressBar.tsx
        ├── lib/
        │   ├── api.ts
        │   └── auth.ts
        └── types/
            └── index.ts
```

---

## Phase 1 — Scaffold: Docker Compose, .env, Makefile

**Files:**
- [ ] `docker-compose.yml`
- [ ] `.env.example`
- [ ] `Makefile`

**`docker-compose.yml` services:**
```yaml
services:
  db:        postgres:16-alpine, volume pgdata, port 5432, healthcheck pg_isready
  redis:     redis:7-alpine, port 6379
  backend:   build ./backend, port 8000, depends_on db+redis (healthy), env_file .env
  frontend:  build ./frontend, port 3000, depends_on backend, env_file .env
networks:
  app-net (internal bridge)
```

**`.env.example`:**
```
DATABASE_URL=postgresql://postgres:postgres@db:5432/spanish_app
REDIS_URL=redis://redis:6379/0
JWT_SECRET=change_me_in_production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
NEXT_PUBLIC_API_URL=http://localhost:3000/api
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=spanish_app
```

**`Makefile` targets:**
- `make dev`     → `docker compose up --build`
- `make migrate` → `docker compose exec backend alembic upgrade head`
- `make seed`    → `docker compose exec backend python seed.py`
- `make logs`    → `docker compose logs -f`

**Validation:** `docker compose config` returns no errors. `make dev` starts all 4 containers.

---

## Phase 2 — Backend: Models, Database, Config

**Files:**
- [ ] `backend/requirements.txt`
- [ ] `backend/app/config.py`
- [ ] `backend/app/database.py`
- [ ] `backend/app/models/user.py`
- [ ] `backend/app/models/word.py`
- [ ] `backend/app/models/user_card.py`
- [ ] `backend/app/models/study_session.py`
- [ ] `backend/app/models/__init__.py`

**requirements.txt (pinned):**
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic-settings==2.2.1
redis==5.0.4
httpx==0.27.0
python-multipart==0.0.9
```

**Models (SQLAlchemy 2.0 mapped_column style):**

`User`: id UUID pk, email str unique, hashed_password str, created_at datetime, streak_count int default 0, last_study_date date nullable  
`Word`: id UUID pk, spanish str, english str, example_sentence str nullable, category str, cefr_level str, audio_url str nullable  
`UserCard`: id UUID pk, user_id FK User, word_id FK Word, due_date date, stability float default 0, difficulty float default 0, reps int default 0, lapses int default 0, state str default "new"  
`StudySession`: id UUID pk, user_id FK User, started_at datetime, ended_at datetime nullable, cards_reviewed int default 0, cards_correct int default 0  

**Validation:** `python -c "from app.models import *"` imports without error.

---

## Phase 3 — Alembic & Seed

**Files:**
- [ ] `backend/alembic.ini`
- [ ] `backend/alembic/env.py`
- [ ] `backend/alembic/versions/0001_initial.py`
- [ ] `backend/seed.py`

**Alembic `env.py`:** reads `DATABASE_URL` from env via `pydantic-settings`; imports `Base.metadata` from `app.models`; uses `run_migrations_online()` with `context.configure(connection, target_metadata=Base.metadata)`.

**`seed.py`:** 500 words across 8 categories (greetings×30, numbers×30, colours×20, common_verbs×100, food×80, travel×70, adjectives×80, body×90 — all A1/A2). Checks for existing data before inserting (idempotent). Prints `Seeded {n} words.`

**Validation:** `make migrate` runs without error. `make seed` prints `Seeded 500 words.`

---

## Phase 4 — Auth Routes & JWT Service

**Files:**
- [ ] `backend/app/dependencies.py`
- [ ] `backend/app/services/auth.py`
- [ ] `backend/app/schemas/auth.py`
- [ ] `backend/app/routers/auth.py`
- [ ] `backend/app/main.py` (partial — wire auth router)

**Auth service (`services/auth.py`):**
- `hash_password(plain)` → bcrypt hash via passlib
- `verify_password(plain, hashed)` → bool
- `create_access_token(data, expires_delta)` → JWT string
- `decode_token(token)` → payload dict or raises 401

**Dependencies (`dependencies.py`):**
- `get_db()` → SQLAlchemy session generator
- `get_current_user(request)` → reads cookie `access_token`, decodes JWT, returns User or 401

**Routes:**
- `POST /auth/register` → create User, return token in httpOnly cookie
- `POST /auth/login` → verify credentials, set cookie, return `{message: "ok"}`
- `POST /auth/logout` → delete cookie
- `GET  /auth/me` → return current user (email, streak_count, created_at)

**Cookie settings:** `httponly=True, samesite="lax", path="/", max_age=JWT_EXPIRE_MINUTES*60`

**Schemas (Pydantic v2):**
- `RegisterRequest`: email EmailStr, password str min_length=8
- `LoginRequest`: email EmailStr, password str
- `UserResponse`: id, email, streak_count, created_at

**Validation:** `curl -X POST localhost:8000/auth/register -d '{"email":"a@b.com","password":"12345678"}'` returns 200 with Set-Cookie header.

---

## Phase 5 — Words, Study & Stats Routes + FSRS

**Files:**
- [ ] `backend/app/services/srs.py`
- [ ] `backend/app/schemas/word.py`
- [ ] `backend/app/schemas/study.py`
- [ ] `backend/app/schemas/stats.py`
- [ ] `backend/app/routers/words.py`
- [ ] `backend/app/routers/study.py`
- [ ] `backend/app/routers/stats.py`
- [ ] `backend/app/main.py` (complete — wire all routers, CORS)

**FSRS service (`services/srs.py`):**
```python
# Core state machine ported from py-fsrs
STATES = Literal["new", "learning", "review", "relearning"]

def schedule(card: UserCard, rating: int, now: date) -> UserCard:
    """
    rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    Returns updated card with new due_date, stability, difficulty, reps, lapses, state.
    """
```
Algorithm constants (from FSRS-4.5):
- w = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.5330, 0.1544, 1.0071, 1.9395, 0.1100, 0.2900, 2.2700, 0.2500, 2.9898]
- Stability, difficulty, retrievability formulas per spec.

**Routes:**

`GET /words?category=&cefr_level=&page=1&size=20`  
→ paginated list of Word objects. No auth required.

`GET /study/due`  
→ authenticated; returns list of UserCard + Word for cards where `due_date <= today` and state != "new" (or initialises new cards for the user if none exist — takes up to 20 new words per day).

`POST /study/review`  
→ body: `{card_id: UUID, rating: 1|2|3|4}`  
→ runs `srs.schedule()`, updates UserCard, increments session counters if active session, returns updated card.

`POST /study/session`  
→ creates StudySession with `started_at=now`, returns session id.

`PATCH /study/session/{id}`  
→ sets `ended_at`, `cards_reviewed`, `cards_correct`.

`GET /stats/dashboard`  
→ returns: `{streak: int, total_learned: int, due_today: int, weekly_xp: int}`.  
→ Redis cache key `dashboard:{user_id}` TTL 300s.  
→ Updates `User.streak_count` based on `last_study_date` (increment if yesterday, reset if gap > 1 day, keep if today).

**CORS in `main.py`:**
```python
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])
```

**Validation:** `GET /study/due` with valid cookie returns array. `POST /study/review` with rating=3 returns card with updated `due_date` ~3 days ahead.

---

## Phase 6 — Frontend: Next.js 14 App Router

**Files:**
- [ ] `frontend/package.json`
- [ ] `frontend/tsconfig.json`
- [ ] `frontend/next.config.js`
- [ ] `frontend/tailwind.config.ts`
- [ ] `frontend/src/types/index.ts`
- [ ] `frontend/src/lib/api.ts`
- [ ] `frontend/src/lib/auth.ts`
- [ ] `frontend/src/app/layout.tsx`
- [ ] `frontend/src/app/page.tsx`
- [ ] `frontend/src/app/login/page.tsx`
- [ ] `frontend/src/app/register/page.tsx`
- [ ] `frontend/src/app/dashboard/page.tsx`
- [ ] `frontend/src/app/study/page.tsx`
- [ ] `frontend/src/app/words/page.tsx`
- [ ] `frontend/src/components/FlashCard.tsx`
- [ ] `frontend/src/components/RatingButtons.tsx`
- [ ] `frontend/src/components/StreakBadge.tsx`
- [ ] `frontend/src/components/ProgressBar.tsx`

**`next.config.js` rewrites:**
```js
rewrites: async () => [
  { source: '/api/:path*', destination: 'http://backend:8000/:path*' }
]
```
All API calls hit `/api/...` — no CORS, no exposed backend URL.

**`src/lib/api.ts`:**
Typed async functions for every endpoint. Uses `fetch` with `credentials: "include"` for cookie forwarding. Returns typed response or throws `ApiError`.

**`src/lib/auth.ts`:**
- `getMe()` — calls `/api/auth/me`, throws if 401
- `requireAuth()` — server component helper: redirect to `/login` if unauthenticated

**Pages:**

`/login`, `/register` — centred card, email+password form, error display, link between them.

`/dashboard` — server component; calls `getMe()` + `/api/stats/dashboard`.
- Top row: 🔥 streak badge, "Due Today" count, "Words Mastered" count
- Weekly progress bar (XP / 700 target)
- "Start Study" button → `/study`
- Responsive: 1-col mobile, 3-col desktop grid

`/study` — client component.
- Fetches `/api/study/due` on mount → queue of cards
- `FlashCard`: front=Spanish word + TTS button (Web Speech API), back=English + example sentence
- Flip: `[perspective-1000] [rotateY-180]` Tailwind 3D transform on click
- After flip: `RatingButtons` (Again/Hard/Good/Easy) → POST `/api/study/review` → next card
- Empty state: "All caught up! Come back tomorrow 🎉"

`/words` — paginated table/grid of vocabulary. Category + CEFR level filters. Responsive: card grid mobile, table desktop.

**FlashCard CSS (Tailwind + custom):**
```
.card-container: perspective-1000
.card: transition-transform duration-500 transform-style-preserve-3d
.card.flipped: rotateY(180deg)
.card-front, .card-back: backface-hidden absolute inset-0
.card-back: rotateY(180deg)
```

**TTS:**
```ts
const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  speechSynthesis.speak(u)
}
```

**Auth guard:** Dashboard, Study, Words pages call `requireAuth()` at top of server component — redirect to `/login` if `/api/auth/me` returns 401.

**Validation:** Load `/study` on mobile 375px, flip card, tap "Good", confirm next card loads. Load on 1440px desktop, confirm layout shifts to wider format.

---

## Phase 7 — Dockerfiles & Final Wiring

**Files:**
- [ ] `backend/Dockerfile`
- [ ] `frontend/Dockerfile`

**`backend/Dockerfile`:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**`frontend/Dockerfile`:**
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]
```

**Validation (end-to-end):**
1. `make dev` — all 4 containers healthy
2. `make migrate` — runs without error
3. `make seed` — prints `Seeded 500 words.`
4. Register at `localhost:3000/register`
5. Dashboard shows streak=0, due=20 (first 20 new words)
6. Study page: flip card, rate, confirm next card loads
7. Stats refresh after session

---

## Risk Notes

1. **FSRS stability formula:** If scheduling produces `due_date` in the past on first review, check the `new` card initialisation path — stability must be > 0 before first interval is computed.
2. **Cookie forwarding via Next.js proxy:** The rewrite passes the `Cookie` header through; ensure `fetch(..., { credentials: "include" })` is used on the client and `headers: { cookie: req.headers.get('cookie') }` is forwarded in server components.
3. **Alembic autogenerate:** Run `alembic revision --autogenerate` only after models are fully stable — schema changes after the initial migration require new revision files.
4. **`python-multipart`:** Required by FastAPI for form data even if using JSON — include in requirements.txt.

---

## Checklist Summary

### Phase 1 — Scaffold
- [ ] docker-compose.yml
- [ ] .env.example
- [ ] Makefile

### Phase 2 — Backend Models
- [ ] requirements.txt
- [ ] config.py, database.py
- [ ] 4 SQLAlchemy models

### Phase 3 — Alembic & Seed
- [ ] alembic.ini + env.py
- [ ] 0001_initial.py migration
- [ ] seed.py (500 words)

### Phase 4 — Auth
- [ ] services/auth.py
- [ ] dependencies.py
- [ ] schemas/auth.py
- [ ] routers/auth.py

### Phase 5 — API Routes + FSRS
- [ ] services/srs.py (FSRS-4.5)
- [ ] schemas: word, study, stats
- [ ] routers: words, study, stats
- [ ] main.py (complete with CORS)

### Phase 6 — Frontend
- [ ] Next.js project files (config, tailwind, tsconfig)
- [ ] types/index.ts
- [ ] lib/api.ts + lib/auth.ts
- [ ] 5 pages (layout, root, login, register, dashboard, study, words)
- [ ] 4 components (FlashCard, RatingButtons, StreakBadge, ProgressBar)

### Phase 7 — Dockerfiles
- [ ] backend/Dockerfile
- [ ] frontend/Dockerfile
