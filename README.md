
# Section 1: Introduction - Political AI Chatbot Panel 🤖💬

This is a WIP for an exhibition about fascism - incorporating a GPT-based discussion partner for user interaction, while two moderators (philosopher and psychologist) analyze the interaction - all using the OpenAI API. Served with Flask and rendering a web GUI using React and Typescript, the application enables user-friendly web-based interaction (incorporating VoiceOver).

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚀 Features

- **Multi-Bot System**: Debate Partner, Philosopher Moderator, and Psychologist Moderator
- **Voice Synthesis**: Text-to-speech with different voices for each bot
- **Real-time Interaction**: Web-based chat interface
- **Session Management**: Persistent conversation memory
- **Responsive Design**: Works on desktop, tablet, and mobile

# Section 2: Architecture

- **Backend**: Python, Flask, LangChain, OpenAI API
- **Frontend**: HTML5, CSS3, JavaScript
- **Text-to-Speech**: gTTS (Google Text-to-Speech)
- **Deployment**: Docker, Gunicorn, Nginx

# Section 3: Installation

```bash
# Clone the repository
git clone https://github.com/ilonae/Political_AI_chatbot_Interaction.git

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your OpenAI API key

# Run the application
python src/app.py
```

# Section 4: Usage

1. Start the server: python src/app.py
2. Open your browser to http://localhost:5000
3. The Debate Partner will initiate the conversation
4. Respond to engage in a political debate
5. Moderators will interject with analysis periodically

# Section 5: Results

# Section 6: Contributing

We welcome contributions! Please see our [Contribution Guidelines](CONTRIBUTION.md) for details 

# Section 7: Acknowledgments

- OpenAI GPT API
- Google Text-to-Speech voice synthesis
- LangChain conversation memory management
