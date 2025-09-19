import io
import os
import logging
from typing import Literal
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ValidationError
from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError

from app.services.chat_service import ChatService
from app.models.chat import ChatRequest, ChatResponse, StartConversationRequest, StartConversationResponse, ResetResponse
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
try:
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY))
    if not client.api_key:
        logger.warning("OpenAI API key not configured")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    client = None

router = APIRouter(prefix="/chat", tags=["chat"])

class GenerateSpeechRequest(BaseModel):
    text: str
    language: str = "en"
    sender: str = "Debate Partner"

class ErrorResponse(BaseModel):
    error: str
    detail: str
    code: int

def handle_openai_error(error: Exception, operation: str) -> None:
    """Handle OpenAI-specific errors with appropriate logging and HTTP status codes."""
    if isinstance(error, RateLimitError):
        logger.warning(f"Rate limit exceeded during {operation}: {error}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OpenAI API rate limit exceeded. Please try again later."
        )
    elif isinstance(error, APIConnectionError):
        logger.error(f"OpenAI API connection error during {operation}: {error}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to OpenAI service. Please check your network connection."
        )
    elif isinstance(error, APIError):
        logger.error(f"OpenAI API error during {operation}: {error}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI API error: {error.message}"
        )
    else:
        logger.error(f"Unexpected error during {operation}: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during {operation}"
        )

@router.post("/message", response_model=ChatResponse, responses={
    500: {"model": ErrorResponse},
    400: {"model": ErrorResponse},
    422: {"model": ErrorResponse}
})
async def send_message(request: ChatRequest):
    try:
        logger.info(f"Received message: {request.message[:100]}...")
        logger.info(f"Language: {request.language}, Session ID: {request.session_id}")
        
        response = await ChatService.process_message(
            request.message, 
            request.session_id,
            request.language
        )
        
        logger.info(f"Successfully processed message. Response generated.")
        if response and hasattr(response, 'recommended_answers'):
            logger.debug(f"Recommended answers: {[ra.text for ra in response.recommended_answers]}")
        
        return response
        
    except ValidationError as e:
        logger.error(f"Validation error in send_message: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid request data: {e.errors()}"
        )
    except ValueError as e:
        logger.error(f"Value error in send_message: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in send_message: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your message."
        )

@router.post("/start", response_model=StartConversationResponse, responses={
    500: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
async def start_conversation(request: StartConversationRequest):
    try:
        logger.info(f"Starting conversation in language: {request.language}, Session ID: {request.session_id}")
        
        response = await ChatService.start_conversation(
            request.session_id,
            request.language
        )
        
        logger.info(f"Conversation started successfully.")
        if response and hasattr(response, 'recommended_answers'):
            logger.debug(f"Recommended answers: {[ra.text for ra in response.recommended_answers]}")
        
        return response
        
    except ValueError as e:
        logger.error(f"Value error in start_conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in start_conversation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while starting the conversation."
        )

@router.post("/reset", response_model=ResetResponse, responses={
    500: {"model": ErrorResponse},
    404: {"model": ErrorResponse}
})
async def reset_conversation(session_id: str = Query("default", description="Session ID")):
    try:
        logger.info(f"Resetting session: {session_id}")
        
        response = await ChatService.reset_conversation(session_id)
        
        if not response:
            logger.warning(f"Session not found for reset: {session_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
            
        logger.info(f"Session {session_id} reset successfully")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting conversation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while resetting the conversation."
        )

@router.post("/generate_recommendations", responses={
    500: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
async def generate_recommendations(
    user_input: str,
    conversation_history: str,
    session_id: str = "default",
    language: Literal['en', 'de'] = 'en'
):
    try:
        if not user_input.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User input cannot be empty"
            )
            
        logger.info(f"Generating recommendations for: {user_input[:50]}...")
        logger.info(f"Language: {language}, Session ID: {session_id}")
        
        recommended_answers = await ChatService._get_recommended_answers(
            user_input, session_id, language
        )
        
        logger.info(f"Successfully generated {len(recommended_answers)} recommendations")
        return {"recommended_answers": recommended_answers}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating recommendations."
        )

@router.post("/update_language", responses={
    500: {"model": ErrorResponse},
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
async def update_language(
    session_id: str = Query("default", description="Session ID"),
    language: Literal['en', 'de'] = Query('en', description="Language to switch to")
):
    try:
        logger.info(f"Updating language to {language} for session: {session_id}")
        
        success = await ChatService.update_language(session_id, language)
        
        if not success:
            logger.warning(f"Session not found for language update: {session_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
            
        logger.info(f"Language updated to {language} for session {session_id}")
        return {
            "status": "success", 
            "language": language, 
            "message": "Language updated successfully"
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating language: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the language."
        )

@router.post("/generate_speech", responses={
    500: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
async def generate_speech_endpoint(request: GenerateSpeechRequest):
    try:
        if not request.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty for speech generation"
            )
            
        if not client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI client not configured. Please check API key settings."
            )
            
        logger.info(f"Generating speech for text: {request.text[:50]}...")
        logger.info(f"Language: {request.language}, Sender: {request.sender}")
        
        # Map language to voice
        voice_mapping = {
            "Debate Partner": {"en": "onyx", "de": "onyx"},
            "You": {"en": "nova", "de": "nova"},
            "System": {"en": "alloy", "de": "alloy"},
            "default": {"en": "shimmer", "de": "shimmer"}
        }
        
        voice_info = voice_mapping.get(request.sender, voice_mapping["default"])
        voice = voice_info.get(request.language, "shimmer")
        
        # Generate speech using OpenAI TTS
        response = await client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=request.text,
            speed=1.0
        )
        
        audio_buffer = await response.aread()
        
        logger.info(f"Successfully generated speech for {len(request.text)} characters")
        
        return StreamingResponse(
            io.BytesIO(audio_buffer),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Content-Type": "audio/mpeg"
            }
        )
        
    except HTTPException:
        raise
    except (APIError, APIConnectionError, RateLimitError) as e:
        handle_openai_error(e, "speech generation")
    except Exception as e:
        logger.error(f"Unexpected error generating speech: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating speech."
        )

# Legacy endpoints with improved error handling
@router.post("/send_message", response_model=ChatResponse, include_in_schema=False)
async def send_message_alternative(request: ChatRequest):
    return await send_message(request)

@router.post("/start_conversation", response_model=StartConversationResponse, include_in_schema=False)
async def start_conversation_alternative(request: StartConversationRequest):
    return await start_conversation(request)

@router.get("/start_legacy", include_in_schema=False, responses={500: {"model": ErrorResponse}})
async def start_conversation_legacy(session_id: str = Query("default"), language: str = Query("en")):
    try:
        return await ChatService.start_conversation(session_id, language)
    except Exception as e:
        logger.error(f"Error in legacy start endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred."
        )

@router.get("/start_conversation_legacy", include_in_schema=False, responses={500: {"model": ErrorResponse}})
async def start_conversation_legacy2(session_id: str = Query("default"), language: str = Query("en")):
    try:
        return await ChatService.start_conversation(session_id, language)
    except Exception as e:
        logger.error(f"Error in legacy start endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred."
        )