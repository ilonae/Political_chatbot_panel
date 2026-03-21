import React from 'react';
import { motion } from 'framer-motion';
import { User, MessageSquare, Brain, Settings, AlertCircle } from 'lucide-react';
import { Message } from '../types/Chat';
import { getTranslatedText } from '../lib/language';

interface ChatBubbleProps {
  message: Message;
  isMobile?: boolean;
  isTablet?: boolean;
  currentLanguage?: 'en' | 'de';
}

interface ErrorState {
  hasError: boolean;
  errorMessage?: string;
}

const cn = (...classes: (string | boolean | undefined)[]): string => {
  try {
    return classes.filter(Boolean).join(' ');
  } catch (error) {
    console.error('Error in className concatenation:', error);
    return '';
  }
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatBubble error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded my-2">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Message failed to display</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isMobile = false, 
  isTablet = false, 
  currentLanguage = 'en'  
}) => {
  const [translatedSender, setTranslatedSender] = React.useState(message.sender);
  const [translationError, setTranslationError] = React.useState(false);

  React.useEffect(() => {
    const translateSender = async () => {
      try {
        const translated = getTranslatedText(message.sender, currentLanguage);
        setTranslatedSender(translated);
        setTranslationError(false);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedSender(message.sender);
        setTranslationError(true);
      }
    };

    translateSender();
  }, [message.sender, currentLanguage]);

  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  const getAvatarIcon = () => {
    try {
      switch (message.sender) {
        case 'You':
          return <User className={cn("h-5 w-5", isTablet && "h-6 w-6")} />;
        case 'Debate Partner':
          return <MessageSquare className={cn("h-5 w-5", isTablet && "h-6 w-6")} />;
        case 'Philosopher Moderator':
        case 'Psychologist Moderator':
          return <Brain className={cn("h-5 w-5", isTablet && "h-6 w-6")} />;
        default:
          return <Settings className={cn("h-5 w-5", isTablet && "h-6 w-6")} />;
      }
    } catch (error) {
      console.error('Error getting avatar icon:', error);
      return <Settings className={cn("h-5 w-5", isTablet && "h-6 w-6")} />;
    }
  };

  const getBubbleStyle = (): string => {
    try {
      switch (message.type) {
        case 'user':
          return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg';
        case 'partner':
          return 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg';
        case 'moderator':
          return 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg';
        case 'system':
          return 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-800 shadow-md';
        default:
          return 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-md';
      }
    } catch (error) {
      console.error('Error getting bubble style:', error);
      return 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-md';
    }
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      
      if (isNaN(date.getTime())) {
        throw new Error('Invalid timestamp');
      }

      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '--:--';
    }
  };

  if (!message || typeof message !== 'object') {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded my-2">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span>Invalid message data</span>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <ErrorBoundary>
        <motion.div
          className="flex justify-center my-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className={cn(
            "px-4 py-2 rounded-full font-semibold shadow-md max-w-xs",
            getBubbleStyle(),
            isMobile ? "text-base" : isTablet ? "text-xl" : "text-lg"
          )}>
            {message.message || 'No message content'}
          </div>
        </motion.div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <motion.div
        className={cn(
          "flex mb-5 w-full",
          isUser ? 'justify-end' : 'justify-start'
        )}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className={cn(
          "flex",
          isUser ? 'flex-row-reverse' : 'flex-row',
          isMobile ? 'max-w-[85%]' : isTablet ? 'max-w-[65%]' : 'max-w-[60%]'
        )}>
          {/* Avatar */}
          <div className={cn(
            "rounded-full flex items-center justify-center shadow-md flex-shrink-0",
            isUser ? 'bg-blue-500 text-white ml-2' : 'bg-gray-200 text-gray-600 mr-2',
            isMobile ? 'w-8 h-8' : isTablet ? 'w-12 h-12' : 'w-10 h-10',
            isMobile && 'hidden'
          )}>
            {getAvatarIcon()}
          </div>

          {/* Message Content */}
          <div className="flex flex-col gap-2 flex-1">
            <span className={cn(
              "font-bold px-2 tracking-wide",
              isUser ? 'text-right' : 'text-left',
              isMobile ? 'text-sm' : isTablet ? 'text-lg' : 'text-base',
              translationError && 'text-red-500'
            )}>
              {translatedSender}
              {translationError && ' (Original)'}
            </span>
            
            {/* Shiny Chat Bubble */}
            <motion.div
              className={cn(
                "relative px-5 py-3 rounded-3xl overflow-hidden shiny-bubble bubble-glow",
                getBubbleStyle(),
                isUser ? 'rounded-br-md user-bubble-glow' : 'rounded-bl-md'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Shiny overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-30"></div>
              
              {/* Glossy shine effect */}
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent opacity-20"></div>
              
              <p className={cn(
                "font-semibold leading-snug relative z-10 break-words",
                isMobile ? 'text-lg' : isTablet ? 'text-2xl' : 'text-xl'
              )}>
                {message.message || 'No message content available'}
              </p>
            </motion.div>

            <span className={cn(
              "text-gray-500 px-2 font-medium",
              isUser ? 'text-right' : 'text-left',
              isMobile ? 'text-xs' : isTablet ? 'text-base' : 'text-sm'
            )}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </motion.div>
    </ErrorBoundary>
  );
};

export default ChatBubble;