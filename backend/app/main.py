import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from openai import APIError, APIConnectionError, RateLimitError

from app.core.config import settings
from app.api.endpoints import router as chat_router
from app.models.chat import ChatRequest, StartConversationRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variable to track application state
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager with proper error handling."""
    startup_time = time.time()
    try:
        logger.info("Starting up Political AI Chatbot API...")
        
        # Initialize application state
        app_state.update({
            "startup_time": startup_time,
            "healthy": True,
            "ready": False,
            "shutting_down": False
        })
        
        # Validate configuration before starting
        if not settings.validate_for_usage():
            logger.warning("Configuration validation warnings detected during startup")
        
        # Additional startup initialization can go here
        logger.info("Application starting up successfully")
        app_state["ready"] = True
        
        yield
        
    except Exception as e:
        logger.critical(f"Startup failed: {e}", exc_info=True)
        app_state["healthy"] = False
        app_state["ready"] = False
        raise
        
    finally:
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
    """Create and configure the FastAPI application with proper error handling."""
    try:
        app = FastAPI(
            title="Political AI Chatbot API",
            description="API for political debate chatbot with Hans-Thomas Tillschneider persona",
            version="1.0.0",
            lifespan=lifespan,
            docs_url="/docs" if settings.is_development() else None,
            redoc_url="/redoc" if settings.is_development() else None,
        )
        
        # Configure CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["*"]
        )
        
        # Include API router
        app.include_router(chat_router, prefix="/api")
        
        # Register exception handlers
        register_exception_handlers(app)
        
        # Register middleware
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
        """Handle request validation errors."""
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
        """Handle HTTP exceptions."""
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
    async def openai_api_exception_handler(request: Request, exc: APIError):
        """Handle OpenAI API errors."""
        logger.error(f"OpenAI API error for {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": "OpenAI Service Error",
                "detail": "External AI service is experiencing issues",
                "path": request.url.path
            },
        )
    
    @app.exception_handler(APIConnectionError)
    async def openai_connection_exception_handler(request: Request, exc: APIConnectionError):
        """Handle OpenAI connection errors."""
        logger.error(f"OpenAI connection error for {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "OpenAI Connection Error",
                "detail": "Cannot connect to AI service",
                "path": request.url.path
            },
        )
    
    @app.exception_handler(RateLimitError)
    async def openai_rate_limit_exception_handler(request: Request, exc: RateLimitError):
        """Handle OpenAI rate limit errors."""
        logger.warning(f"OpenAI rate limit exceeded for {request.url}: {exc}")
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
        """Handle all other exceptions."""
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
        """Middleware to log all requests."""
        start_time = time.time()
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            logger.info(
                f"{request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s"
            )
            
            # Add response time header
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

# Direct endpoint handlers with improved error handling
@app.post("/api/send_message")
async def send_message_direct(request: ChatRequest):
    """Direct endpoint for sending messages."""
    from app.services.chat_service import ChatService
    
    try:
        logger.info(f"Processing message for session {request.session_id}")
        response = await ChatService.process_message(
            request.message, 
            request.session_id,
            request.language
        )
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error in send_message_direct: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in send_message_direct: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process message"
        )

@app.post("/api/start_conversation") 
async def start_conversation_direct(request: StartConversationRequest):
    """Direct endpoint for starting conversations."""
    from app.services.chat_service import ChatService
    
    try:
        logger.info(f"Starting conversation for session {request.session_id}")
        response = await ChatService.start_conversation(
            request.session_id,
            request.language
        )
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error in start_conversation_direct: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in start_conversation_direct: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start conversation"
        )

@app.post("/chat/reset")
async def chat_reset_direct(session_id: str = "default"):
    """Direct endpoint for resetting conversations."""
    from app.services.chat_service import ChatService
    
    try:
        logger.info(f"Resetting conversation for session {session_id}")
        response = await ChatService.reset_conversation(session_id)
        return response
        
    except Exception as e:
        logger.error(f"Error in chat_reset_direct: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset conversation"
        )

@app.post("/chat/message")
async def chat_message_direct(request: ChatRequest):
    """Legacy endpoint for chat messages."""
    return await send_message_direct(request)

@app.post("/chat/start")
async def chat_start_direct(request: StartConversationRequest):
    """Legacy endpoint for starting chat."""
    return await start_conversation_direct(request)

@app.get("/")
async def root():
    """Root endpoint with application information."""
    return {
        "message": "Political AI Chatbot API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    health_status = {
        "status": "healthy" if app_state.get("healthy", False) else "unhealthy",
        "ready": app_state.get("ready", False),
        "timestamp": time.time(),
        "uptime": time.time() - app_state.get("startup_time", 0) if app_state.get("startup_time") else 0,
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }
    
    # Add component health checks
    components = {
        "openai": bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your-")),
        "configuration": settings.validate_for_usage(),
        "memory": True,  # Placeholder for memory health check
    }
    
    health_status["components"] = components
    
    # Determine overall status based on components
    if not all(components.values()):
        health_status["status"] = "degraded"
    
    if app_state.get("shutting_down", False):
        health_status["status"] = "shutting_down"
    
    status_code = status.HTTP_200_OK if health_status["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return JSONResponse(content=health_status, status_code=status_code)

@app.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes and load balancers."""
    if app_state.get("ready", False):
        return JSONResponse(content={"status": "ready"}, status_code=status.HTTP_200_OK)
    else:
        return JSONResponse(
            content={"status": "not ready", "reason": "Application starting up or shutting down"},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )

# Additional utility endpoints
@app.get("/info")
async def app_info():
    """Get application information and configuration summary."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "cors_origins": settings.CORS_ORIGINS,
        "openai_configured": bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your-")),
        "host": settings.API_HOST,
        "port": settings.API_PORT
    }

@app.get("/config")
async def config_summary():
    """Get configuration summary (excludes sensitive data)."""
    return {
        "project_name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "cors_origins": settings.CORS_ORIGINS,
        "openai_configured": bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your-")),
        "openai_timeout": settings.OPENAI_TIMEOUT,
        "openai_max_retries": settings.OPENAI_MAX_RETRIES
    }