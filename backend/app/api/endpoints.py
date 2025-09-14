from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.services.chat_service import ChatService
from app.models.chat import ChatRequest, ChatResponse

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    try:
        response = await ChatService.process_message(request.message)
        return JSONResponse(content=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/start_conversation")
async def start_conversation():
    try:
        response = await ChatService.start_conversation()
        return JSONResponse(content=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset")
async def reset_conversation():
    try:
        response = await ChatService.reset_conversation()
        return JSONResponse(content=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))