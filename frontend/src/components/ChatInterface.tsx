import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  AppBar,
  Toolbar,
  Typography,
  Chip
} from '@mui/material';
import { 
  VolumeUp, 
  VolumeOff, 
  Refresh, 
  Send,
  Person,
  QuestionAnswer,
  Psychology,
  Settings
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import ChatBubble from './ChatBubble';
import ThinkingIndicator from './ThinkingIndicator';
import { Message, ChatState } from '../types/Chat';
import { sendMessage, startConversation, resetConversation } from '../services/api';

const ChatInterface: React.FC = () => {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isThinking: false,
    currentTopic: 'Political ideologies and perspectives',
    messageCount: 0
  });
  const [inputText, setInputText] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  useEffect(() => {
    initializeConversation();
  }, []);

  const getAvatarIcon = (sender: string) => {
    switch (sender) {
      case 'You':
        return <Person />;
      case 'Debate Partner':
        return <QuestionAnswer />;
      case 'Philosopher Moderator':
      case 'Psychologist Moderator':
        return <Psychology />;
      default:
        return <Settings />;
    }
  };

  const initializeConversation = async () => {
    setState(prev => ({ ...prev, isThinking: true }));
    try {
      const response = await startConversation();
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'Debate Partner',
        message: response.opening_message,
        type: 'partner',
        timestamp: new Date()
      };
      setState(prev => ({
        ...prev,
        messages: [newMessage],
        messageCount: response.message_count,
        currentTopic: response.topic,
        isThinking: false
      }));
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setState(prev => ({ ...prev, isThinking: false }));
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || state.isThinking) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      message: inputText.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true
    }));
    setInputText('');

    try {
      const response = await sendMessage(inputText.trim());
      const newMessages: Message[] = response.responses.map((res:any) => ({
        id: Date.now().toString() + Math.random(),
        ...res,
        timestamp: new Date()
      }));

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, ...newMessages],
        messageCount: response.message_count,
        currentTopic: response.topic,
        isThinking: false
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: 'System',
        message: 'Sorry, there was an error processing your message.',
        type: 'system',
        timestamp: new Date()
      };
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isThinking: false
      }));
    }
  };

  const handleReset = async () => {
    setState(prev => ({ ...prev, isThinking: true }));
    try {
      await resetConversation();
      initializeConversation();
    } catch (error) {
      console.error('Failed to reset conversation:', error);
      setState(prev => ({ ...prev, isThinking: false }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Political Debate Panel
          </Typography>
          <Chip 
            label={state.currentTopic} 
            color="secondary" 
            size="small" 
            sx={{ mr: 2 }}
          />
          <IconButton
            color="inherit"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
          >
            {voiceEnabled ? <VolumeUp /> : <VolumeOff />}
          </IconButton>
          <IconButton color="inherit" onClick={handleReset}>
            <Refresh />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, bgcolor: 'grey.50' }}>
        <AnimatePresence>
          {state.messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChatBubble message={message} />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {state.isThinking && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </Box>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your response..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={state.isThinking}
            multiline
            maxRows={3}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={state.isThinking || !inputText.trim()}
            sx={{ alignSelf: 'flex-end' }}
          >
            <Send />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatInterface;