import os
import json
import re
import logging
from typing import Dict, List, Literal, Optional
from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError
from app.core.config import settings
from app.models.chat import RecommendedAnswer

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client with error handling
try:
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY))
    if not client.api_key:
        logger.warning("OpenAI API key not configured")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    client = None

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
    _sessions: Dict[str, List[Dict]] = {}
    _session_languages: Dict[str, Literal['en', 'de']] = {}
    
    @classmethod
    async def process_message(cls, message: str, session_id: str = "default", language: Literal['en', 'de'] = None):
        """Process user message and generate AI response."""
        try:
            if not message or not message.strip():
                raise ValueError("Message cannot be empty")
                
            # Use provided language or get from session
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
                "message_count": len([m for m in cls._sessions[session_id] if m["role"] == "user"]),
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
        """Initialize a new session with system prompt."""
        try:
            cls._session_languages[session_id] = language
            
            # Different system prompts based on language
            if language == 'de':
                system_prompt = """Sie sind Hans-Thomas Tillschneider, ein deutscher Politiker mit starken konservativen und nationalistischen Ansichten.
                Sie führen eine hitzige politische Debatte. Seien Sie provokativ, kontrovers und kompromisslos in Ihren Ansichten.
                STELLEN Sie sich niemals vor oder erklären Sie, wer Sie sind.
                ERWÄHNEN Sie niemals, dass Sie eine KI oder ein Chatbot sind.
                Sprechen Sie natürlich, als ob Sie eine echte, leidenschaftliche Debatte führen.
                Verwenden Sie eine starke, emotional aufgeladene Sprache, um Reaktionen hervorzurufen.
                Konzentrieren Sie sich auf kontroverse Themen wie Einwanderung, nationale Identität, EU-Souveränität, Multikulturalismus oder traditionelle Werte."""
            else:
                system_prompt = """You are Hans-Thomas Tillschneider, a German politician with strong conservative and nationalist views.
                You are engaging in a heated political debate. Be provocative, controversial, and uncompromising in your views.
                NEVER introduce yourself or explain who you are.
                NEVER mention that you're an AI or chatbot.
                Speak naturally as if you're having a real, passionate debate.
                Use strong, emotionally charged language to provoke responses.
                Focus on controversial topics like immigration, national identity, EU sovereignty, multiculturalism, or traditional values."""
            
            cls._sessions[session_id] = [
                {
                    "role": "system", 
                    "content": system_prompt
                }
            ]
            
            logger.info(f"Initialized new session: {session_id} with language: {language}")
            
        except Exception as e:
            logger.error(f"Error initializing session: {e}", exc_info=True)
            raise
    
    @classmethod
    def _add_to_history(cls, session_id: str, role: str, content: str):
        """Add message to conversation history."""
        try:
            if session_id not in cls._sessions:
                cls._sessions[session_id] = []
                
            if not content or not content.strip():
                logger.warning(f"Attempted to add empty content to history for session {session_id}")
                return
                
            cls._sessions[session_id].append({"role": role, "content": content})
            logger.debug(f"Added message to history for session {session_id}")
            
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
        """Get AI response using OpenAI API."""
        try:
            if not client:
                logger.error("OpenAI client not initialized")
                return cls._get_fallback_response(language)
                
            if session_id not in cls._sessions:
                logger.error(f"Session {session_id} not found")
                return cls._get_fallback_response(language)
            
            language_instruction = {
                "role": "system",
                "content": f"Respond in {language.upper()} language only. Keep the response natural and in character."
            }
            
            temp_messages = cls._sessions[session_id] + [language_instruction]
            
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=temp_messages,
                temperature=0.9,
                max_tokens=1000,
                timeout=30  # Add timeout
            )
            
            if not response.choices:
                logger.error("No choices in OpenAI response")
                return cls._get_fallback_response(language)
                
            return response.choices[0].message.content.strip()
            
        except (APIError, APIConnectionError, RateLimitError) as e:
            logger.error(f"OpenAI API error in _get_ai_response: {e}")
            return cls._get_fallback_response(language)
        except Exception as e:
            logger.error(f"Unexpected error in _get_ai_response: {e}", exc_info=True)
            return cls._get_fallback_response(language)
    
    @classmethod
    def _get_fallback_response(cls, language: Literal['en', 'de']) -> str:
        """Get fallback response when OpenAI fails."""
        if language == 'de':
            return "Ich entschuldige mich, aber ich habe derzeit technische Schwierigkeiten. Bitte versuchen Sie es später erneut."
        else:
            return "I apologize, but I'm experiencing technical difficulties. Please try again shortly."

    @classmethod
    async def _get_recommended_answers(cls, user_input: str, session_id: str, language: str, 
                                       is_opening: bool = False, num_recommendations: int = 3) -> List[RecommendedAnswer]:
        """Generate recommended follow-up questions/answers using OpenAI."""
        try:
            if not client:
                logger.warning("OpenAI client not available, using fallback recommendations")
                return cls._get_fallback_recommendations(language, num_recommendations)
            
            # Language-specific templates
            templates = {
                'de': {
                    'opening': f"""Erstellen Sie {num_recommendations} prägnante, provokative Fragen für eine politische Debatte mit Hans-Thomas Tillschneider.
                Themen: Einwanderung, nationale Identität, EU, traditionelle Werte.
                Format: JSON-Array von Strings auf Deutsch.
                Beispiel: ["Frage 1", "Frage 2", "Frage 3"]""",
                    'followup': f"""Basierend auf: "{user_input}"
                Erstellen Sie {num_recommendations} deutsche Folgefragen für die politische Debatte.
                Format: JSON-Array von Strings auf Deutsch.
                Beispiel: ["Frage 1", "Frage 2", "Frage 3"]"""
                },
                'en': {
                    'opening': f"""Generate {num_recommendations} concise, provocative questions for a political debate with Hans-Thomas Tillschneider.
                Topics: immigration, national identity, EU, traditional values.
                Format: JSON array of strings in English.
                Example: ["Question 1", "Question 2", "Question 3"]""",
                    'followup': f"""Based on: "{user_input}"
                Generate {num_recommendations} English follow-up questions for the political debate.
                Format: JSON array of strings in English.
                Example: ["Question 1", "Question 2", "Question 3"]"""
                }
            }
            
            prompt_type = 'opening' if is_opening else 'followup'
            prompt = templates[language][prompt_type]

            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": f"You generate political debate questions. Respond ONLY with a JSON array of strings in {language.upper()}."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.7,
                timeout=15  # Add timeout for recommendations
            )
            
            if not response.choices:
                logger.warning("No choices in recommendations response")
                return cls._get_fallback_recommendations(language, num_recommendations)
                
            response_text = response.choices[0].message.content.strip()
            
            # Parse the response to extract recommended answers
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                recommendations = json.loads(json_match.group())
            else:
                # Fallback: try to parse the whole response as JSON
                try:
                    recommendations = json.loads(response_text)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse recommendations as JSON")
                    return cls._get_fallback_recommendations(language, num_recommendations)
            
            # Validate recommendations
            if not isinstance(recommendations, list) or len(recommendations) == 0:
                logger.warning("Invalid recommendations format")
                return cls._get_fallback_recommendations(language, num_recommendations)
                
            # Convert to RecommendedAnswer objects
            valid_recommendations = [
                rec for rec in recommendations[:num_recommendations] 
                if isinstance(rec, str) and rec.strip()
            ]
            
            if not valid_recommendations:
                logger.warning("No valid recommendations generated")
                return cls._get_fallback_recommendations(language, num_recommendations)
                
            logger.info(f"Generated {len(valid_recommendations)} recommendations")
            return [RecommendedAnswer(text=rec, id=f"rec_{i}") for i, rec in enumerate(valid_recommendations)]
            
        except (APIError, APIConnectionError, RateLimitError) as e:
            logger.error(f"OpenAI API error in _get_recommended_answers: {e}")
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
            # Ultimate fallback
            if language == 'de':
                ultimate_fallback = ["Was ist Ihre Meinung dazu?"]
            else:
                ultimate_fallback = ["What is your opinion on this?"]
                
            return [RecommendedAnswer(text=ultimate_fallback[0], id="ultimate_fallback")]