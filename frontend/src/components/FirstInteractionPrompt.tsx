import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, X } from 'lucide-react';
import { voiceService } from '../services/voiceService';

interface Props {
  isVisible: boolean;
  onDismiss: () => void;
  currentLanguage: 'en' | 'de';
}

export default function FirstInteractionPrompt({ isVisible, onDismiss, currentLanguage }: Props) {
  const handleEnable = () => {
    voiceService.setUserInteracted();
    onDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          className="fixed bottom-20 right-4 z-40 max-w-xs w-full mx-4 rounded-2xl p-4 shadow-2xl"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(99,130,255,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            right: 'clamp(0.75rem, 3vw, 1.5rem)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-glow)' }}
            >
              <Volume2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-fluid-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
              </p>
              <p className="text-fluid-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                {currentLanguage === 'en'
                  ? 'Hear the debate partner respond aloud'
                  : 'Hören Sie den Diskussionspartner laut antworten'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  className="flex-1 py-1.5 rounded-lg text-fluid-xs font-semibold"
                  style={{
                    background: `linear-gradient(135deg, var(--user-from), var(--user-to))`,
                    color: 'white',
                  }}
                >
                  {currentLanguage === 'en' ? 'Enable' : 'Aktivieren'}
                </button>
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 rounded-lg text-fluid-xs font-medium"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
                >
                  {currentLanguage === 'en' ? 'Later' : 'Später'}
                </button>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
