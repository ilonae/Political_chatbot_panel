from pydantic import BaseModel
from typing import Literal, List

class RecommendedAnswer(BaseModel):
    text: str
    id: str

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    language: Literal['en', 'de'] = 'en' 

class ChatResponse(BaseModel):
    response: str
    session_id: str = "default"
    message_count: int
    language: Literal['en', 'de'] = 'en' 
    recommended_answers: List[RecommendedAnswer] = []  

class StartConversationRequest(BaseModel):
    session_id: str = "default"
    language: Literal['en', 'de'] = 'en' 

class StartConversationResponse(BaseModel):
    opening_message: str
    session_id: str
    message_count: int
    language: Literal['en', 'de'] = 'en'
    recommended_answers: List[RecommendedAnswer] = []  

class ResetResponse(BaseModel):
    status: str
    session_id: str