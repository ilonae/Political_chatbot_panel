from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import JSONResponse

from app.services.chat_service import ChatService
from app.models.chat import ChatRequest, ChatResponse, StartConversationResponse, ResetResponse

router = APIRouter(prefix="/chat", tags=["chat"])

# New endpoints with /api/chat/ prefix
@router.post("/send_message", response_model=ChatResponse)
async def send_message_new(request: ChatRequest):
    try:
        response = await ChatService.process_message(request.message, request.session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/start_conversation", response_model=StartConversationResponse)
async def start_conversation_new(session_id: str = Query("default", description="Session ID")):
    try:
        response = await ChatService.start_conversation(session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset", response_model=ResetResponse)
async def reset_conversation_new(session_id: str = Query("default", description="Session ID")):
    try:
        response = await ChatService.reset_conversation(session_id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoints for frontend compatibility (without /chat/ prefix)
@router.post("/send_message", include_in_schema=False)
async def send_message_legacy(request: ChatRequest):
    return await send_message_new(request)

@router.get("/start_conversation", include_in_schema=False)
async def start_conversation_legacy(session_id: str = Query("default")):
    return await start_conversation_new(session_id)

@router.post("/reset", include_in_schema=False)
async def reset_conversation_legacy(session_id: str = Query("default")):
    return await reset_conversation_new(session_id)