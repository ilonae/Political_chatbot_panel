import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, RefreshCw, Send, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useChatActions } from '../hooks/useChatActions';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { voiceService } from '../services/voiceService';
import { getTranslatedText } from '../lib/language';
import { cn } from '../lib/utils';
import ChatBubble from './ChatBubble';
import ThinkingIndicator from './ThinkingIndicator';
import LanguageToggle from './LanguageToggle';
import RecommendedAnswers from './RecommendedAnswers';
import FirstInteractionPrompt from './FirstInteractionPrompt';

export default function ChatInterface() {
  const store = useChatStore();
  const { initializeConversation, sendMessage, resetChat } = useChatActions();
  const backendStatus = useBackendHealth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem('userHasInteracted')) {
      store.setUserInteracted();
      voiceService.setUserInteracted();
    }
    initializeConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages]);

  useEffect(() => {
    if (store.hasUserInteracted) return;
    const handler = () => enableVoice();
    const events = ['click', 'keydown', 'touchstart'] as const;
    events.forEach(e => document.addEventListener(e, handler, { once: true }));
    return () => events.forEach(e => document.removeEventListener(e, handler));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hasUserInteracted]);

  const enableVoice = () => {
    store.setUserInteracted();
    voiceService.setUserInteracted();
    localStorage.setItem('userHasInteracted', 'true');
  };

  const handleSubmit = (text?: string) => {
    const msg = text ?? inputText.trim();
    if (!msg) return;
    setInputText('');
    sendMessage(msg);
    inputRef.current?.focus();
  };

  if (store.isThinking && store.messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-dvh" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-fluid-base font-medium" style={{ color: 'var(--text-secondary)' }}>
            {store.currentLanguage === 'de' ? 'Gespräch wird gestartet…' : 'Starting conversation…'}
          </p>
        </div>
      </div>
    );
  }

  const offline = backendStatus === 'offline';

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--bg)' }}>

      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-fluid-xs font-medium overflow-hidden"
            style={{ background: 'var(--error-bg)', borderBottom: '1px solid var(--error-border)', color: 'var(--error)' }}
          >
            <WifiOff className="w-3.5 h-3.5" />
            {store.currentLanguage === 'de'
              ? 'Backend nicht erreichbar — starte das Backend und lade neu'
              : 'Backend unreachable — start the backend and refresh'}
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="flex items-center justify-between px-3 sm:px-5 safe-top"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          minHeight: 'clamp(52px, 7vh, 64px)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99,130,255,0.3)' }}
          >
            <span className="text-fluid-sm" role="img" aria-label="debate">⚡</span>
          </div>
          <h1 className="font-semibold truncate text-fluid-base" style={{ color: 'var(--text-primary)' }}>
            {getTranslatedText('Confronting Fascism: An AI Dialogue', store.currentLanguage)}
          </h1>
  
          {backendStatus !== 'checking' && (
            <span
              title={offline ? 'Backend offline' : 'Backend connected'}
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: offline ? 'var(--error)' : '#22c55e',
                boxShadow: offline ? '0 0 6px var(--error)' : '0 0 6px #22c55e88',
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <LanguageToggle
            currentLanguage={store.currentLanguage}
            onLanguageChange={store.setLanguage}
          />

          <button
            onClick={() => { if (!store.hasUserInteracted) enableVoice(); store.toggleVoice(); }}
            title={store.currentLanguage === 'en' ? 'Toggle voice' : 'Stimme umschalten'}
            className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center',
              !store.hasUserInteracted && 'ring-2 ring-[var(--accent)] animate-pulse'
            )}
            style={{
              background: store.voiceEnabled ? 'rgba(99,130,255,0.12)' : 'transparent',
              color: store.voiceEnabled ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {store.voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={resetChat}
            title={getTranslatedText('Reset conversation', store.currentLanguage)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>
      {store.currentTopic && (
        <div
          className="px-3 sm:px-5 py-1.5 text-center truncate"
          style={{
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.04em',
          }}
        >
          {getTranslatedText(store.currentTopic, store.currentLanguage)}
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 sm:gap-3 px-3 sm:px-5 py-4 max-w-3xl mx-auto w-full">
          <AnimatePresence mode="popLayout">
            {store.messages.map(msg => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <ChatBubble message={msg} currentLanguage={store.currentLanguage} />
              </motion.div>
            ))}
          </AnimatePresence>

          {store.isThinking && <ThinkingIndicator language={store.currentLanguage} />}

          {store.messages.length > 0 && !store.isThinking && (
            <RecommendedAnswers
              answers={store.recommendedAnswers}
              onAnswerSelect={handleSubmit}
              isLoading={store.isGeneratingRecommendations}
              language={store.currentLanguage}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <div
        className="px-3 sm:px-5 py-3 safe-bottom"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}
      >
        <form
          onSubmit={e => { e.preventDefault(); handleSubmit(); }}
          className="flex gap-2 items-center max-w-3xl mx-auto w-full"
        >
          <input
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={store.isThinking || offline}
            placeholder={
              offline
                ? (store.currentLanguage === 'de' ? 'Backend offline…' : 'Backend offline…')
                : getTranslatedText('Type your response...', store.currentLanguage)
            }
            className="flex-1 rounded-xl px-4 py-2.5 text-fluid-base outline-none"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${offline ? 'var(--error-border)' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              caretColor: 'var(--accent)',
              opacity: offline ? 0.6 : 1,
            }}
            onFocus={e => { if (!offline) e.target.style.borderColor = 'rgba(99,130,255,0.4)'; }}
            onBlur={e => { e.target.style.borderColor = offline ? 'var(--error-border)' : 'var(--border)'; }}
          />
          <motion.button
            type="submit"
            disabled={store.isThinking || !inputText.trim() || offline}
            whileTap={{ scale: 0.93 }}
            className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 'clamp(40px, 6vw, 44px)',
              height: 'clamp(40px, 6vw, 44px)',
              background: store.isThinking || !inputText.trim() || offline
                ? 'var(--bg-elevated)'
                : 'linear-gradient(135deg, var(--user-from), var(--user-to))',
              boxShadow: store.isThinking || !inputText.trim() || offline
                ? 'none'
                : '0 4px 15px var(--user-glow)',
              color: store.isThinking || !inputText.trim() || offline
                ? 'var(--text-muted)'
                : 'white',
              transition: 'all 0.2s ease',
            }}
          >
            {store.isThinking
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </motion.button>
        </form>
      </div>

      <FirstInteractionPrompt
        isVisible={store.showFirstInteractionPrompt}
        onDismiss={() => { enableVoice(); store.dismissFirstInteractionPrompt(); }}
        currentLanguage={store.currentLanguage}
      />
      <AnimatePresence>
        {!store.hasUserInteracted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={enableVoice}
          >
            <motion.div
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-8 max-w-sm w-full text-center"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(99,130,255,0.2)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99,130,255,0.25)' }}
              >
                <Volume2 className="w-7 h-7" style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="text-fluid-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {store.currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
              </h3>
              <p className="text-fluid-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {store.currentLanguage === 'en'
                  ? 'Tap to hear the debate partner respond aloud'
                  : 'Tippen Sie, um den Diskussionspartner laut zu hören'}
              </p>
              <button
                onClick={enableVoice}
                className="w-full py-3 rounded-xl text-fluid-base font-semibold"
                style={{
                  background: 'linear-gradient(135deg, var(--user-from), var(--user-to))',
                  color: 'white',
                  boxShadow: '0 4px 20px var(--user-glow)',
                }}
              >
                {store.currentLanguage === 'en' ? 'Enable Voice' : 'Stimme aktivieren'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
