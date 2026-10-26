from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.api import analytics, auth, knowledge, system, tickets
from app.config import get_settings
from app.db import SessionLocal
from app.llm.providers import LLMError
from app.migrations import upgrade_db
from app.rag.ingest import refresh_index
from app.seed import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("supportiq")


_init_lock = threading.Lock()
_ready = False


def ensure_initialized() -> None:
    """Migrate, seed and build the index once per process. Called from the lifespan hook and
    again lazily on the first request, for serverless runtimes that skip lifespan events."""
    global _ready
    if _ready:
        return
    with _init_lock:
        if _ready:
            return
        s = get_settings()
        if s.environment == "production" and not s.jwt_secret:
            raise RuntimeError("JWT_SECRET must be set in production")
        upgrade_db()
        with SessionLocal() as db:
            if s.seed_on_startup:
                seed(db)
            refresh_index(db)
        _ready = True
        log.info("SupportIQ API ready")


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_initialized()
    yield


app = FastAPI(title="SupportIQ API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    # Logs method, path and timing only: no bodies, cookies, query strings or headers.
    t0 = time.monotonic()
    if not _ready and request.url.path != "/api/health":
        await run_in_threadpool(ensure_initialized)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    log.info("%s %s -> %s (%dms)", request.method, request.url.path, response.status_code, (time.monotonic() - t0) * 1000)
    return response


@app.exception_handler(LLMError)
async def llm_error(_: Request, exc: LLMError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": f"The language model is unavailable right now: {exc}. Try again shortly."})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    msg = f"{field}: {first.get('msg', 'invalid input')}" if field else first.get("msg", "Invalid input")
    return JSONResponse(status_code=422, content={"detail": msg})


for r in (auth.router, tickets.router, knowledge.router, analytics.router, system.router):
    app.include_router(r)
