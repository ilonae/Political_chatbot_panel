export interface Message {
    id: string;
    sender: string;
    message: string;
    type: 'user' | 'partner' | 'moderator' | 'system';
    timestamp: Date;
    language?: 'en' | 'de'; 
  }
  
  export interface ChatState {
    messages: Message[];
    isThinking: boolean;
    currentTopic: string;
    messageCount: number;
    currentLanguage: 'en' | 'de'; 
  }
  
  export interface ApiResponse {
    responses: Omit<Message, 'id'>[];
    message_count: number;
    topic: string;
  }
  export type SenderType = 'user' | 'partner' | 'moderator' | 'system';