import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import os
from dotenv import load_dotenv

from app.core.config import settings
from app.api.endpoints import router as chat_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

app_state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager with proper error handling."""
    startup_time = time.time()
    try:
        logger.info("Starting up Political AI Chatbot API...")
        app_state.update({
            "startup_time": startup_time,
            "healthy": True,
            "ready": False,
            "shutting_down": False
        })

        from app.services.chat_service import startup_event
        await startup_event()

        if not settings.validate_for_usage():
            logger.warning("Configuration validation warnings detected during startup")

        logger.info("Application started successfully")
        app_state["ready"] = True
        yield

    except Exception as e:
        logger.critical(f"Startup failed: {e}", exc_info=True)
        app_state["healthy"] = False
        app_state["ready"] = False
        raise

    finally:
        from app.services.chat_service import shutdown_event
        await shutdown_event()
        shutdown_time = time.time()
        app_state.update({
            "shutting_down": True,
            "healthy": False,
            "ready": False,
            "shutdown_time": shutdown_time,
            "uptime": shutdown_time - startup_time
        })
        logger.info("Shutting down Political AI Chatbot API...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Political AI Chatbot API",
        description="API for a political debate chatbot powered by local Ollama models",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

    app.include_router(chat_router, prefix="/api")

    # ── Exception handlers ──────────────────────────────────────

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error for {request.url}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Validation Error", "detail": exc.errors()},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "HTTP Error", "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception for {request.url}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Internal Server Error", "detail": str(exc)},
        )

    # ── Request logging middleware ───────────────────────────────

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(
            f"{request.method} {request.url.path} "
            f"→ {response.status_code} ({process_time:.3f}s)"
        )
        response.headers["X-Process-Time"] = str(process_time)
        return response

    logger.info("FastAPI application created successfully")
    return app


# ── App instance ─────────────────────────────────────────────────

app = create_app()


# ── Health / status endpoints ────────────────────────────────────

@app.get("/health")
async def health_check():
    components = {
        "ollama_configured": bool(settings.OLLAMA_HOST and settings.OLLAMA_MODEL),
        "configuration": settings.validate_for_usage(),
    }
    overall = "healthy" if app_state.get("healthy") and all(components.values()) else "degraded"
    if app_state.get("shutting_down"):
        overall = "shutting_down"

    # Always return 200 so Docker healthcheck doesn't kill the container.
    # The body tells you the actual state.
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": overall,
            "ready": app_state.get("ready", False),
            "uptime": time.time() - app_state.get("startup_time", time.time()),
            "version": "2.0.0",
            "components": components,
        }
    )


@app.get("/ready")
async def readiness_check():
    if app_state.get("ready"):
        return JSONResponse({"status": "ready"}, status_code=200)
    return JSONResponse({"status": "not ready"}, status_code=503)


@app.get("/")
async def root():
    return {"message": "Political AI Chatbot API", "version": "2.0.0", "docs": "/docs"}
