import axios from 'axios';
import { ApiResponse } from '../types/Chat';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sendMessage = async (message: string, language: 'en' | 'de' = 'en') => {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
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

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
};

export const startConversation = async (language: 'en' | 'de' = 'en') => {
  const response = await fetch(`${API_BASE_URL}/chat/start`, {
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

export const resetConversation = async () => {
  const response = await fetch(`${API_BASE_URL}/api/chat/reset`, { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: 'default' }),
  });

  if (!response.ok) {
    throw new Error('Failed to reset conversation');
  }

  return response.json();
};

export const generateSpeech = async (text: string, sender: string) => {
  const response = await api.post('/api/generate_speech', { text, sender });
  return response.data;
};