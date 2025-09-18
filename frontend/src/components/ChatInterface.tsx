import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Send, 
  Menu,
  Info,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  AlertCircle,
  Loader2
} from 'lucide-react';

import { cn } from '../lib/utils';
import { getTranslatedText } from '../lib/language';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ToastProvider, useToast } from './ui/toast';
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

interface ErrorState {
  hasError: boolean;
  errorMessage?: string;
  errorType?: 'network' | 'api' | 'voice' | 'validation' | 'unknown';
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorState {
    return { hasError: true, errorMessage: 'Something went wrong' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatInterface error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="text-center p-6 bg-white rounded-lg shadow-lg">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">Please refresh the page to continue the conversation.</p>
            <Button onClick={() => window.location.reload()} variant="destructive">
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false });
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPlayedMessageId = useRef<string>('');
  const isInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const toast = useToast();

  // Safe screen size detection
  const checkScreenSize = useCallback(() => {
    try {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    } catch (error) {
      console.error('Error checking screen size:', error);
      setIsMobile(false);
      setIsTablet(false);
    }
  }, []);

  // Safe localStorage access
  const safeLocalStorage = {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn('localStorage access failed:', error);
        return null;
      }
    },
    setItem: (key: string, value: string): boolean => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn('localStorage set failed:', error);
        return false;
      }
    }
  };

  // Check if user has interacted and set up voice service
  useEffect(() => {
    try {
      checkScreenSize();
      window.addEventListener('resize', checkScreenSize);
      
      const storedInteraction = safeLocalStorage.getItem('userHasInteracted');
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
    } catch (error) {
      console.error('Error in initial setup:', error);
      setErrorState({ 
        hasError: true, 
        errorMessage: 'Failed to initialize chat', 
        errorType: 'unknown' 
      });
    }
  }, [checkScreenSize]);

  const handleDismissPrompt = () => {
    setShowFirstInteractionPrompt(false);
    setHasUserInteracted(true);
    safeLocalStorage.setItem('userHasInteracted', 'true');
    voiceService.setUserInteracted();
  };

  const isDuplicateMessage = (newMessage: Message, existingMessages: Message[]): boolean => {
    try {
      return existingMessages.some(msg => 
        msg.message === newMessage.message && 
        msg.sender === newMessage.sender &&
        Math.abs(msg.timestamp.getTime() - newMessage.timestamp.getTime()) < 5000
      );
    } catch (error) {
      console.warn('Error checking for duplicate messages:', error);
      return false;
    }
  };

  const playMessageWithRetry = async (message: Message, retries = 2): Promise<boolean> => {
    if (!message || !message.message || typeof message.message !== 'string') {
      console.warn('Invalid message format for voice playback:', message);
      return false;
    }

    if (message.type !== 'partner' || 
        message.message.includes('Language switched') ||
        message.message.includes('Sprache auf Deutsch')) {
      return false;
    }

    // Stop any currently playing audio before starting new one
    try {
      voiceService.stop();
    } catch (error) {
      console.warn('Error stopping previous audio:', error);
    }

    for (let i = 0; i < retries; i++) {
      try {
        if (voiceService.hasUserInteracted && voiceService.hasUserInteracted()) {
          await voiceService.speakText(message.message, message.sender, message.language);
          return true;
        }
        break;
      } catch (error) {
        console.error(`Voice playback attempt ${i + 1} failed:`, error);
        if (i === retries - 1) {
          toast?.toast({
            title: 'Voice playback failed',
            description: 'Could not play the message audio',
            variant: 'destructive'
          });
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
      }
    }
    return false;
  };

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  // Handle voice playback for new messages
  useEffect(() => {
    const debouncedPlayMessage = debounce(async () => {
      if (voiceEnabled && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || !lastMessage.message || typeof lastMessage.message !== 'string') {
          return;
        }
        
        if (lastMessage.type !== 'user' && 
            !lastMessage.message.includes('Language switched') &&
            !lastMessage.message.includes('Sprache auf Deutsch')) {
          if (hasUserInteracted && lastMessage.id !== lastPlayedMessageId.current) {
            lastPlayedMessageId.current = lastMessage.id;
            await playMessageWithRetry(lastMessage);
          }
        }
      }
    }, 100);

    debouncedPlayMessage();
  }, [state.messages, voiceEnabled, hasUserInteracted, state.currentLanguage]);

  const handleEnableVoice = useCallback(() => {
    try {
      setHasUserInteracted(true);
      voiceService.setUserInteracted();
      safeLocalStorage.setItem('userHasInteracted', 'true');
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
          }, index * 2000);
        });
      }
    } catch (error) {
      console.error('Error enabling voice:', error);
      toast?.toast({
        title: 'Voice activation failed',
        description: 'Could not enable voice features',
        variant: 'destructive'
      });
    }
  }, [state.messages, toast]);

  // Set up user interaction detection for voice service
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteracted) {
        try {
          voiceService.setUserInteracted();
          setHasUserInteracted(true);
          safeLocalStorage.setItem('userHasInteracted', 'true');
        } catch (error) {
          console.error('Error handling user interaction:', error);
        }
      }
    };

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

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth'
      });
    } catch (error) {
      console.warn('Error scrolling to bottom:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  const validateMessage = (message: Message): boolean => {
    try {
      return (
        message &&
        typeof message.id === 'string' &&
        typeof message.sender === 'string' &&
        typeof message.message === 'string' &&
        typeof message.type === 'string' &&
        message.timestamp instanceof Date &&
        !isNaN(message.timestamp.getTime())
      );
    } catch (error) {
      console.error('Message validation failed:', error);
      return false;
    }
  };

  const initializeConversation = async () => {
    if (initializationInProgress.current || isInitialized.current) {
      return;
    }

    initializationInProgress.current = true;
    setIsLoading(true);
    setState(prev => ({ ...prev, isThinking: true, isGeneratingRecommendations: true }));
    
    try {
      const response = await startConversation(state.currentLanguage);
      
      if (!response || !response.opening_message) {
        throw new Error('Invalid response from server');
      }

      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'Debate Partner',
        message: response.opening_message,
        type: 'partner',
        timestamp: new Date(),
        language: state.currentLanguage
      };

      if (!validateMessage(newMessage)) {
        throw new Error('Invalid message format received');
      }

      setState(prev => {
        const filteredMessages = prev.messages.filter(msg => 
          !isDuplicateMessage(newMessage, prev.messages)
        );
        return {
          ...prev,
          messages: [...filteredMessages, newMessage],
          messageCount: response.message_count || 0,
          currentTopic: response.topic || 'Political ideologies and perspectives',
          isThinking: false,
          recommendedAnswers: response.recommended_answers || [],
          isGeneratingRecommendations: false
        };
      });

      isInitialized.current = true;
      
      if (!hasUserInteracted) {
        setIsWaitingForInteraction(true);
      }
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setErrorState({ 
        hasError: true, 
        errorMessage: 'Failed to start conversation', 
        errorType: 'api' 
      });
      toast?.toast({
        title: 'Connection Error',
        description: 'Could not start the conversation. Please try again.',
        variant: 'destructive'
      });
    } finally {
      initializationInProgress.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitialized.current) {
      initializeConversation();
    }
  }, []);

  const handleLanguageChange = (newLanguage: "en" | "de") => {
    try {
      setState((prev) => ({
        ...prev,
        currentLanguage: newLanguage,
      }));
    } catch (error) {
      console.error('Error changing language:', error);
      toast?.toast({
        title: 'Language change failed',
        description: 'Could not switch language',
        variant: 'destructive'
      });
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    
    if (!textToSend || state.isThinking) return;
    
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      voiceService.setUserInteracted();
      safeLocalStorage.setItem('userHasInteracted', 'true');
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      message: textToSend,
      type: 'user',
      timestamp: new Date(),
      language: state.currentLanguage
    };

    if (!validateMessage(userMessage)) {
      toast?.toast({
        title: 'Invalid message',
        description: 'Please enter a valid message',
        variant: 'destructive'
      });
      return;
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true,
      recommendedAnswers: []
    }));

    setInputText('');

    try {
      const response = await sendMessage(textToSend, state.currentLanguage);
      
      if (!response || !response.responses) {
        throw new Error('Invalid response from server');
      }

      const botResponses: Message[] = response.responses.map((res: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        sender: res.sender || 'Debate Partner',
        message: res.message || '',
        type: res.type || 'partner',
        timestamp: new Date(),
        language: state.currentLanguage
      }));

      // Validate all bot responses
      const validResponses = botResponses.filter(validateMessage);

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, ...validResponses],
        messageCount: response.message_count || prev.messageCount,
        currentTopic: response.topic || prev.currentTopic,
        isThinking: false,
        recommendedAnswers: response.recommended_answers || []
      }));

    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ ...prev, isThinking: false }));
      toast?.toast({
        title: 'Message failed',
        description: 'Could not send your message. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleRecommendedAnswerSelect = (answer: string) => {
    try {
      handleSendMessage(answer);
    } catch (error) {
      console.error('Error selecting recommended answer:', error);
    }
  };

  const handleReset = async () => {
    setState(prev => ({ ...prev, isThinking: true, isGeneratingRecommendations: true }));
    try {
      await resetConversation();
      initializeConversation();
    } catch (error) {
      console.error('Failed to reset conversation:', error);
      toast?.toast({
        title: 'Reset failed',
        description: 'Could not reset the conversation',
        variant: 'destructive'
      });
    }
  };

  const handleVoiceToggle = () => {
    try {
      setVoiceEnabled(!voiceEnabled);
      if (!voiceEnabled && !hasUserInteracted) {
        setHasUserInteracted(true);
        voiceService.setUserInteracted();
        safeLocalStorage.setItem('userHasInteracted', 'true');
      }
    } catch (error) {
      console.error('Error toggling voice:', error);
    }
  };

  if (errorState.hasError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{errorState.errorMessage}</p>
          <Button onClick={() => window.location.reload()} variant="destructive">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Starting conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
                      {voiceEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
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
                      "flex-1",
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
    </ErrorBoundary>
  );
};

export default ChatInterface;