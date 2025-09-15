from pydantic import BaseModel
from typing import Optional, Literal

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    language: Literal['en', 'de'] = 'en'  # Add language field

class ChatResponse(BaseModel):
    response: str
    session_id: str = "default"
    message_count: int
    language: Literal['en', 'de'] = 'en'  # Add language field

class StartConversationRequest(BaseModel):
    session_id: str = "default"
    language: Literal['en', 'de'] = 'en'  # Add language field

class StartConversationResponse(BaseModel):
    opening_message: str
    session_id: str
    message_count: int
    language: Literal['en', 'de'] = 'en'  # Add language field

class ResetResponse(BaseModel):
    status: str
    session_id: str