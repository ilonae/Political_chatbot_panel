import os
from openai import AsyncOpenAI
from typing import Dict, List
from app.core.config import settings

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY))

class ChatService:
    _sessions: Dict[str, List[Dict]] = {}
    
    @classmethod
    async def process_message(cls, message: str, session_id: str = "default"):
        if session_id not in cls._sessions:
            await cls._initialize_session(session_id)
        
        cls._add_to_history(session_id, "user", message)
        response = await cls._get_ai_response(session_id)
        cls._add_to_history(session_id, "assistant", response)
        
        return {
            "response": response, 
            "session_id": session_id,
            "message_count": len([m for m in cls._sessions[session_id] if m["role"] == "user"])
        }
    
    @classmethod
    async def start_conversation(cls, session_id: str = "default"):
        await cls._initialize_session(session_id)
        opening_message = await cls._get_ai_response(session_id)
        cls._add_to_history(session_id, "assistant", opening_message)
        
        return {
            "opening_message": opening_message, 
            "session_id": session_id,
            "message_count": 1
        }
    
    @classmethod
    async def reset_conversation(cls, session_id: str = "default"):
        if session_id in cls._sessions:
            del cls._sessions[session_id]
        return {"status": "success", "session_id": session_id}
    
    @classmethod
    async def _initialize_session(cls, session_id: str):
        cls._sessions[session_id] = [
            {
                "role": "system", 
                "content": os.getenv("SYS_PROMPT_ENGLISH", "")
            }
        ]
    
    @classmethod
    def _add_to_history(cls, session_id: str, role: str, content: str):
        if session_id not in cls._sessions:
            cls._sessions[session_id] = []
        cls._sessions[session_id].append({"role": role, "content": content})
    
    @classmethod
    async def _get_ai_response(cls, session_id: str):
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=cls._sessions[session_id],
                temperature=0.9,
                max_tokens=1000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return "I apologize, but I'm experiencing technical difficulties. Please try again shortly."