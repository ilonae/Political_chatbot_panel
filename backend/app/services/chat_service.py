import os, json
from openai import AsyncOpenAI
from typing import Dict, List, Literal
from app.core.config import settings
from app.models.chat import RecommendedAnswer

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY))


def get_translated_topic(topic: str, language: str) -> str:
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

class ChatService:
    _sessions: Dict[str, List[Dict]] = {}
    _session_languages: Dict[str, Literal['en', 'de']] = {} 
    
    
    @classmethod
    async def process_message(cls, message: str, session_id: str = "default", language: Literal['en', 'de'] = None):
        # Use provided language or get from session
        if language is None:
            language = cls._session_languages.get(session_id, 'en')
        else:
            cls._session_languages[session_id] = language
        
        if session_id not in cls._sessions:
            await cls._initialize_session(session_id, language)
        
        # Rest of the method remains the same...
        cls._add_to_history(session_id, "user", message)
        response = await cls._get_ai_response(session_id, language)
        cls._add_to_history(session_id, "assistant", response)
        
        recommended_answers = await cls._get_recommended_answers(
            message, session_id, language
        )
        
        topic = get_translated_topic("Current Debate Topic", language)
        return {
            "response": response,
            "session_id": session_id,
            "message_count": len([m for m in cls._sessions[session_id] if m["role"] == "user"]),
            "language": language,
            "recommended_answers": recommended_answers,
            "topic": topic
        }

    @classmethod
    async def start_conversation(cls, session_id: str = "default", language: Literal['en', 'de'] = 'en'):
        await cls._initialize_session(session_id, language)
        opening_message = await cls._get_ai_response(session_id, language)
        cls._add_to_history(session_id, "assistant", opening_message)
        recommended_answers = await cls._get_recommended_answers("", session_id, language, is_opening=True)
        
        topic = get_translated_topic("Political ideologies and perspectives", language)
        # Return format that frontend expects
        return {
            "opening_message": opening_message,
            "session_id": session_id,
            "recommended_answers": recommended_answers,
            "message_count": 1,
            "topic": topic,
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
    
    @classmethod
    def _add_to_history(cls, session_id: str, role: str, content: str):
        if session_id not in cls._sessions:
            cls._sessions[session_id] = []
        cls._sessions[session_id].append({"role": role, "content": content})
    
    @classmethod
    async def update_language(cls, session_id: str, language: Literal['en', 'de']) -> bool:
        """Update language for an existing session without resetting conversation history"""
        if session_id in cls._session_languages:
            cls._session_languages[session_id] = language
            print(f"Language updated to {language} for session {session_id}")
            return True
        print(f"Session {session_id} not found for language update")
        return False

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
            

    @classmethod
    async def _get_recommended_answers(cls, user_input: str, session_id: str, language: str, 
                                       is_opening: bool = False, num_recommendations: int = 3, conversation_history: str = None):
        """Generate recommended follow-up questions/answers using OpenAI"""
        
        # Prepare conversation context
        context = user_input
        
        if not conversation_history and session_id in cls._sessions:
            # Extract last few messages for context (excluding system prompt)
            recent_history = [msg for msg in cls._sessions[session_id][-6:] if msg["role"] != "system"]
            context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])
        
        elif conversation_history:
            context = conversation_history
            
        # Different prompts based on language and context
        if language == 'de':
            if is_opening:
                prompt = f"""Erstellen Sie {num_recommendations} prägnante, relevante politische Fragen oder Aussagen, 
                die ein Nutzer als Einstieg in eine Debatte mit Hans-Thomas Tillschneider stellen könnte.
                Die Fragen sollten provokativ, kontrovers und zum Nachdenken anregend sein.
                
                Geben Sie NUR ein JSON-Array von Zeichenketten zurück, sonst nichts.
                Beispiel: ["Frage 1", "Frage 2", "Frage 3"]"""
            else:
                prompt = f"""Basierend auf der Eingabe des Nutzers: "{user_input}"
                {f"Und Konversationskontext: {context}" if context else ""}
                
                Erstellen Sie {num_recommendations} prägnante, relevante Folgefragen oder Aussagen, 
                die ein Nutzer als nächstes stellen möchte. Machen Sie sie themenbezogen und hilfreich für die politische Debatte.
                
                Geben Sie NUR ein JSON-Array von Zeichenketten zurück, sonst nichts.
                Beispiel: ["Frage 1", "Frage 2", "Frage 3"]"""
        else:
            if is_opening:
                prompt = f"""Generate {num_recommendations} concise, relevant political questions or statements 
                that a user might ask to start a debate with Hans-Thomas Tillschneider.
                The questions should be provocative, controversial, and thought-provoking.
                
                Return ONLY a JSON array of strings, nothing else.
                Example: ["Question 1", "Question 2", "Question 3"]"""
            else:
                prompt = f"""Based on the user's input: "{user_input}"
                {f"And conversation context: {context}" if context else ""}
                
                Generate {num_recommendations} concise, relevant follow-up questions or statements 
                that a user might want to ask next. Make them political topic related and helpful for the debate.
                
                Return ONLY a JSON array of strings, nothing else.
                Example: ["Question 1", "Question 2", "Question 3"]"""
        
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that generates relevant follow-up questions for a political chatbot. Return ONLY a JSON array of strings."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.7
            )
            
            # Parse the response to extract recommended answers
            response_text = response.choices[0].message.content
            recommendations = json.loads(response_text)
            
            # Convert to RecommendedAnswer objects
            return [RecommendedAnswer(text=rec, id=f"rec_{i}") for i, rec in enumerate(recommendations[:num_recommendations])]
            
        except Exception as e:
            # Fallback recommendations in case of error
            print(f"Error generating recommendations: {e}")
            if language == 'de':
                return [
                    RecommendedAnswer(text="Können Sie mehr über diese Politik erzählen?", id="fallback_1"),
                    RecommendedAnswer(text="Was sind die Hauptargumente dafür?", id="fallback_2"),
                    RecommendedAnswer(text="Wie unterscheidet sich das von anderen Ansätzen?", id="fallback_3")
                ]
            else:
                return [
                    RecommendedAnswer(text="Can you tell me more about this policy?", id="fallback_1"),
                    RecommendedAnswer(text="What are the main arguments for this?", id="fallback_2"),
                    RecommendedAnswer(text="How does this compare to other approaches?", id="fallback_3")
                ]