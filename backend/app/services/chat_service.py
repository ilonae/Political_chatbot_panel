import os
from openai import AsyncOpenAI
from typing import Dict, List, Literal
from app.core.config import settings

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY))

class ChatService:
    _sessions: Dict[str, List[Dict]] = {}
    _session_languages: Dict[str, Literal['en', 'de']] = {} 
    
    
    @classmethod
    async def process_message(cls, message: str, session_id: str = "default", language: Literal['en', 'de'] = 'en'):
        if session_id not in cls._sessions:
            await cls._initialize_session(session_id, language)
        else:
            cls._session_languages[session_id] = language
        
        cls._add_to_history(session_id, "user", message)
        response = await cls._get_ai_response(session_id, language)
        cls._add_to_history(session_id, "assistant", response)
        
        return {
            "responses": [{
                "sender": "Debate Partner",
                "message": response,
                "type": "partner"
            }],
            "session_id": session_id,
            "message_count": len([m for m in cls._sessions[session_id] if m["role"] == "user"]),
            "topic": "Current Debate Topic",  # Add this field
            "language": language
        }

    @classmethod
    async def start_conversation(cls, session_id: str = "default", language: Literal['en', 'de'] = 'en'):
        await cls._initialize_session(session_id, language)
        opening_message = await cls._get_ai_response(session_id, language)
        cls._add_to_history(session_id, "assistant", opening_message)
        
        # Return format that frontend expects
        return {
            "opening_message": opening_message,
            "session_id": session_id,
            "message_count": 1,
            "topic": "Political ideologies and perspectives",  # Add topic
            "language": language
        }
    
    @classmethod
    async def reset_conversation(cls, session_id: str = "default"):
        if session_id in cls._sessions:
            del cls._sessions[session_id]
        if session_id in cls._session_languages:
            del cls._session_languages[session_id]
        return {"status": "success", "session_id": session_id}
    
    @classmethod
    async def _initialize_session(cls, session_id: str, language: Literal['en', 'de'] = 'en'):
        cls._session_languages[session_id] = language
        
        # Different system prompts based on language
        if language == 'de':
            system_prompt = os.getenv("SYS_PROMPT_GERMAN", "")
        else:
            system_prompt = os.getenv("SYS_PROMPT_ENGLISH", "")
        
        cls._sessions[session_id] = [
            {
                "role": "system", 
                "content": system_prompt
            }
        ]
    
    @classmethod
    def _add_to_history(cls, session_id: str, role: str, content: str):
        if session_id not in cls._sessions:
            cls._sessions[session_id] = []
        cls._sessions[session_id].append({"role": role, "content": content})
    
    @classmethod
    async def _get_ai_response(cls, session_id: str, language: Literal['en', 'de'] = 'en'):
        try:

            language_instruction = {
                "role": "system",
                "content": f"Respond in {language.upper()} language only. Keep the response natural and in character."
            }
            
            temp_messages = cls._sessions[session_id] + [language_instruction]
            
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=temp_messages,
                temperature=0.9,
                max_tokens=1000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            if language == 'de':
                return "Ich entschuldige mich, aber ich habe derzeit technische Schwierigkeiten. Bitte versuchen Sie es später erneut."
            else:
                return "I apologize, but I'm experiencing technical difficulties. Please try again shortly."