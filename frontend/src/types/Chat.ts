export interface RecommendedAnswer {
  text: string;
  id: string;
}

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
    recommendedAnswers: RecommendedAnswer[]; 
    isGeneratingRecommendations: boolean; 
  }
  
  export interface ApiResponse {
    responses: Omit<Message, 'id'>[];
    message_count: number;
    topic: string;
    recommended_answers?: RecommendedAnswer[];
  }

  export interface StartConversationResponse {
    opening_message: string;
    session_id: string;
    message_count: number;
    topic: string;
    language: 'en' | 'de';
    recommended_answers?: RecommendedAnswer[];
  }
  export type SenderType = 'user' | 'partner' | 'moderator' | 'system';