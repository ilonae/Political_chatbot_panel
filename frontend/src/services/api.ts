import { ApiResponse, StartConversationResponse, RecommendedAnswer } from '../types/Chat';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const generateRecommendedAnswers = async (
  userInput: string, 
  conversationHistory: string, 
  language: 'en' | 'de' = 'en'
): Promise<{ recommended_answers: RecommendedAnswer[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/chat/generate_recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      user_input: userInput,
      conversation_history: conversationHistory,
      language,
      session_id: 'default'  
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Server error response:', errorText);
    throw new Error(`Failed to generate recommended answers: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export const sendMessage = async (message: string, language: 'en' | 'de' = 'en'): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      message, 
      language,
      session_id: 'default'  
    }),
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const responseData = await response.json();
  
  return {
    responses: [{
      sender: 'Debate Partner',
      message: responseData.response,
      type: 'partner'
    }],
    message_count: responseData.message_count,
    topic: responseData.topic,
    recommended_answers: responseData.recommended_answers || []
  };
};

export const startConversation = async (language: 'en' | 'de' = 'en'): Promise<StartConversationResponse>  => {
  const response = await fetch(`${API_BASE_URL}/api/chat/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      language,
      session_id: 'default'  
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to start conversation');
  }

  return response.json();
};

export const resetConversation = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/chat/reset?session_id=default`, { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to reset conversation');
  }
};

export const generateSpeech = async (text: string, sender: string, language: 'en' | 'de' = 'en') => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/generate_speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        language,
        sender
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate speech');
    }
    const audioData = await response.arrayBuffer();
    return { audioData };
  } catch (error) {
    console.error('Speech generation error:', error);
    throw error;
  }
};