from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, stats, study, words

app = FastAPI(title="Spanish Learning API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(words.router)
app.include_router(study.router)
app.include_router(stats.router)


@app.get("/health")
def health():
    return {"status": "ok"}
