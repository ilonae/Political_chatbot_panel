import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Send, 
  User, 
  MessageSquare, 
  Brain, 
  Settings,
  Menu,
  Info,
  Smartphone,
  Tablet,
  Monitor
} from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Toast, ToastProvider } from './ui/toast';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';

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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024); // Specifically detect tablets
    };
  
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'nearest'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

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

  useEffect(() => {
    initializeConversation();
  }, []);

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
      const newMessages: Message[] = response.responses.map(res => ({
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
    <TooltipProvider>
      <ToastProvider>
        <div className="flex flex-col h-screen bg-background">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Chat Settings</SheetTitle>
                    <SheetDescription>
                      Configure your debate experience
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-2">
                      {isMobile && <Smartphone className="h-4 w-4" />}
                      {isTablet && <Tablet className="h-4 w-4" />}
                      {!isMobile && !isTablet && <Monitor className="h-4 w-4" />}
                      <span className="text-sm text-muted-foreground">
                        {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'} view
                      </span>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <h1 className="text-xl font-semibold text-foreground">
                Confronting Fascism: An AI Dialogue
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex">
                <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  {state.currentTopic}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {voiceEnabled ? 'Mute voice' : 'Unmute voice'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset conversation</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Messages Area */}
          <main className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence mode="popLayout">
              {state.messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                >
                  <ChatBubble 
                    message={message} 
                    isMobile={isMobile}
                    isTablet={isTablet} // Pass the tablet prop
                  />
                </motion.div>
              ))}
              </AnimatePresence>

              {state.isThinking && <ThinkingIndicator isMobile={isMobile} isTablet={isTablet} />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}

<div className="p-4 border-t bg-white">
  <div className="bg-gradient-to-r from-blue-50 to-gray-50 rounded-2xl p-4 shadow-lg">
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        handleSendMessage();
      }}
      className="flex gap-3 items-end"
    >
      <Input
        placeholder="Type your response..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={state.isThinking}
        className={cn(
          "flex-1 border-2 border-gray-300 rounded-2xl px-5 py-4 font-medium",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
          isMobile ? "text-lg" : isTablet ? "text-2xl" : "text-xl",
          isMobile ? "h-12" : isTablet ? "h-16" : "h-14"
        )}
      />
      <Button
        type="submit"
        disabled={state.isThinking || !inputText.trim()}
        size={isTablet ? "lg" : "default"}
        className={cn(
          "rounded-2xl font-bold shadow-lg",
          "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
          "disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-500",
          isMobile ? "h-12 w-12" : isTablet ? "h-16 w-16" : "h-14 w-14"
        )}
      >
        <Send className={cn(isTablet ? "h-6 w-6" : "h-5 w-5")} />
      </Button>
    </form>
  </div>
</div>

          </main>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
};

export default ChatInterface;