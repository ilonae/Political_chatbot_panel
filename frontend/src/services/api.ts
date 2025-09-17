import { StartConversationResponse, RecommendedAnswer } from '../types/Chat';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Add timeout configuration
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Enhanced fetch wrapper with timeout and error handling
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = DEFAULT_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

// Generic error handler
const handleApiError = async (response: Response, defaultMessage: string): Promise<never> => {
  let errorDetails = '';
  
  try {
    const errorText = await response.text();
    errorDetails = errorText;
    console.error('Server error response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      details: errorText
    });
  } catch (parseError) {
    console.error('Failed to parse error response:', parseError);
  }

  throw new Error(`${defaultMessage}: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
};

// Retry mechanism for transient errors
const retryableFetch = async (
  url: string, 
  options: RequestInit, 
  retries = 2, 
  backoff = 300
): Promise<Response> => {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error) {
    if (retries > 0 && 
        (error instanceof TypeError || // Network errors
         (error instanceof Error && error.message.includes('timeout')) ||
         (error instanceof Error && error.message.includes('Failed to fetch')))) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return retryableFetch(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const generateRecommendedAnswers = async (
  userInput: string, 
  conversationHistory: string, 
  language: 'en' | 'de' = 'en'
): Promise<{ recommended_answers: RecommendedAnswer[] }> => {
  try {
    const response = await retryableFetch(`${API_BASE_URL}/api/chat/generate_recommendations`, {
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
      return handleApiError(response, 'Failed to generate recommended answers');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Generate recommendations error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const sendMessage = async (message: string, language: 'en' | 'de' = 'en'): Promise<any> => {
  try {
    const response = await retryableFetch(`${API_BASE_URL}/api/chat/message`, {
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
      return handleApiError(response, 'Failed to send message');
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
  } catch (error) {
    console.error('Send message error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const startConversation = async (language: 'en' | 'de' = 'en'): Promise<StartConversationResponse>  => {
  try {
    const response = await retryableFetch(`${API_BASE_URL}/api/chat/start`, {
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
      return handleApiError(response, 'Failed to start conversation');
    }

    return response.json();
  } catch (error) {
    console.error('Start conversation error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const resetConversation = async (): Promise<void> => {
  try {
    const response = await retryableFetch(`${API_BASE_URL}/api/chat/reset?session_id=default`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return handleApiError(response, 'Failed to reset conversation');
    }
  } catch (error) {
    console.error('Reset conversation error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateSpeech = async (text: string, sender: string, language: 'en' | 'de' = 'en') => {
  try {
    const response = await retryableFetch(`${API_BASE_URL}/api/chat/generate_speech`, {
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
      return handleApiError(response, 'Failed to generate speech');
    }
    
    const audioData = await response.arrayBuffer();
    return { audioData };
  } catch (error) {
    console.error('Speech generation error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};