from typing import Literal
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
        print(f"Recommended answers: {[ra.text for ra in response['recommended_answers']]}")
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
        print(f"Recommended answers: {[ra.text for ra in response['recommended_answers']]}")
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

@router.post("/generate_recommendations")
async def generate_recommendations(
    user_input: str,
    conversation_history: str,
    session_id: str = "default",
    language: Literal['en', 'de'] = 'en'
):
    try:
        print(f"Generating recommendations for: {user_input}")
        print(f"Language: {language}")
        
        recommended_answers = await ChatService._get_recommended_answers(
            user_input, session_id, language
        )
        
        return {"recommended_answers": recommended_answers}
        
    except Exception as e:
        print(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/update_language")
async def update_language(
    session_id: str = Query("default", description="Session ID"),
    language: Literal['en', 'de'] = Query('en', description="Language to switch to")
):
    try:
        print(f"Updating language to {language} for session: {session_id}")
        
        # Update the language in the chat service
        success = await ChatService.update_language(session_id, language)
        
        if success:
            return {"status": "success", "language": language, "message": "Language updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except Exception as e:
        print(f"Error updating language: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))