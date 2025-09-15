from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.endpoints import router as chat_router
from app.models.chat import ChatRequest

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    yield
    print("Shutting down...")

app = FastAPI(
    title="Political AI Chatbot API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the chat router (creates /api/chat/* endpoints)
app.include_router(chat_router, prefix="/api")

# Also add direct endpoints for frontend compatibility
@app.post("/api/send_message")
async def send_message_direct(request: ChatRequest):
    from app.services.chat_service import ChatService
    try:
        response = await ChatService.process_message(request.message, request.session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/start_conversation")
async def start_conversation_direct(session_id: str = "default"):
    from app.services.chat_service import ChatService
    try:
        response = await ChatService.start_conversation(session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reset")
async def reset_conversation_direct(session_id: str = "default"):
    from app.services.chat_service import ChatService
    try:
        response = await ChatService.reset_conversation(session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Political AI Chatbot API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}