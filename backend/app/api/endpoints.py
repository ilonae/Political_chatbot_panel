from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.services.chat_service import ChatService
from app.models.chat import ChatRequest, ChatResponse, StartConversationRequest, StartConversationResponse, ResetResponse

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    try:
        print(f"Received message: {request.message}")
        print(f"Language: {request.language}")
        print(f"Session ID: {request.session_id}")
        
        response = await ChatService.process_message(
            request.message, 
            request.session_id,
            request.language
        )
        
        print(f"Sending response: {response}")
        return response
        
    except Exception as e:
        print(f"Error in send_message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start", response_model=StartConversationResponse) 
async def start_conversation(request: StartConversationRequest):
    try:
        print(f"Starting conversation in language: {request.language}")
        response = await ChatService.start_conversation(
            request.session_id,
            request.language
        )
        print(f"Opening message: {response['opening_message']}")
        return response
    except Exception as e:
        print(f"Error in start_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset", response_model=ResetResponse)
async def reset_conversation(session_id: str = Query("default", description="Session ID")):
    try:
        print(f"Resetting session: {session_id}")
        response = await ChatService.reset_conversation(session_id)
        return response
    except Exception as e:
        print(f"Error in reset: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send_message", response_model=ChatResponse, include_in_schema=False)
async def send_message_alternative(request: ChatRequest):
    return await send_message(request)

@router.post("/start_conversation", response_model=StartConversationResponse, include_in_schema=False)
async def start_conversation_alternative(request: StartConversationRequest):
    return await start_conversation(request)

@router.get("/start_legacy", include_in_schema=False)
async def start_conversation_legacy(session_id: str = Query("default"), language: str = Query("en")):
    return await ChatService.start_conversation(session_id, language)

@router.get("/start_conversation_legacy", include_in_schema=False)
async def start_conversation_legacy2(session_id: str = Query("default"), language: str = Query("en")):
    return await ChatService.start_conversation(session_id, language)