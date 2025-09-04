// Type definitions for our chat application

interface Message {
    sender: string;
    message: string;
    type: 'user' | 'partner' | 'moderator' | 'system';
    timestamp?: Date;
}

interface SendMessageResponse {
    responses: Message[];
    message_count: number;
    topic: string;
}

interface ChatState {
    messages: Message[];
    isThinking: boolean;
    currentTopic: string;
    messageCount: number;
}

// API client types
interface ApiClient {
    sendMessage(message: string): Promise<SendMessageResponse>;
    resetConversation(): Promise<void>;
}