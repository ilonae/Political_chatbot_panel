import asyncio
import json
import os
import re
import logging
from typing import Dict, List, Literal, Optional
import httpx
from app.core.config import settings
from app.models.chat import RecommendedAnswer

# Configure logging
logger = logging.getLogger(__name__)
ollama_session: Optional[httpx.AsyncClient] = None


async def initialize_ollama_client():
    """Initialize the Ollama async HTTP client."""
    global ollama_session
    try:
        config = settings.get_ollama_config()
        ollama_host = config.get('host')
        ollama_model = config.get('model')

        if not ollama_host or not ollama_model:
            logger.error("Ollama host and model not configured in settings")
            return False

        # Test connection to Ollama
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{ollama_host}/api/tags")
                if response.status_code != 200:
                    logger.error(f"Failed to connect to Ollama at {ollama_host}: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Cannot reach Ollama server at {ollama_host}: {e}")
            return False

        # Create persistent async client for the session
        ollama_session = httpx.AsyncClient(
            base_url=ollama_host,
            timeout=config.get('timeout', 30),
        )

        logger.info(f"Ollama client initialized successfully (host: {ollama_host}, model: {ollama_model})")
        return True

    except Exception as e:
        logger.error(f"Failed to initialize Ollama client: {e}")
        return False


def get_translated_topic(topic: str, language: str) -> str:
    """Get translated topic with fallback to original topic."""
    try:
        topic_translations = {
            "Political ideologies and perspectives": {
                "en": "Political ideologies and perspectives",
                "de": "Politische Ideologien und Perspektiven"
            },
            "Current Debate Topic": {
                "en": "Current Debate Topic",
                "de": "Aktuelles Debatten-Thema"
            }
        }
        return topic_translations.get(topic, {}).get(language, topic)
    except Exception as e:
        logger.error(f"Error in get_translated_topic: {e}")
        return topic


