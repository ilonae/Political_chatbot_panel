import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Send, 
  Settings,
  Menu,
  Info,
  Smartphone,
  Tablet,
  Monitor,
  Globe
} from 'lucide-react';

import { cn } from '../lib/utils';
import { getTranslatedText } from '../lib/language';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ToastProvider } from './ui/toast';
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
import LanguageToggle from './LanguageToggle';
import RecommendedAnswers from './RecommendedAnswers';
import { Message, ChatState } from '../types/Chat';
import { sendMessage, startConversation, resetConversation } from '../services/api';
import VoiceSettingsPanel from './VoiceSettingsPanel';
import { voiceService } from '../services/voiceService';
import FirstInteractionPrompt from './FirstInteractionPrompt';

const ChatInterface: React.FC = () => {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isThinking: false,
    currentTopic: 'Political ideologies and perspectives',
    messageCount: 0,
    currentLanguage: 'en',
    recommendedAnswers: [],
    isGeneratingRecommendations: false
  });
  const [showFirstInteractionPrompt, setShowFirstInteractionPrompt] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isFirstMessagePlayed, setIsFirstMessagePlayed] = useState(false);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPlayedMessageId = useRef<string>('');

  // Check if user has interacted and set up voice service
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    const storedInteraction = localStorage.getItem('userHasInteracted');
    if (storedInteraction) {
      setHasUserInteracted(true);
      voiceService.setUserInteracted();
    } else {
      setShowFirstInteractionPrompt(true);
    }
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
      voiceService.stop();
    };
  }, []);

  const handleDismissPrompt = () => {
    setShowFirstInteractionPrompt(false);
    setHasUserInteracted(true);
    localStorage.setItem('userHasInteracted', 'true');
    voiceService.setUserInteracted();
  };

  // Function to play message with retry mechanism
  const playMessageWithRetry = async (message: Message, retries = 2) => {
    console.log('Attempting to play message:', message.id, message.type);
    if (message.type !== 'partner' || 
        message.message.includes('Language switched') ||
        message.message.includes('Sprache auf Deutsch')) {
          console.log('Skipping message - not a partner message or system message');

      return false;
    }

    if (!voiceEnabled) {
      console.log('Skipping message - voice disabled');
      return false;
    } 
    if (!hasUserInteracted) {
      console.log('Skipping message - user not interacted yet');
      return false;
    } 

    voiceService.stop();
    console.log('Stopped any previous audio');

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Play attempt ${i + 1} for message:`, message.id);
        await voiceService.speakText(message.message, message.sender, message.language);
        console.log('Successfully played message:', message.id);
        return true;
      } catch (error) {
        console.error(`Voice playback attempt ${i + 1} failed:`, error);
      }
    }
    console.error('All playback attempts failed for message:', message.id);
    return false;
  };

  // Handle voice playback for new messages
  useEffect(() => {
    const playMessageAudio = async () => {
      if (voiceEnabled && hasUserInteracted && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        
        // Don't play voice for user messages or system messages about language
        if (lastMessage.type !== 'user' && 
            !lastMessage.message.includes('Language switched') &&
            !lastMessage.message.includes('Sprache auf Deutsch')) {

            try {
              await playMessageWithRetry(lastMessage);
          } catch (error) {
            console.error('Failed to play message audio:', error);
          }
        }
      }
    };

    if (state.messages.length > 0 && hasUserInteracted) {
      const lastMessage = state.messages[state.messages.length - 1];
      
      if (lastMessage.id !== lastPlayedMessageId.current && 
        lastMessage.type !== 'user' ) {
      lastPlayedMessageId.current = lastMessage.id;
      playMessageAudio();
    }
    }
  }, [state.messages, voiceEnabled, hasUserInteracted, state.currentLanguage]);

  const handleEnableVoice = useCallback(() => {
    console.log('User interaction detected - enabling voice');
    setHasUserInteracted(true);
    voiceService.setUserInteracted();
    localStorage.setItem('userHasInteracted', 'true');
    setIsWaitingForInteraction(false);

    const unplayedMessages = state.messages.filter(msg => 
      msg.type === 'partner' && 
      !msg.message.includes('Language switched') &&
      !msg.message.includes('Sprache auf Deutsch')
      );
      if (unplayedMessages.length > 0) {
      unplayedMessages.forEach((message, index) => {
        setTimeout(() => {
          voiceService.speakText(
            message.message, 
            message.sender, 
            message.language as 'en' | 'de'
          ).catch(error => {
            console.error('Failed to play message:', error);
          });
        }, index * 2000); // 2-second delay between messages
      });
    }
  }, [hasUserInteracted, state.messages, isFirstMessagePlayed]);

  // Set up user interaction detection for voice service
  useEffect(() => {
    const handleUserInteraction = () => {
    voiceService.setUserInteracted();
    setHasUserInteracted(true);
    };

    // Only add listeners if user hasn't interacted yet
    if (!hasUserInteracted) {
      const events = ['click', 'keydown', 'touchstart', 'mousedown'];
      
      events.forEach(event => {
        document.addEventListener(event, handleUserInteraction, { once: true });
      });

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleUserInteraction);
        });
      };
    }
  }, [hasUserInteracted]);

  // Function to play message with retry mechanism
  // Removed duplicate declaration of playMessageWithRetry

  // Handle voice playback for new messages
  useEffect(() => {
    const playMessageAudio = async () => {
      if (voiceEnabled && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
  
        // Don't play voice for user messages or system messages about language
        if (
          lastMessage.type !== 'user' &&
          !lastMessage.message.includes('Language switched') &&
          !lastMessage.message.includes('Sprache auf Deutsch') &&
          hasUserInteracted
        ) {
          const success = await playMessageWithRetry(lastMessage);
          if (!success) {
            console.error('Failed to play message audio after retries.');
          }
        }
      }
    };
  
    playMessageAudio();
  }, [state.messages, voiceEnabled]);

  // Set up user interaction detection for voice service
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteracted) {
        console.log('User interaction detected - enabling voice.');
        setHasUserInteracted(true);
        voiceService.setUserInteracted();
        localStorage.setItem('userHasInteracted', 'true');
      }
    };
  
    if (!hasUserInteracted) {
      const events = ['click', 'keydown', 'touchstart', 'mousedown'];
      events.forEach(event => document.addEventListener(event, handleUserInteraction, { once: true }));
  
      return () => {
        events.forEach(event => document.removeEventListener(event, handleUserInteraction));
      };
    }
  }, [hasUserInteracted]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  const initializeConversation = async () => {
    setState(prev => ({ ...prev, isThinking: true, isGeneratingRecommendations: true }));
    try {
      console.log('Starting conversation in language:', state.currentLanguage);
      const response = await startConversation(state.currentLanguage);
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'Debate Partner',
        message: response.opening_message,
        type: 'partner',
        timestamp: new Date(),
        language: state.currentLanguage
      };
      
      setState(prev => ({
        ...prev,
        messages: [newMessage],
        messageCount: response.message_count,
        currentTopic: response.topic,
        isThinking: false,
        recommendedAnswers: response.recommended_answers || [],
        isGeneratingRecommendations: false
      }));

      if (!hasUserInteracted) {
        setIsWaitingForInteraction(true);
      }
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      const fallbackMessages = {
        en: "Welcome! I'm ready to discuss political topics. What would you like to talk about?",
        de: "Willkommen! Ich bin bereit, über politische Themen zu diskutieren. Worüber möchten Sie sprechen?"
      };
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'Debate Partner',
        message: fallbackMessages[state.currentLanguage],
        type: 'partner',
        timestamp: new Date(),
        language: state.currentLanguage
      };
      setState(prev => ({
        ...prev,
        messages: [newMessage],
        messageCount: 1,
        currentTopic: state.currentLanguage === 'en' ? 'Political Discussion' : 'Politische Diskussion',
        isThinking: false
      }));
    }
  };

  useEffect(() => {
    initializeConversation();
  }, []);

  const handleLanguageChange = (newLanguage: "en" | "de") => {
      setState((prev) => ({
        ...prev,
        currentLanguage: newLanguage,
      }));
      console.log(`Language changed to: ${newLanguage}`);
    };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    console.log('Sending message:', textToSend);
    
    if (!textToSend || state.isThinking) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      message: textToSend,
      type: 'user',
      timestamp: new Date(),
      language: state.currentLanguage
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true,
      recommendedAnswers: []
    }));

    setInputText('');

    try {
      const response = await sendMessage(textToSend, state.currentLanguage);
      console.log('API response:', response);
      
      const botMessage: Message = {
        id: Date.now().toString() + Math.random(),
        sender: 'Debate Partner',
        message: response.message,
        type: 'partner',
        timestamp: new Date(),
        language: state.currentLanguage
      };  
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, botMessage],
        messageCount: response.message_count,
        currentTopic: response.topic,
        isThinking: false,
        recommendedAnswers: response.recommended_answers || []
      }));

      // Play the bot message immediately after it's added to state
      if (voiceEnabled && hasUserInteracted) {
        setTimeout(() => {
          playMessageWithRetry(botMessage).catch(console.error);
        }, 100);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleRecommendedAnswerSelect = (answer: string) => {
    handleSendMessage(answer);
  };

  const handleReset = async () => {
    setState(prev => ({ ...prev, isThinking: true, isGeneratingRecommendations: true  }));
    try {
      await resetConversation();
      initializeConversation();
    } catch (error) {
      console.error('Failed to reset conversation:', error);
    }
  };

  const handleVoiceToggle = () => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled && !hasUserInteracted) {
      setHasUserInteracted(true);
      voiceService.setUserInteracted();
      localStorage.setItem('userHasInteracted', 'true');
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
                    <SheetTitle>{getTranslatedText('Chat Settings', state.currentLanguage)}</SheetTitle>
                    <SheetDescription>
                      {getTranslatedText('Configure your debate experience', state.currentLanguage)}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-2">
                      {isMobile && <Smartphone className="h-4 w-4" />}
                      {isTablet && <Tablet className="h-4 w-4" />}
                      {!isMobile && !isTablet && <Monitor className="h-4 w-4" />}
                      <span className="text-sm text-muted-foreground">
                        {getTranslatedText(
                          isMobile ? 'Mobile view' : isTablet ? 'Tablet view' : 'Desktop view',
                          state.currentLanguage
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="text-sm text-muted-foreground">
                        {state.currentLanguage === 'en' ? 'Voice' : 'Stimme'}: 
                        <span className="font-semibold ml-1">
                          {voiceEnabled 
                            ? (state.currentLanguage === 'en' ? 'Enabled' : 'Aktiviert') 
                            : (state.currentLanguage === 'en' ? 'Disabled' : 'Deaktiviert')}
                        </span>
                      </span>
                    </div>
                    {!hasUserInteracted && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Info className="h-4 w-4" />
                        <span className="text-sm">
                          {state.currentLanguage === 'en' 
                            ? 'Click anywhere to enable voice' 
                            : 'Klicken Sie irgendwo, um die Stimme zu aktivieren'}
                        </span>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <h1 className="text-xl font-semibold text-foreground">
                {getTranslatedText('Confronting Fascism: An AI Dialogue', state.currentLanguage)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex">
                <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
                  {getTranslatedText(state.currentTopic, state.currentLanguage)}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <LanguageToggle
                      currentLanguage={state.currentLanguage}
                      onLanguageChange={handleLanguageChange}
                      isMobile={isMobile}
                      isTablet={isTablet}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {getTranslatedText('Switch language (EN/DE)', state.currentLanguage)}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEnableVoice}
                    className={!hasUserInteracted ? "bg-blue-100 animate-pulse" : ""}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!hasUserInteracted 
                    ? (state.currentLanguage === 'en' ? 'Click to enable voice' : 'Klicken Sie zum Aktivieren')
                    : (state.currentLanguage === 'en' ? 'Voice enabled' : 'Stimme aktiviert')}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleVoiceToggle}
                    disabled={!hasUserInteracted}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {voiceEnabled 
                    ? getTranslatedText('Mute voice', state.currentLanguage)
                    : getTranslatedText('Unmute voice', state.currentLanguage)
                  }
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {getTranslatedText('Reset conversation', state.currentLanguage)}
                </TooltipContent>
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
                      isTablet={isTablet}
                      currentLanguage={state.currentLanguage}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Recommended Answers */}
              {state.messages.length > 0 && (
                <RecommendedAnswers
                  answers={state.recommendedAnswers}
                  onAnswerSelect={handleRecommendedAnswerSelect}
                  isLoading={state.isGeneratingRecommendations}
                  language={state.currentLanguage}
                />
              )}

              {state.isThinking && (
                <ThinkingIndicator 
                  isMobile={isMobile} 
                  isTablet={isTablet}
                  language={state.currentLanguage}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-white">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-3 items-end"
              >
                <Input
                  placeholder={getTranslatedText("Type your response...", state.currentLanguage)}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={state.isThinking}
                  className={cn(
                    "flex-1 border-2 border-gray-300 rounded-2xl px-5 py-4 font-medium",
                    "focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
                    isMobile ? "text-lg" : isTablet ? "text-2xl" : "text-xl"
                  )}
                />
                <Button
                  type="submit"
                  disabled={state.isThinking || !inputText.trim()}
                  size={isTablet ? "lg" : "default"}
                  className={cn(
                    "rounded-2xl font-bold shadow-lg",
                    "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
                    "disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-500"
                  )}
                >
                  <Send className={cn(isTablet ? "h-6 w-6" : "h-5 w-5")} />
                </Button>
              </form>
            </div>
          </main>

          {/* Voice Settings Panel */}
          <VoiceSettingsPanel
            isOpen={isVoiceSettingsOpen}
            onClose={() => setIsVoiceSettingsOpen(false)}
            currentLanguage={state.currentLanguage}
          />

          {/* First Interaction Prompt */}
          <FirstInteractionPrompt
            isVisible={showFirstInteractionPrompt}
            onDismiss={handleDismissPrompt}
            currentLanguage={state.currentLanguage}
          />

          {/* Interaction Overlay */}
          {!hasUserInteracted && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-40 cursor-pointer"
              onClick={handleEnableVoice}
            >
              <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
                <Volume2 className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                <h3 className="text-lg font-semibold mb-2">
                  {state.currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
                </h3>
                {isWaitingForInteraction ? (
                  <>
                <p className="text-gray-600 mb-4">
                  {state.currentLanguage === 'en' 
                    ? 'Click anywhere to enable voice responses' 
                    : 'Klicken Sie irgendwo, um Sprachantworten zu aktivieren'}
                </p>
                        <div className="flex items-center justify-center mb-4">
                    <div className="animate-bounce">
                      <Volume2 className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-600 mb-4">
                  {state.currentLanguage === 'en' 
                    ? 'Click anywhere to enable voice responses' 
                    : 'Klicken Sie irgendwo, um Sprachantworten zu aktivieren'}
                </p>
              )}
                <Button onClick={handleEnableVoice}>
                  {state.currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
};

export default ChatInterface;