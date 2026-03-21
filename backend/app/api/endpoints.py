import logging
from typing import Literal
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError
from app.services.chat_service import ChatService
from app.models.chat import ChatRequest, ChatResponse, StartConversationRequest, StartConversationResponse, ResetResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ErrorResponse(BaseModel):
    error: str
    detail: str
    code: int




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

        logger.info("Successfully processed message.")
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


@router.post("/message/stream")
async def send_message_stream(request: ChatRequest):
    """Stream the AI response token by token as Server-Sent Events."""
    return StreamingResponse(
        ChatService.stream_message(request.message, request.session_id, request.language),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
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

        logger.info("Conversation started successfully.")
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )

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


