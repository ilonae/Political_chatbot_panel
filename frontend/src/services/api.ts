import { StartConversationResponse } from '../types/Chat';

// Falls back to localhost:8000 for local dev outside Docker
export const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:8000';

const DEFAULT_TIMEOUT = 120000; // 120 seconds — local LLM on CPU needs time

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

const retryableFetch = async (
  url: string, 
  options: RequestInit, 
  retries = 2, 
  backoff = 300
): Promise<Response> => {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error) {
    // No retry on timeout — timeout means the model is genuinely overloaded, and retrying will only add more load
    if (retries > 0 &&
        (error instanceof TypeError ||
         (error instanceof Error && error.message.includes('Failed to fetch')))) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return retryableFetch(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const sendMessageStream = async (
  message: string,
  language: 'en' | 'de' = 'en',
  onToken: (token: string) => void,
  onDone: (data: { recommended_answers: any[]; topic: string }) => void,
  onError: (err: Error) => void,
): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/message/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language, session_id: 'default' }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token) onToken(data.token);
          if (data.done) onDone({ recommended_answers: data.recommended_answers ?? [], topic: data.topic ?? '' });
        } catch {
          console.warn('Failed to parse stream line:', line);
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error('Stream failed'));
  } finally {
    clearTimeout(timeoutId);
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

