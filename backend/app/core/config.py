import os
import logging
from pydantic_settings import BaseSettings
from pydantic import Field, validator, ValidationError
from dotenv import load_dotenv


logger = logging.getLogrm .git/index.lockger(__name__)

try:
    # Resolve path relative to this file so it works regardless of CWD.
    # config.py lives at backend/app/core/config.py → two levels up = backend/
    _env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    load_dotenv(_env_path)
    logger.info(f"Successfully loaded .env file from {_env_path}")
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

    # Ollama server configuration
    OLLAMA_HOST: str = Field(
        default="http://localhost:11434",
        description="URL of the local Ollama server"
    )

    OLLAMA_MODEL: str = Field(
        default="dolphin-mistral",
        description="Name of the Ollama model to use (e.g., dolphin-mistral, nous-hermes)"
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
        default=8000,
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


    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra environment variables

    @validator("OLLAMA_HOST", pre=True, always=True)
    def validate_ollama_host(cls, v):
        """Validate Ollama host configuration."""
        if not v:
            logger.warning("OLLAMA_HOST is not set, using default localhost:11434")
            return "http://localhost:11434"

        if not v.startswith("http://") and not v.startswith("https://"):
            logger.warning(f"OLLAMA_HOST should start with http:// or https:// — got {v}")
            return f"http://{v}" if "://" not in v else v

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

    def _post_init_validation(self):
        """Perform additional validation after initialization."""
        # Note: Ollama requires a running local service, not an API key
        if not self.OLLAMA_HOST or not self.OLLAMA_MODEL:
            logger.critical("Ollama requires OLLAMA_HOST and OLLAMA_MODEL to be configured")
            raise ValueError("OLLAMA_HOST and OLLAMA_MODEL are required")

        if self.ENVIRONMENT == "production":
            self._validate_production_cors()

        logger.info(f"Configuration loaded successfully for {self.ENVIRONMENT} environment")

    def _validate_production_cors(self):
        """Validate CORS settings for production environment."""
        if not self.CORS_ORIGINS:
            logger.warning("No CORS origins configured for production")
            return

        for origin in self.get_cors_origins_list():
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

    def get_ollama_config(self) -> dict:
        """Get Ollama configuration."""
        if not self.OLLAMA_HOST or not self.OLLAMA_MODEL:
            logger.error("Ollama is not properly configured")
            return {}

        return {
            "host": self.OLLAMA_HOST,
            "model": self.OLLAMA_MODEL,
            "timeout": self.AI_TIMEOUT,
        }

    def validate_for_usage(self) -> bool:
        """Validate that settings are properly configured for application usage."""
        errors = []

        if not self.OLLAMA_HOST:
            errors.append("OLLAMA_HOST is required")

        if not self.OLLAMA_MODEL:
            errors.append("OLLAMA_MODEL is required")

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
    OLLAMA_HOST = "http://localhost:11434"
    OLLAMA_MODEL = "dolphin-mistral"
    ENVIRONMENT = "development"
    API_HOST = "0.0.0.0"
    API_PORT = 5000
    AI_TIMEOUT = 30
    AI_MAX_RETRIES = 3
    SYS_PROMPT_GERMAN = ""
    SYS_PROMPT_ENGLISH = ""

    def get_cors_origins_list(self):
        return ["http://localhost:3000"]

    def is_development(self): return True
    def is_production(self): return False
    def is_staging(self): return False
    def get_ollama_config(self): return {}
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
    
except Exception as e:
    logger.critical(f"Critical error initializing settings: {e}")
    raise

__all__ = ['settings']
