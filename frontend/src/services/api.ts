import axios from 'axios';
import { ApiResponse } from '../types/Chat';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const startConversation = async () => {
  const response = await api.get('/api/start_conversation');
  return response.data;
};

export const sendMessage = async (message: string) => {
  const response = await api.post('/api/send_message', { message });
  return response.data;
};

export const resetConversation = async () => {
  const response = await api.post('/api/reset');
  return response.data;
};

export const generateSpeech = async (text: string, sender: string) => {
  const response = await api.post('/api/generate_speech', { text, sender });
  return response.data;
};