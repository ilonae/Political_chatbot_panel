import os
import logging
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, validator, ValidationError
from dotenv import load_dotenv


logger = logging.getLogger(__name__)

try:
    # Load from root directory (one level up from backend)
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(env_path)
    logger.info(f"Successfully loaded .env file from {env_path}")
except Exception as e:
    logger.warning(f"Failed to load .env file: {e}. Using system environment variables.")

class Settings(BaseSettings):
    PROJECT_NAME: str = Field(
        default="Political AI Chatbot",
        description="Name of the project for logging and identification"
    )

    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://frontend:3000",
        description="Comma-separated list of allowed CORS origins"
    )

    # Anthropic API key (replaces OPENAI_API_KEY)
    ANTHROPIC_API_KEY: str = Field(
        default="",
        description="Anthropic API key for Claude models"
    )

    # System prompts — store these in your .env file, never commit them
    SYS_PROMPT_GERMAN: str = Field(
        default="",
        description="German system prompt for the chatbot persona",
        min_length=1
    )

    SYS_PROMPT_ENGLISH: str = Field(
        default="",
        description="English system prompt for the chatbot persona",
        min_length=1
    )

    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment (development, staging, production)",
        pattern="^(development|staging|production)$"
    )

    API_HOST: str = Field(
        default="0.0.0.0",
        description="Host address for the API server"
    )

    API_PORT: int = Field(
        default=5000,
        description="Port for the API server",
        ge=1,
        le=65535
    )

    AI_TIMEOUT: int = Field(
        default=30,
        description="Timeout in seconds for Anthropic API calls",
        ge=1,
        le=120
    )

    AI_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum number of retries for Anthropic API calls",
        ge=0,
        le=10
    )

    # Anthropic model to use — claude-haiku is fast and cheap; swap to claude-sonnet-4-6 for higher quality
    ANTHROPIC_MODEL: str = Field(
        default="claude-haiku-4-5-20251001",
        description="Anthropic model identifier"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

    @validator("ANTHROPIC_API_KEY", pre=True, always=True)
    def validate_api_key(cls, v):
        """Validate Anthropic API key format."""
        if not v:
            logger.warning("ANTHROPIC_API_KEY is not set")
            return v

        if v.startswith("your-") or "example" in v.lower():
            logger.error(f"Invalid Anthropic API key format: {v}")
            raise ValueError("ANTHROPIC_API_KEY appears to be a placeholder. Please set a valid key.")

        if not v.startswith("sk-ant-"):
            logger.warning(f"ANTHROPIC_API_KEY doesn't start with 'sk-ant-' prefix — double-check it is correct.")

        return v

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, list):
            return ",".join(v)
        return v

    def __init__(self, **kwargs):
        """Initialize settings with enhanced error handling."""
        try:
            super().__init__(**kwargs)
            self._post_init_validation()

        except ValidationError as e:
            logger.error(f"Configuration validation failed: {e}")
            errors = []
            for error in e.errors():
                field = error['loc'][0]
                msg = error['msg']
                errors.append(f"{field}: {msg}")

            error_message = "Configuration validation failed:\n" + "\n".join(errors)
            logger.critical(error_message)
            raise

        except Exception as e:
            logger.critical(f"Unexpected error during configuration initialization: {e}")
            raise

    def get_cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def _post_init_validation(self):
        """Perform additional validation after initialization."""
        if self.ENVIRONMENT == "production" and not self.ANTHROPIC_API_KEY:
            logger.critical("Production environment requires a valid ANTHROPIC_API_KEY")
            raise ValueError("ANTHROPIC_API_KEY is required in production environment")

        if self.ENVIRONMENT == "production":
            self._validate_production_cors()

        logger.info(f"Configuration loaded successfully for {self.ENVIRONMENT} environment")

    def _validate_production_cors(self):
        """Validate CORS settings for production environment."""
        origins = self.get_cors_origins_list()
        if not origins:
            logger.warning("No CORS origins configured for production")
            return

        for origin in origins:
            if origin == "*":
                logger.warning("Wildcard CORS origin (*) is not recommended in production")
            elif origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1"):
                logger.warning(f"Localhost origin in production CORS: {origin}")

    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def is_staging(self) -> bool:
        return self.ENVIRONMENT == "staging"

    def get_anthropic_config(self) -> dict:
        """Get Anthropic configuration."""
        if not self.ANTHROPIC_API_KEY:
            logger.error("Anthropic API key is not configured")
            return {}

        return {
            "api_key": self.ANTHROPIC_API_KEY,
            "timeout": self.AI_TIMEOUT,
            "max_retries": self.AI_MAX_RETRIES,
            "model": self.ANTHROPIC_MODEL,
        }

    def validate_for_usage(self) -> bool:
        """Validate that settings are properly configured for application usage."""
        errors = []

        if not self.ANTHROPIC_API_KEY:
            errors.append("ANTHROPIC_API_KEY is required")

        if self.ENVIRONMENT not in ["development", "staging", "production"]:
            errors.append(f"Invalid ENVIRONMENT: {self.ENVIRONMENT}")

        if errors:
            logger.error("Configuration validation failed:\n" + "\n".join(errors))
            return False

        return True


class EmergencySettings:
    """Minimal settings for emergency operation when config loading fails."""
    PROJECT_NAME = "Political AI Chatbot (Emergency Mode)"
    CORS_ORIGINS = "http://localhost:3000"
    ANTHROPIC_API_KEY = ""
    ENVIRONMENT = "development"
    API_HOST = "0.0.0.0"
    API_PORT = 5000
    AI_TIMEOUT = 30
    AI_MAX_RETRIES = 3
    ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
    SYS_PROMPT_GERMAN = ""
    SYS_PROMPT_ENGLISH = ""

    def get_cors_origins_list(self):
        return ["http://localhost:3000"]

    def is_development(self): return True
    def is_production(self): return False
    def is_staging(self): return False
    def get_anthropic_config(self): return {}
    def validate_for_usage(self): return False


# Singleton instance with error handling
try:
    settings = Settings()
    if not settings.validate_for_usage():
        logger.warning("Configuration validation warnings detected")

except (ValidationError, Exception) as e:
    logger.critical(f"Failed to initialize application settings: {e}")
    settings = EmergencySettings()
    logger.error("Application running in emergency mode due to configuration errors")

__all__ = ['settings']
