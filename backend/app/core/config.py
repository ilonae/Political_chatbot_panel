from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "Political AI Chatbot"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://frontend:3000"]
    OPENAI_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_api_key()
    
    def _validate_api_key(self):
        if not self.OPENAI_API_KEY or self.OPENAI_API_KEY.startswith("your-"):
            print(f"WARNING: Invalid OpenAI API key: {self.OPENAI_API_KEY}")
            print("Please set a valid OPENAI_API_KEY in your .env file")
            print("Get your API key from: https://platform.openai.com/account/api-keys")

settings = Settings()
