from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "Political AI Chatbot"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://frontend:3000"]
    
    # OpenAI
    OPENAI_API_KEY: str = "your-openai-api-key"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()