class ChatService:
    # Each session stores: {"system": str, "messages": [{"role": ..., "content": ...}]}
    _sessions: Dict[str, Dict] = {}
    _session_languages: Dict[str, Literal['en', 'de']] = {}

    @classmethod
    async def _ensure_client_initialized(cls):
        """Ensure the Ollama client is initialized before making API calls."""
        global ollama_session
        if ollama_session is None:
            if not await initialize_ollama_client():
                raise ValueError("Ollama client not available. Is Ollama running on the configured host?")
        return True

    @classmethod
    async def process_message(cls, message: str, session_id: str = "default", language: Literal['en', 'de'] = None):
        """Process user message and generate AI response."""
        try:
            if not message or not message.strip():
                raise ValueError("Message cannot be empty")
            await cls._ensure_client_initialized()

            if language is None:
                language = cls._session_languages.get(session_id, 'en')
            else:
                cls._session_languages[session_id] = language

            if session_id not in cls._sessions:
                await cls._initialize_session(session_id, language)

            cls._add_to_history(session_id, "user", message)

            response = await cls._get_ai_response(session_id, language)
            if not response:
                raise ValueError("Failed to generate AI response")

            cls._add_to_history(session_id, "assistant", response)

            recommended_answers = await cls._get_recommended_answers(
                message, session_id, language
            )

            topic = get_translated_topic("Current Debate Topic", language)

            logger.info(f"Successfully processed message for session {session_id}")
            return {
                "response": response,
                "session_id": session_id,
                "message_count": len([
                    m for m in cls._sessions[session_id]["messages"]
                    if m["role"] == "user"
                ]),
                "language": language,
                "recommended_answers": recommended_answers,
                "topic": topic
            }

        except ValueError as e:
            logger.error(f"Validation error in process_message: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in process_message: {e}", exc_info=True)
            raise

    @classmethod
    async def start_conversation(cls, session_id: str = "default", language: Literal['en', 'de'] = 'en'):
        """Initialize a new conversation session."""
        try:
            if not language or language not in ['en', 'de']:
                raise ValueError("Invalid language specified")

            await cls._ensure_client_initialized()
            await cls._initialize_session(session_id, language)

            opening_message = await cls._get_ai_response(session_id, language)
            if not opening_message:
                raise ValueError("Failed to generate opening message")

            cls._add_to_history(session_id, "assistant", opening_message)

            recommended_answers = await cls._get_recommended_answers(
                "", session_id, language, is_opening=True
            )

            topic = get_translated_topic("Political ideologies and perspectives", language)

            logger.info(f"Successfully started conversation for session {session_id}")
            return {
                "opening_message": opening_message,
                "session_id": session_id,
                "recommended_answers": recommended_answers,
                "message_count": 1,
                "topic": topic,
                "language": language
            }

        except ValueError as e:
            logger.error(f"Validation error in start_conversation: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in start_conversation: {e}", exc_info=True)
            raise

    @classmethod
    async def reset_conversation(cls, session_id: str = "default"):
        """Reset conversation session."""
        try:
            if session_id in cls._sessions:
                del cls._sessions[session_id]
                logger.info(f"Deleted session: {session_id}")

            if session_id in cls._session_languages:
                del cls._session_languages[session_id]
                logger.info(f"Deleted session language: {session_id}")

            logger.info(f"Successfully reset session: {session_id}")
            return {"status": "success", "session_id": session_id}

        except Exception as e:
            logger.error(f"Error resetting conversation: {e}", exc_info=True)
            raise

    @classmethod
    async def _initialize_session(cls, session_id: str, language: Literal['en', 'de'] = 'en'):
        """Initialize a new session with system prompt.

        The system prompt is loaded from environment variables (SYS_PROMPT_ENGLISH /
        SYS_PROMPT_GERMAN), never hard-coded here. Store them in your .env file.
        """
        try:
            cls._session_languages[session_id] = language

            if language == 'de':
                system_prompt = os.getenv("SYS_PROMPT_GERMAN", settings.SYS_PROMPT_GERMAN)
            else:
                system_prompt = os.getenv("SYS_PROMPT_ENGLISH", settings.SYS_PROMPT_ENGLISH)

            if not system_prompt:
                logger.warning(
                    f"System prompt for language '{language}' is empty. "
                    "Set SYS_PROMPT_ENGLISH / SYS_PROMPT_GERMAN in your .env file."
                )

            # Store system prompt and message history
            cls._sessions[session_id] = {
                "system": system_prompt,
                "messages": [],  # Only user / assistant turns here
            }

            logger.info(f"Initialized new session: {session_id} with language: {language}")

        except Exception as e:
            logger.error(f"Error initializing session: {e}", exc_info=True)
            raise

    @classmethod
    def _add_to_history(cls, session_id: str, role: str, content: str):
        """Add a user or assistant message to conversation history."""
        try:
            if session_id not in cls._sessions:
                cls._sessions[session_id] = {"system": "", "messages": []}

            if not content or not content.strip():
                logger.warning(f"Attempted to add empty content to history for session {session_id}")
                return

            cls._sessions[session_id]["messages"].append({"role": role, "content": content})
            logger.debug(f"Added {role} message to history for session {session_id}")

        except Exception as e:
            logger.error(f"Error adding to history: {e}", exc_info=True)
            raise

    @classmethod
    async def update_language(cls, session_id: str, language: Literal['en', 'de']) -> bool:
        """Update language for an existing session."""
        try:
            if language not in ['en', 'de']:
                raise ValueError("Invalid language specified")

            if session_id in cls._session_languages:
                cls._session_languages[session_id] = language
                logger.info(f"Language updated to {language} for session {session_id}")
                return True

            logger.warning(f"Session {session_id} not found for language update")
            return False

        except ValueError as e:
            logger.error(f"Validation error in update_language: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in update_language: {e}", exc_info=True)
            raise

    @classmethod
    async def _get_ai_response(cls, session_id: str, language: Literal['en', 'de'] = 'en') -> Optional[str]:
        """Get AI response using Ollama's /api/generate endpoint."""
        try:
            await cls._ensure_client_initialized()

            if session_id not in cls._sessions:
                logger.error(f"Session {session_id} not found")
                return cls._get_fallback_response(language)

            session = cls._sessions[session_id]

            # Build system prompt: persona + language instruction
            system_prompt = (
                f"{session['system']}\n\n"
                f"Respond in {'German' if language == 'de' else 'English'} only. "
                f"Keep the response natural and in character."
            ).strip()

            # Build conversation context from message history
            messages = session["messages"]
            if not messages:
                # For opening message, use a hidden user prompt
                messages = [{"role": "user", "content": "Please begin the conversation."}]

            # Format messages as a chat history string
            conversation_context = ""
            for msg in messages:
                role = "User" if msg["role"] == "user" else "Assistant"
                conversation_context += f"{role}: {msg['content']}\n"

            # Get the model name from config
            config = settings.get_ollama_config()
            model = config.get("model", "dolphin-mistral")

            # Call Ollama's /api/generate endpoint
            prompt = f"{system_prompt}\n\n{conversation_context}Assistant:"

            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "temperature": 0.7,
                "options": {
                    "num_predict": 300,   # cap response at ~300 tokens
                    "num_ctx": 2048,      # context window
                },
            }

            global ollama_session
            response = await ollama_session.post("/api/generate", json=payload)

            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return cls._get_fallback_response(language)

            response_data = response.json()
            generated_text = response_data.get("response", "").strip()

            if not generated_text:
                logger.error("Empty response from Ollama")
                return cls._get_fallback_response(language)

            return generated_text

        except httpx.RequestError as e:
            logger.error(f"HTTP request error in _get_ai_response: {e}")
            return cls._get_fallback_response(language)
        except Exception as e:
            logger.error(f"Unexpected error in _get_ai_response: {e}", exc_info=True)
            return cls._get_fallback_response(language)

    @classmethod
    def _get_fallback_response(cls, language: Literal['en', 'de']) -> str:
        """Fallback response when Ollama is unavailable."""
        if language == 'de':
            return "Ich entschuldige mich, aber ich habe derzeit technische Schwierigkeiten. Bitte versuchen Sie es später erneut."
        return "I apologize, but I'm experiencing technical difficulties. Please try again shortly."

    @classmethod
    async def _get_recommended_answers(
        cls,
        user_input: str,
        session_id: str,
        language: str,
        is_opening: bool = False,
        num_recommendations: int = 3,
    ) -> List[RecommendedAnswer]:
        """Generate recommended follow-up questions using Ollama."""
        try:
            await cls._ensure_client_initialized()

            templates = {
                'de': {
                    'opening': (
                        f"Erstellen Sie {num_recommendations} prägnante, provokative Fragen für eine politische Debatte.\n"
                        f"Themen: Einwanderung, nationale Identität, EU, traditionelle Werte.\n"
                        f"Format: JSON-Array von Strings auf Deutsch.\n"
                        f'Beispiel: ["Frage 1", "Frage 2", "Frage 3"]'
                    ),
                    'followup': (
                        f'Basierend auf: "{user_input}"\n'
                        f"Erstellen Sie {num_recommendations} deutsche Folgefragen für die politische Debatte.\n"
                        f"Format: JSON-Array von Strings auf Deutsch.\n"
                        f'Beispiel: ["Frage 1", "Frage 2", "Frage 3"]'
                    ),
                },
                'en': {
                    'opening': (
                        f"Generate {num_recommendations} concise, provocative questions for a political debate.\n"
                        f"Topics: immigration, national identity, EU, traditional values.\n"
                        f"Format: JSON array of strings in English.\n"
                        f'Example: ["Question 1", "Question 2", "Question 3"]'
                    ),
                    'followup': (
                        f'Based on: "{user_input}"\n'
                        f"Generate {num_recommendations} English follow-up questions for the political debate.\n"
                        f"Format: JSON array of strings in English.\n"
                        f'Example: ["Question 1", "Question 2", "Question 3"]'
                    ),
                },
            }

            prompt_type = 'opening' if is_opening else 'followup'
            prompt = templates[language][prompt_type]
            config = settings.get_ollama_config()
            model = config.get("model", "dolphin-mistral")

            system_instruction = f"You generate political debate questions. Respond ONLY with a JSON array of strings in {language.upper()}."

            payload = {
                "model": model,
                "prompt": f"{system_instruction}\n\n{prompt}",
                "stream": False,
                "temperature": 0.7,
                "options": {
                    "num_predict": 150,   # just a short JSON array needed
                    "num_ctx": 1024,
                },
            }

            global ollama_session
            # Use a shorter timeout for recommendations — fall back gracefully if slow
            try:
                response = await asyncio.wait_for(
                    ollama_session.post("/api/generate", json=payload),
                    timeout=30.0
                )
            except asyncio.TimeoutError:
                logger.warning("Recommendations timed out — using fallback")
                return cls._get_fallback_recommendations(language, num_recommendations)

            if response.status_code != 200:
                logger.warning(f"Ollama error generating recommendations: {response.status_code}")
                return cls._get_fallback_recommendations(language, num_recommendations)

            response_data = response.json()
            response_text = response_data.get("response", "").strip()

            if not response_text:
                logger.warning("Empty content in recommendations response")
                return cls._get_fallback_recommendations(language, num_recommendations)

            # Try to extract JSON from response
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                recommendations = json.loads(json_match.group())
            else:
                try:
                    recommendations = json.loads(response_text)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse recommendations as JSON")
                    return cls._get_fallback_recommendations(language, num_recommendations)

            if not isinstance(recommendations, list) or len(recommendations) == 0:
                logger.warning("Invalid recommendations format")
                return cls._get_fallback_recommendations(language, num_recommendations)

            valid_recommendations = [
                rec for rec in recommendations[:num_recommendations]
                if isinstance(rec, str) and rec.strip()
            ]

            if not valid_recommendations:
                logger.warning("No valid recommendations generated")
                return cls._get_fallback_recommendations(language, num_recommendations)

            logger.info(f"Generated {len(valid_recommendations)} recommendations")
            return [RecommendedAnswer(text=rec, id=f"rec_{i}") for i, rec in enumerate(valid_recommendations)]

        except httpx.RequestError as e:
            logger.error(f"HTTP request error in _get_recommended_answers: {e}")
            return cls._get_fallback_recommendations(language, num_recommendations)
        except Exception as e:
            logger.error(f"Unexpected error in _get_recommended_answers: {e}", exc_info=True)
            return cls._get_fallback_recommendations(language, num_recommendations)

    @classmethod
    def _get_fallback_recommendations(cls, language: str, num_recommendations: int = 3) -> List[RecommendedAnswer]:
        """Language-specific fallback recommendations."""
        try:
            fallbacks = {
                'de': [
                    "Wie positionieren Sie sich zur aktuellen Einwanderungspolitik?",
                    "Was bedeutet nationale Identität für Sie?",
                    "Wie sollte Deutschland mit der EU zusammenarbeiten?",
                    "Welche traditionellen Werte sind heute noch relevant?",
                    "Wie bewerten Sie die multikulturelle Gesellschaft?"
                ],
                'en': [
                    "What is your position on current immigration policies?",
                    "What does national identity mean to you?",
                    "How should Germany cooperate with the EU?",
                    "Which traditional values are still relevant today?",
                    "How do you assess multicultural society?"
                ]
            }

            language_fallbacks = fallbacks.get(language, fallbacks['en'])
            recommendations = language_fallbacks[:min(num_recommendations, len(language_fallbacks))]

            logger.info(f"Using fallback recommendations for language: {language}")
            return [RecommendedAnswer(text=rec, id=f"fallback_{i}") for i, rec in enumerate(recommendations)]

        except Exception as e:
            logger.error(f"Error in fallback recommendations: {e}")
            ultimate = ["Was ist Ihre Meinung dazu?"] if language == 'de' else ["What is your opinion on this?"]
            return [RecommendedAnswer(text=ultimate[0], id="ultimate_fallback")]


    @classmethod
    async def stream_message(cls, message: str, session_id: str = "default", language: Literal['en', 'de'] = 'en'):
        """Stream AI response tokens as Server-Sent Events."""
        import json as _json

        await cls._ensure_client_initialized()

        if language:
            cls._session_languages[session_id] = language

        if session_id not in cls._sessions:
            await cls._initialize_session(session_id, language)

        cls._add_to_history(session_id, "user", message)

        session = cls._sessions[session_id]
        system_prompt = (
            f"{session['system']}\n\n"
            f"Respond in {'German' if language == 'de' else 'English'} only. "
            f"Keep the response natural and in character."
        ).strip()

        messages = session["messages"]
        conversation_context = ""
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            conversation_context += f"{role}: {msg['content']}\n"

        config = settings.get_ollama_config()
        model = config.get("model", "dolphin-mistral")
        prompt = f"{system_prompt}\n\n{conversation_context}Assistant:"

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "temperature": 0.7,
            "options": {"num_predict": 300, "num_ctx": 2048},
        }

        full_response = ""

        try:
            global ollama_session
            async with ollama_session.stream("POST", "/api/generate", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = _json.loads(line)
                    except _json.JSONDecodeError:
                        continue

                    token = chunk.get("response", "")
                    done = chunk.get("done", False)

                    if token:
                        full_response += token
                        yield f"data: {_json.dumps({'token': token})}\n\n"

                    if done:
                        break

            # Save completed response to history
            if full_response:
                cls._add_to_history(session_id, "assistant", full_response)

            # Generate recommended answers in background (fire-and-forget for speed)
            recommended = await cls._get_recommended_answers(message, session_id, language)
            rec_data = [{"text": r.text, "id": r.id} for r in recommended]
            topic = get_translated_topic("Current Debate Topic", language)
            yield f"data: {_json.dumps({'done': True, 'recommended_answers': rec_data, 'topic': topic})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            fallback = cls._get_fallback_response(language)
            yield f"data: {_json.dumps({'token': fallback})}\n\n"
            yield f"data: {_json.dumps({'done': True, 'recommended_answers': [], 'topic': ''})}\n\n"


async def startup_event():
    """Initialize the Ollama client when the application starts."""
    logger.info("Initializing Ollama client on startup...")
    return await initialize_ollama_client()


async def shutdown_event():
    """Clean up the Ollama client when the application shuts down."""
    global ollama_session
    if ollama_session:
        await ollama_session.aclose()
        ollama_session = None
        logger.info("Ollama client closed")
