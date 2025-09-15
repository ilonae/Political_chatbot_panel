from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    session_id: str = "default"

class StartConversationResponse(BaseModel):
    opening_message: str
    session_id: str
    message_count: int

class ResetResponse(BaseModel):
    status: str
    session_id: str