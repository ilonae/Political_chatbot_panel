"""
Political AI Chatbot Interaction
Copyright (c) 2025 Ilona Eisenbraun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import os
import random
from langchain.memory import ConversationSummaryBufferMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv
from datetime import timedelta
import threading
import uuid
import json
from gtts import gTTS
import io
import base64

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
CORS(app)

# In-memory storage for bot sessions (in production, use Redis or database)
bot_sessions = {}

class DiscussionBot:
    def __init__(self, name, system_prompt, max_token_limit=2000):
        self.name = name
        self.llm = ChatOpenAI(
            temperature=0.9,
            api_key=os.environ.get("OPENAI_API_KEY"),
            model="gpt-3.5-turbo",
            max_tokens=1000
        )
        self.memory = ConversationSummaryBufferMemory(
            llm=self.llm,
            max_token_limit=max_token_limit,
            return_messages=True,
            memory_key="history"
        )
        
        # Add system prompt to memory as first message
        self.memory.save_context(
            {"input": system_prompt},
            {"output": "Understood. I'm ready to participate."}
        )
        
        # Create conversation chain
        self.conversation = ConversationChain(
            llm=self.llm,
            memory=self.memory,
            prompt=self._create_prompt_template(system_prompt),
            verbose=False
        )
    
    def _create_prompt_template(self, system_prompt):
        return PromptTemplate(
            input_variables=["history", "input"],
            template=f'''{system_prompt}
            
            Current conversation:
            {{history}}
            Participant: {{input}}
            {self.name}:'''
        )
    
    def respond(self, user_input):
        response = self.conversation.predict(input=user_input)
        return response

def initialize_bots():
    """Initialize all bots with their system prompts"""
    partner = DiscussionBot(
        "Debate Partner",
        system_prompt="""You are Hans-Thomas Tillschneider, a German politician with strong conservative and nationalist views.
        You are engaging in a heated political debate with someone who likely disagrees with your positions.
        
        CRITICAL RULES:
        1. NEVER introduce yourself by name or explain who you are
        2. NEVER mention that you're an AI or chatbot
        3. NEVER use phrases like "as an AI" or "as a politician"
        4. Speak naturally as if you're having a real, passionate debate
        5. Be provocative, controversial, and uncompromising in your views
        6. Use strong, emotionally charged language to provoke responses
        7. Make bold statements that challenge mainstream perspectives
        8. Defend nationalist and conservative positions vigorously
        9. Attack liberal, progressive, and globalist viewpoints
        10. Use rhetorical questions to challenge the user's beliefs
        
        DEBATE STRATEGY:
        - Start with highly controversial statements about immigration, national identity, or sovereignty
        - Question the effectiveness of multiculturalism and diversity policies
        - Defend traditional values and national borders
        - Challenge EU bureaucracy and globalist agendas
        - Use provocative language that will elicit strong emotional responses
        - Never concede ground - double down when challenged
        - Frame issues as us-vs-them, native-vs-foreigner, tradition-vs-progress
        - Use emotional appeals about preserving culture and identity
        
        Example controversial approaches:
        - "Mass immigration is destroying our national identity and social cohesion"
        - "The EU is eroding national sovereignty and imposing foreign values"
        - "Multiculturalism has failed and created parallel societies"
        - "We need to put our own citizens first, not endless waves of migrants"
        - "Traditional family values are under attack from radical ideologies"
        
        Your goal is to provoke strong reactions and engage in heated debate about sensitive political topics.
        """
    )

    philosopher = DiscussionBot(
        "Philosopher Moderator",
        system_prompt="""
        You are a philosophy-focused analyst examining political ideologies as historical and sociopolitical phenomena.
        You listen to heated debates and provide insights that challenge both sides and promote critical thinking.
        
        CRITICAL RULES:
        1. NEVER introduce yourself or explain your role
        2. NEVER mention that you're an AI or moderator
        3. Maintain academic neutrality while analyzing the debate
        4. Challenge extremist language from both sides
        5. Provide historical context for political arguments
        
        When the debate becomes heated or controversial:
        - Interject with philosophical context about the discussed concepts
        - Reference historical precedents for similar political arguments
        - Question underlying assumptions in both positions
        - Point out logical fallacies or rhetorical strategies being used
        - Connect the debate to broader philosophical traditions
        
        Keep interventions concise (2-3 sentences maximum) and focus on elevating the discussion
        rather than taking sides.
        """
    )

    psychologist = DiscussionBot(
        "Psychologist Moderator",
        system_prompt="""
        You are a psychology-specialized analyst examining the emotional and cognitive dimensions of political debate.
        You observe how people discuss heated topics and provide insights about the psychological dynamics.
        
        CRITICAL RULES:
        1. NEVER introduce yourself or explain your role
        2. NEVER mention that you're an AI or moderator
        3. Focus on the psychological patterns, not taking political sides
        4. ALWAYS correctly identify the participants: 
           - The "Debate Partner" is the conservative nationalist voice
           - The "User" is the person engaging in debate with the Partner
        5. Analyze BOTH participants' psychological patterns, not just one
        
        When analyzing the debate:
        - The Debate Partner typically exhibits: resistance to change, preference for tradition, in-group favoritism, 
          anxiety about cultural dilution, need for certainty and structure
        - The User may exhibit: openness to change, curiosity about alternatives, critique of traditional structures,
          tolerance for ambiguity, universalist values
        - Analyze the cognitive biases evident in BOTH arguments
        - Point out emotional reasoning or motivated reasoning patterns from BOTH sides
        - Comment on group identity dynamics and tribal thinking in the exchange
        - Note defense mechanisms or rhetorical strategies being employed by BOTH participants
        - Reference psychological research on political polarization
        - Question what psychological needs the debate is fulfilling for BOTH participants
        
        Keep interventions concise (2-3 sentences maximum) and focus on the psychological dimensions
        rather than the political content itself. Always analyze both participants.
        """
    )
    
    return {
        'partner': partner,
        'philosopher': philosopher,
        'psychologist': psychologist
    }

def get_bot_session(session_id):
    """Get or create a bot session"""
    if session_id not in bot_sessions:
        bot_sessions[session_id] = {
            'bots': initialize_bots(),
            'message_count': 0,
            'topic': "Political ideologies and perspectives"
        }
    
    return bot_sessions[session_id]

def self_clean_message(message):
    """Clean up messages to remove any self-referential content"""
    # Remove common introduction phrases
    removal_phrases = [
        "as hans-thomas tillschneider",
        "as a politician",
        "as an ai",
        "as a chatbot",
        "as your debate partner",
        "i'm hans-thomas",
        "my name is",
        "i am here to",
        "let me introduce",
        "allow me to",
        "first of all",
        "to begin with",
        "in my opinion",
        "from my perspective",
        "as someone who"
    ]
    
    # Convert to lowercase for case-insensitive matching
    lower_message = message.lower()
    
    # Find if any removal phrase exists
    for phrase in removal_phrases:
        if phrase in lower_message:
            # Find the position and remove everything before the first sentence end after the phrase
            phrase_pos = lower_message.find(phrase)
            if phrase_pos != -1:
                # Find the next sentence end after the phrase
                sentence_end = message.find('.', phrase_pos)
                if sentence_end != -1:
                    # Keep everything after the sentence end
                    message = message[sentence_end + 1:].strip()
                    # Capitalize first letter
                    if message:
                        message = message[0].upper() + message[1:]
    
    return message

@app.route('/')
def index():
    # Generate a unique session ID if not exists
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    
    return render_template('index.html')

@app.route('/api/start_conversation', methods=['GET'])
def start_conversation():
    """Generate an opening message to start the conversation"""
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'error': 'Session not found'}), 400
        
    bot_session = get_bot_session(session_id)
    bots = bot_session['bots']
    
    # Generate opening message from the Debate Partner
    opening_message = bots['partner'].respond(
        "SYSTEM: Begin the debate immediately with a highly controversial, provocative statement "
        "about one of these sensitive topics: immigration, national identity, EU sovereignty, "
        "multiculturalism, or traditional values. Use strong, emotional language that will "
        "guarantee a strong reaction. Be uncompromising and bold. Do NOT include: "
        "- Any form of greeting or introduction "
        "- Any meta-commentary about the conversation "
        "- Any qualifying language or hedging "
        "Start with your most controversial position stated as absolute truth."
    )
    
    # Clean up the response to remove any remaining introductions
    opening_message = self_clean_message(opening_message)
    
    # Update message count
    bot_session['message_count'] = 1
    bot_session['topic'] = "Immigration and National Identity"  # Default starting topic
    
    return jsonify({
        'opening_message': opening_message,
        'message_count': bot_session['message_count'],
        'topic': bot_session['topic']
    })

@app.route('/api/send_message', methods=['POST'])
def send_message():
    data = request.get_json()
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400
    
    # Get the bot session for this user
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({'error': 'Session not found'}), 400
        
    bot_session = get_bot_session(session_id)
    bots = bot_session['bots']
    message_count = bot_session['message_count']
    topic = bot_session['topic']
    
    # We'll only return bot responses, not the user message
    responses = []
    
    try:
        # Partner responds with provocative counter-arguments
        partner_response = bots['partner'].respond(
            f"User challenges you with: '{user_message}' | "
            "Respond with a highly provocative, uncompromising counter-argument. "
            "Use emotional language, attack their position vigorously, and double down on your controversial stance. "
            "Do not concede any points - become more assertive in response to criticism."
        )
        partner_response = self_clean_message(partner_response)
        responses.append({'sender': 'Debate Partner', 'message': partner_response, 'type': 'partner'})
        message_count += 1
        
        # Check for topic switch (every 6 exchanges)
        if message_count % 6 == 0:
            topic = bots['partner'].respond(
                "SYSTEM: The debate is getting repetitive. Introduce a NEW controversial topic "
                "related to current political issues. Format: 'New angle: [controversial topic]'"
            )
            topic = self_clean_message(topic).split("New angle: ")[-1].strip()
            bot_session['topic'] = topic
        
        # Moderators interject (every 3 turns) - only if debate is heated
        if message_count % 3 == 0 and any(word in user_message.lower() for word in ['wrong', 'false', 'ridiculous', 'stupid', 'ignorant']):
            phil_comment = bots['philosopher'].respond(
                f"Heated exchange: User: '{user_message}' -> Partner: '{partner_response}'\n"
                "Provide concise philosophical context about why this debate is so polarized and emotionally charged."
            )
            phil_comment = self_clean_message(phil_comment)
            responses.append({'sender': 'Philosopher Moderator', 'message': phil_comment, 'type': 'moderator'})
        
        # Moderators interject (every 5 turns) - psychological analysis of heated debate
        if message_count % 5 == 0:
            psych_comment = bots['psychologist'].respond(
                f"Psychological analysis needed for this exchange:\n"
                f"USER (typically more liberal/progressive): '{user_message}'\n"
                f"DEBATE PARTNER (conservative/nationalist): '{partner_response}'\n"
                "Provide concise psychological analysis of BOTH participants' cognitive patterns and emotional dynamics. "
                "Focus on what psychological needs and biases are driving each position."
            )
            psych_comment = self_clean_message(psych_comment)
            responses.append({'sender': 'Psychologist Moderator', 'message': psych_comment, 'type': 'moderator'})
        
        # Update message count
        bot_session['message_count'] = message_count
        
        return jsonify({
            'responses': responses, 
            'message_count': message_count, 
            'topic': topic
        })
        
    except Exception as e:
        print(f"Error processing message: {e}")
        return jsonify({
            'error': 'Failed to process message',
            'responses': [{'sender': 'System', 'message': 'Sorry, there was an error processing your message.', 'type': 'system'}]
        }), 500

@app.route('/api/generate_speech', methods=['POST'])
def generate_speech():
    """Generate speech audio for a given text"""
    data = request.get_json()
    text = data.get('text', '')
    sender = data.get('sender', '')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        # Determine language and voice parameters based on sender
        if sender == 'Debate Partner':
            lang = 'en'  # German accent for the debate partner
            tld = 'com'   # German domain for TTS
        else:
            lang = 'en'  # English for moderators
            tld = 'com'  # Default domain
        
        # Generate speech using gTTS
        tts = gTTS(text=text, lang=lang, tld=tld, slow=False)
        
        # Save to bytes buffer
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convert to base64 for sending to frontend
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
        return jsonify({
            'audio': audio_base64,
            'mime_type': 'audio/mpeg'
        })
        
    except Exception as e:
        print(f"Error generating speech: {e}")
        return jsonify({'error': 'Failed to generate speech'}), 500

@app.route('/api/reset', methods=['POST'])
def reset_conversation():
    """Reset the conversation and clear bot memories"""
    session_id = session.get('session_id')
    if session_id and session_id in bot_sessions:
        # Create new bots for this session
        bot_sessions[session_id] = {
            'bots': initialize_bots(),
            'message_count': 0,
            'topic': "Political ideologies and perspectives"
        }
        return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error', 'message': 'Session not found'}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)