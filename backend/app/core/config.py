import os
import logging
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator, ValidationError
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables from .env file
try:
    load_dotenv()
    logger.info("Successfully loaded .env file")
except Exception as e:
    logger.warning(f"Failed to load .env file: {e}. Using system environment variables.")

class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = Field(
        default="Political AI Chatbot",
        description="Name of the project for logging and identification"
    )
    
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://frontend:3000"],
        description="List of allowed CORS origins"
    )
    
    OPENAI_API_KEY: str = Field(
        default="",
        description="OpenAI API key for accessing GPT models and TTS services",
        min_length=1
    )
    
    # Environment mode
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment (development, staging, production)",
        pattern="^(development|staging|production)$"
    )
    
    # API Configuration
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
    
    # Timeouts
    OPENAI_TIMEOUT: int = Field(
        default=30,
        description="Timeout in seconds for OpenAI API calls",
        ge=1,
        le=120
    )
    
    # Retry configuration
    OPENAI_MAX_RETRIES: int = Field(
        default=3,
        description="Maximum number of retries for OpenAI API calls",
        ge=0,
        le=10
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra environment variables

    @validator("OPENAI_API_KEY", pre=True, always=True)
    def validate_api_key(cls, v):
        """Validate OpenAI API key format."""
        if not v:
            logger.warning("OPENAI_API_KEY is not set")
            return v
            
        if v.startswith("your-") or "example" in v.lower():
            logger.error(f"Invalid OpenAI API key format: {v}")
            raise ValueError("OpenAI API key appears to be a placeholder. Please set a valid key.")
            
        # Basic format validation (sk- prefix for OpenAI keys)
        if not v.startswith("sk-"):
            logger.warning(f"OpenAI API key doesn't start with 'sk-' prefix: {v}")
            
        return v

    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            # Handle comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    def __init__(self, **kwargs):
        """Initialize settings with enhanced error handling."""
        try:
            super().__init__(**kwargs)
            self._post_init_validation()
            
        except ValidationError as e:
            logger.error(f"Configuration validation failed: {e}")
            # Provide helpful error messages
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
        # Check if we're in production without proper API key
        if self.ENVIRONMENT == "production" and not self.OPENAI_API_KEY:
            logger.critical("Production environment requires a valid OPENAI_API_KEY")
            raise ValueError("OPENAI_API_KEY is required in production environment")
        
        # Validate CORS origins in production
        if self.ENVIRONMENT == "production":
            self._validate_production_cors()
        
        logger.info(f"Configuration loaded successfully for {self.ENVIRONMENT} environment")

    def _validate_production_cors(self):
        """Validate CORS settings for production environment."""
        if not self.CORS_ORIGINS:
            logger.warning("No CORS origins configured for production")
            return
            
        for origin in self.CORS_ORIGINS:
            if origin == "*":
                logger.warning("Wildcard CORS origin (*) is not recommended in production")
            elif origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1"):
                logger.warning(f"Localhost origin in production CORS: {origin}")

    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT == "development"

    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"

    def is_staging(self) -> bool:
        """Check if running in staging environment."""
        return self.ENVIRONMENT == "staging"

    def get_openai_config(self) -> dict:
        """Get OpenAI configuration with proper error handling."""
        if not self.OPENAI_API_KEY:
            logger.error("OpenAI API key is not configured")
            return {}
            
        return {
            "api_key": self.OPENAI_API_KEY,
            "timeout": self.OPENAI_TIMEOUT,
            "max_retries": self.OPENAI_MAX_RETRIES
        }

    def validate_for_usage(self) -> bool:
        """Validate that settings are properly configured for application usage."""
        errors = []
        
        if not self.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required")
            
        if self.ENVIRONMENT not in ["development", "staging", "production"]:
            errors.append(f"Invalid ENVIRONMENT: {self.ENVIRONMENT}")
            
        if errors:
            error_message = "Configuration validation failed:\n" + "\n".join(errors)
            logger.error(error_message)
            return False
            
        return True

# Singleton instance with error handling
try:
    settings = Settings()
    
    # Perform final validation
    if not settings.validate_for_usage():
        logger.warning("Configuration validation warnings detected")
        
except ValidationError as e:
    logger.critical("Failed to initialize application settings due to validation errors")
    # Create a minimal settings object for emergency operation
    class EmergencySettings:
        PROJECT_NAME = "Political AI Chatbot (Emergency Mode)"
        CORS_ORIGINS = ["http://localhost:3000"]
        OPENAI_API_KEY = ""
        ENVIRONMENT = "development"
        API_HOST = "0.0.0.0"
        API_PORT = 8000
        OPENAI_TIMEOUT = 30
        OPENAI_MAX_RETRIES = 3
        
        def is_development(self): return True
        def is_production(self): return False
        def is_staging(self): return False
        def get_openai_config(self): return {}
        def validate_for_usage(self): return False
    
    settings = EmergencySettings()
    logger.error("Application running in emergency mode due to configuration errors")
    
except Exception as e:
    logger.critical(f"Critical error initializing settings: {e}")
    raise

# Export validated settings
__all__ = ['settings']