from langchain.memory import ConversationSummaryBufferMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
import os
from app.core.config import settings

class ChatService:
    _sessions = {}  # In-memory session storage
    
    @classmethod
    async def process_message(cls, message: str, session_id: str = "default"):
        # Your existing chatbot logic here
        bot = cls._get_bot_session(session_id)
        response = bot.respond(message)
        return {"response": response}
    
    @classmethod
    async def start_conversation(cls, session_id: str = "default"):
        bot = cls._get_bot_session(session_id)
        opening_message = bot.respond("SYSTEM: Start the conversation with a provocative political question")
        return {"opening_message": opening_message}
    
    @classmethod
    async def reset_conversation(cls, session_id: str = "default"):
        if session_id in cls._sessions:
            del cls._sessions[session_id]
        return {"status": "success"}
    
    @classmethod
    def _get_bot_session(cls, session_id: str):
        if session_id not in cls._sessions:
            cls._sessions[session_id] = DiscussionBot(
                "Debate Partner",
                system_prompt="Your system prompt here"
            )
        return cls._sessions[session_id]

# Your existing DiscussionBot class
class DiscussionBot:
    def __init__(self, name, system_prompt):
        self.name = name
        self.llm = ChatOpenAI(
            temperature=0.9,
            api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY),
            model="gpt-3.5-turbo",
        )
        self.memory = ConversationSummaryBufferMemory(
            llm=self.llm,
            max_token_limit=2000,
            return_messages=True,
            memory_key="history"
        )
        # ... rest of your existing bot code