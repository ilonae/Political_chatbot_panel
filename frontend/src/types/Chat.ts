export interface Message {
    id: string;
    sender: string;
    message: string;
    type: 'user' | 'partner' | 'moderator' | 'system';
    timestamp: Date;
  }
  
  export interface ChatState {
    messages: Message[];
    isThinking: boolean;
    currentTopic: string;
    messageCount: number;
  }
  
  export interface ApiResponse {
    responses: Omit<Message, 'id'>[];
    message_count: number;
    topic: string;
  }