import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import anthropic, os
from dotenv import load_dotenv
from anthropic import APIError, APIConnectionError, RateLimitError

from app.core.config import settings
from app.api.endpoints import router as chat_router
from app.models.chat import ChatRequest, StartConversationRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)
logger.info(f"Loaded environment from {env_path}")

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

        # Initialize Anthropic client on startup
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
    try:
        app = FastAPI(
            title="Political AI Chatbot API",
            description="API for a political debate chatbot powered by Anthropic Claude",
            version="2.0.0",
            lifespan=lifespan,
            docs_url="/docs" if settings.is_development() else None,
            redoc_url="/redoc" if settings.is_development() else None,
        )

        origins = settings.get_cors_origins_list()
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["*"]
        )

        app.include_router(chat_router, prefix="/api")

        register_exception_handlers(app)
        register_middleware(app)

        logger.info("FastAPI application created successfully")
        return app

    except Exception as e:
        logger.critical(f"Failed to create FastAPI application: {e}", exc_info=True)
        raise


def register_exception_handlers(app: FastAPI):
    """Register global exception handlers."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error for {request.url}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation Error",
                "detail": exc.errors(),
                "path": request.url.path
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(f"HTTP error {exc.status_code} for {request.url}: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP Error",
                "detail": exc.detail,
                "status_code": exc.status_code,
                "path": request.url.path
            },
        )

    @app.exception_handler(APIError)
    async def anthropic_api_exception_handler(request: Request, exc: APIError):
        logger.error(f"Anthropic API error for {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": "Anthropic Service Error",
                "detail": "External AI service is experiencing issues",
                "path": request.url.path
            },
        )

    @app.exception_handler(APIConnectionError)
    async def anthropic_connection_exception_handler(request: Request, exc: APIConnectionError):
        logger.error(f"Anthropic connection error for {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "Anthropic Connection Error",
                "detail": "Cannot connect to AI service",
                "path": request.url.path
            },
        )

    @app.exception_handler(RateLimitError)
    async def anthropic_rate_limit_exception_handler(request: Request, exc: RateLimitError):
        logger.warning(f"Anthropic rate limit exceeded for {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate Limit Exceeded",
                "detail": "AI service rate limit exceeded. Please try again later.",
                "path": request.url.path
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception for {request.url}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred" if settings.is_production() else str(exc),
                "path": request.url.path
            },
        )


def register_middleware(app: FastAPI):
    """Register application middleware."""

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(
                f"{request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s"
            )
            response.headers["X-Process-Time"] = str(process_time)
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"{request.method} {request.url.path} - "
                f"Error: {e} - "
                f"Time: {process_time:.3f}s"
            )
            raise


# Create the application instance
app = create_app()


@app.get("/test/anthropic")
async def test_anthropic():
    """Test if the Anthropic client initializes correctly."""
    from app.services.chat_service import initialize_async_anthropic_client
    if await initialize_async_anthropic_client():
        return {"status": "success", "message": "AsyncAnthropic client initialized"}
    return {"status": "error", "message": "AsyncAnthropic client failed to initialize"}


@app.get("/test/chat")
async def test_chat():
    """Quick smoke-test of the chat functionality."""
    from app.services.chat_service import ChatService
    try:
        response = await ChatService.process_message("Hello, how are you?", "test", "en")
        return {"status": "success", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/send_message")
async def send_message_direct(request: ChatRequest):
    """Direct endpoint for sending messages."""
    from app.services.chat_service import ChatService
    try:
        logger.info(f"Processing message for session {request.session_id}")
        return await ChatService.process_message(
            request.message,
            request.session_id,
            request.language
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in send_message_direct: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process message")


@app.post("/api/start_conversation")
async def start_conversation_direct(request: StartConversationRequest):
    """Direct endpoint for starting conversations."""
    from app.services.chat_service import ChatService
    try:
        logger.info(f"Starting conversation for session {request.session_id}")
        return await ChatService.start_conversation(request.session_id, request.language)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in start_conversation_direct: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to start conversation")


@app.post("/chat/reset")
async def chat_reset_direct(session_id: str = "default"):
    from app.services.chat_service import ChatService
    try:
        return await ChatService.reset_conversation(session_id)
    except Exception as e:
        logger.error(f"Error in chat_reset_direct: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reset conversation")


@app.post("/chat/message")
async def chat_message_direct(request: ChatRequest):
    return await send_message_direct(request)


@app.post("/chat/start")
async def chat_start_direct(request: StartConversationRequest):
    return await start_conversation_direct(request)


@app.get("/test")
async def test_endpoint():
    return {"message": "Backend is working!", "timestamp": time.time()}


@app.options("/api/{rest_of_path:path}")
async def preflight_handler():
    return JSONResponse(status_code=200)


@app.get("/")
async def root():
    return {
        "message": "Political AI Chatbot API",
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy" if app_state.get("healthy", False) else "unhealthy",
        "ready": app_state.get("ready", False),
        "timestamp": time.time(),
        "uptime": time.time() - app_state.get("startup_time", 0) if app_state.get("startup_time") else 0,
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT
    }

    components = {
        "anthropic": bool(settings.ANTHROPIC_API_KEY and not settings.ANTHROPIC_API_KEY.startswith("your-")),
        "configuration": settings.validate_for_usage(),
        "memory": True,
    }
    health_status["components"] = components

    if not all(components.values()):
        health_status["status"] = "degraded"

    if app_state.get("shutting_down", False):
        health_status["status"] = "shutting_down"

    status_code = status.HTTP_200_OK if health_status["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/ready")
async def readiness_check():
    if app_state.get("ready", False):
        return JSONResponse(content={"status": "ready"}, status_code=status.HTTP_200_OK)
    return JSONResponse(
        content={"status": "not ready", "reason": "Application starting up or shutting down"},
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE
    )


@app.get("/info")
async def app_info():
    return {
        "name": settings.PROJECT_NAME,
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "cors_origins": settings.CORS_ORIGINS,
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY and not settings.ANTHROPIC_API_KEY.startswith("your-")),
        "host": settings.API_HOST,
        "port": settings.API_PORT
    }


@app.get("/config")
async def config_summary():
    return {
        "project_name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "cors_origins": settings.CORS_ORIGINS,
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY and not settings.ANTHROPIC_API_KEY.startswith("your-")),
        "ai_timeout": settings.AI_TIMEOUT,
        "ai_max_retries": settings.AI_MAX_RETRIES,
        "anthropic_model": settings.ANTHROPIC_MODEL,
    }
