import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, X } from 'lucide-react';
import { Button } from './ui/button';
import { voiceService } from '../services/voiceService';

interface FirstInteractionPromptProps {
  isVisible: boolean;
  onDismiss: () => void;
  currentLanguage: 'en' | 'de';
}

const FirstInteractionPrompt: React.FC<FirstInteractionPromptProps> = ({
  isVisible,
  onDismiss,
  currentLanguage
}) => {
  const handleEnableVoice = () => {
    voiceService.setUserInteracted();
    onDismiss();
    
    // Play a welcome message
    const welcomeText = currentLanguage === 'en' 
      ? 'Voice features are now enabled. Welcome to the debate!' 
      : 'Sprachfunktionen sind jetzt aktiviert. Willkommen zur Debatte!';
    
    voiceService.speakText(welcomeText, 'System', currentLanguage).catch(console.error);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm z-50"
        >
          <div className="flex items-start gap-3">
            <Volume2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">
                {currentLanguage === 'en' ? 'Enable Voice Features' : 'Sprachfunktionen aktivieren'}
              </h3>
              <p className="text-sm mb-3">
                {currentLanguage === 'en' 
                  ? 'Click to enable voice responses and audio playback' 
                  : 'Klicken Sie, um Sprachantworten und Audiowiedergabe zu aktivieren'}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEnableVoice}
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  {currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-white hover:bg-blue-700"
                >
                  {currentLanguage === 'en' ? 'Not now' : 'Später'}
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-6 w-6 text-white hover:bg-blue-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FirstInteractionPrompt;