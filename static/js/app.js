// Text-to-Speech Service
class TextToSpeech {
    constructor() {
        this.audioElement = document.getElementById('speech-audio');
        this.isEnabled = document.getElementById('voice-enabled').checked;
        this.volume = document.getElementById('volume-control').value;
        this.rate = document.getElementById('rate-control').value;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('voice-enabled').addEventListener('change', (e) => {
            this.isEnabled = e.target.checked;
        });
        
        document.getElementById('volume-control').addEventListener('input', (e) => {
            this.volume = e.target.value;
            this.audioElement.volume = this.volume;
        });
        
        document.getElementById('rate-control').addEventListener('input', (e) => {
            this.rate = e.target.value;
        });
        
        document.getElementById('stop-voice').addEventListener('click', () => {
            this.stop();
        });
    }
    
    async speak(text, sender) {
        if (!this.isEnabled || sender === 'You' || sender === 'System') {
            return; // Don't speak user messages or system messages
        }
        
        try {
            await this.speakWithServerTTS(text, sender);
        } catch (error) {
            console.error('Error with text-to-speech:', error);
        }
    }
    
    async speakWithServerTTS(text, sender) {
        try {
            const response = await fetch('/api/generate_speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: text,
                    sender: sender
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Convert base64 to audio
                const audioSrc = `data:${data.mime_type};base64,${data.audio}`;
                this.audioElement.src = audioSrc;
                this.audioElement.volume = this.volume;
                this.audioElement.playbackRate = this.rate;
                
                // Play the audio
                await this.audioElement.play();
            }
        } catch (error) {
            console.error('Error with server TTS:', error);
        }
    }
    
    stop() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
    }
}

// Main application class
class ChatApp {
    constructor() {
        this.state = {
            messages: [],
            isThinking: true, // Start with thinking indicator for the initial message
            currentTopic: "Political ideologies and perspectives",
            messageCount: 0,
            pendingUserMessage: null
        };
        
        this.tts = new TextToSpeech();
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.render();
        
        // Start the conversation with a message from the bot
        await this.startConversation();
    }
    
    async startConversation() {
        try {
            const response = await fetch('/api/start_conversation');
            if (response.ok) {
                const data = await response.json();
                
                this.addMessage({
                    sender: "Debate Partner",
                    message: data.opening_message,
                    type: "partner"
                });
                
                this.setState({
                    messageCount: data.message_count,
                    currentTopic: data.topic,
                    isThinking: false
                });
            } else {
                throw new Error('Failed to start conversation');
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
            // If there's an error, just enable the input without a system message
            this.setState({ isThinking: false });
        }
    }
    
    setupEventListeners() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const resetButton = document.getElementById('reset-button');
        
        // Send message on button click
        sendButton.addEventListener('click', () => this.handleSendMessage());
        
        // Send message on Enter key
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSendMessage();
            }
        });
        
        // Reset conversation
        resetButton.addEventListener('click', () => this.resetConversation());
    }
    
    async handleSendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message || this.state.isThinking) return;
        
        // Clear input
        messageInput.value = '';
        
        // Store the pending user message but don't add it to the chat yet
        this.setState({ 
            pendingUserMessage: {
                sender: "You",
                message: message,
                type: "user"
            },
            isThinking: true 
        });
        
        try {
            const response = await this.apiSendMessage(message);
            
            if (response.error) {
                // If there's an error, add the user message with an error response
                this.addMessage(this.state.pendingUserMessage);
                this.addMessage({
                    sender: "System",
                    message: response.error,
                    type: "system"
                });
                this.setState({ 
                    isThinking: false,
                    pendingUserMessage: null 
                });
            } else {
                // Add the pending user message first
                this.addMessage(this.state.pendingUserMessage);
                
                // Then add all bot responses
                response.responses.forEach(msg => {
                    this.addMessage(msg);
                });
                
                // Update state
                this.setState({
                    messageCount: response.message_count,
                    currentTopic: response.topic,
                    isThinking: false,
                    pendingUserMessage: null
                });
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            // Add the pending user message with an error response
            this.addMessage(this.state.pendingUserMessage);
            this.addMessage({
                sender: "System",
                message: "Sorry, there was an error processing your message. Please try again.",
                type: "system"
            });
            this.setState({ 
                isThinking: false,
                pendingUserMessage: null 
            });
        }
    }
    
    async apiSendMessage(message) {
        const response = await fetch('/api/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async resetConversation() {
        try {
            const response = await fetch('/api/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // Clear local state
                this.setState({
                    messages: [],
                    messageCount: 0,
                    currentTopic: "Political ideologies and perspectives",
                    pendingUserMessage: null,
                    isThinking: true
                });
                
                // Stop any ongoing speech
                this.tts.stop();
                
                // Start a new conversation
                await this.startConversation();
            } else {
                this.addMessage({
                    sender: "System",
                    message: "Failed to reset conversation. Please refresh the page.",
                    type: "system"
                });
            }
            
        } catch (error) {
            console.error('Error resetting conversation:', error);
            this.addMessage({
                sender: "System",
                message: "Error resetting conversation. Please try again.",
                type: "system"
            });
        }
    }
    
    addMessage(message) {
        // Add timestamp if not present
        if (!message.timestamp) {
            message.timestamp = new Date();
        }
        
        // Update state
        this.setState({
            messages: [...this.state.messages, message]
        });
        
        // Speak the message if it's from a bot
        if (message.sender !== 'You' && message.sender !== 'System') {
            this.tts.speak(message.message, message.sender);
        }
    }
    
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }
    
    render() {
        this.renderMessages();
        this.renderTopic();
        this.renderThinkingIndicator();
        this.updateInputState();
    }
    
    renderMessages() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        this.state.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = message.sender + ':';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message.message;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = this.formatTime(message.timestamp);
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeSpan);
        
        return messageDiv;
    }
    
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    renderTopic() {
        const topicElement = document.getElementById('current-topic');
        if (topicElement) {
            topicElement.textContent = this.state.currentTopic;
        }
    }
    
    renderThinkingIndicator() {
        const thinkingIndicator = document.getElementById('thinking-indicator');
        if (thinkingIndicator) {
            thinkingIndicator.style.display = this.state.isThinking ? 'flex' : 'none';
        }
    }
    
    updateInputState() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        if (messageInput && sendButton) {
            if (this.state.isThinking) {
                messageInput.disabled = true;
                sendButton.disabled = true;
                messageInput.placeholder = "Please wait...";
            } else {
                messageInput.disabled = false;
                sendButton.disabled = false;
                messageInput.placeholder = "Type your response here...";
            }
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});