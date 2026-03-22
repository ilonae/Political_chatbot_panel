import { useCallback, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { sendMessageStream, startConversation, resetConversation } from '../services/api';
import { voiceService } from '../services/voiceService';
import { Message } from '../types/Chat';

const ERROR_MSG = {
  en: {
    backend: "Can't reach the server. Make sure the backend is running and try again.",
    stream:  'Something went wrong. Please try again.',
  },
  de: {
    backend: 'Der Server ist nicht erreichbar. Stelle sicher, dass das Backend läuft.',
    stream:  'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
  },
};

function isNetworkError(err: unknown) {
  return (
    err instanceof TypeError ||
    (err instanceof Error && (
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('ERR_CONNECTION_REFUSED') ||
      err.message.includes('timeout')
    ))
  );
}

export function useChatActions() {
  const store = useChatStore();
  const isInitialized  = useRef(false);
  const initInProgress = useRef(false);

  const addErrorMessage = useCallback((text: string) => {
    const msg: Message = {
      id: `${Date.now()}-error`,
      sender: 'Debate Partner',
      message: text,
      type: 'partner',
      timestamp: new Date(),
      language: store.currentLanguage,
    };
    store.addMessage(msg);
  }, [store]);

  const initializeConversation = useCallback(async () => {
    if (isInitialized.current || initInProgress.current) return;
    initInProgress.current = true;
    store.setThinking(true);
    store.setGeneratingRecommendations(true);

    try {
      const response = await startConversation(store.currentLanguage);

      const opening: Message = {
        id: Date.now().toString(),
        sender: 'Debate Partner',
        message: response.opening_message,
        type: 'partner',
        timestamp: new Date(),
        language: store.currentLanguage,
      };

      store.addMessage(opening);
      store.setTopic(response.topic ?? store.currentTopic);
      store.setRecommendedAnswers(response.recommended_answers ?? []);
      isInitialized.current = true;

      if (store.voiceEnabled && store.hasUserInteracted) {
        voiceService.speakText(opening.message, opening.sender, store.currentLanguage);
      }
    } catch (err) {
      console.error('initializeConversation failed:', err);
      const lang = store.currentLanguage;
      addErrorMessage(
        isNetworkError(err)
          ? ERROR_MSG[lang].backend
          : ERROR_MSG[lang].stream
      );
    } finally {
      store.setThinking(false);
      store.setGeneratingRecommendations(false);
      initInProgress.current = false;
    }
  }, [store, addErrorMessage]);


  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || store.isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'You',
      message: text,
      type: 'user',
      timestamp: new Date(),
      language: store.currentLanguage,
    };
    store.addMessage(userMsg);
    store.setThinking(true);
    store.setRecommendedAnswers([]);

    const botId = `${Date.now()}-bot`;
    const botMsg: Message = {
      id: botId,
      sender: 'Debate Partner',
      message: '',
      type: 'partner',
      timestamp: new Date(),
      language: store.currentLanguage,
    };
    store.addMessage(botMsg);

    try {
      await sendMessageStream(
        text,
        store.currentLanguage,
        (token) => store.appendToken(botId, token),
        ({ recommended_answers, topic }) => {
          const completed = store.getMessage(botId);
          if (store.voiceEnabled && store.hasUserInteracted && completed?.message) {
            voiceService.speakText(completed.message, 'Debate Partner', store.currentLanguage);
          }
          store.setThinking(false);
          store.setRecommendedAnswers(recommended_answers ?? []);
          if (topic) store.setTopic(topic);
        },
        (err) => {
          console.error('Stream error:', err);
          const lang = store.currentLanguage;
          const errText = isNetworkError(err)
            ? ERROR_MSG[lang].backend
            : ERROR_MSG[lang].stream;
          store.appendToken(botId, errText);
          store.setThinking(false);
        }
      );
    } catch (err) {
      console.error('sendMessage outer error:', err);
      store.setThinking(false);
    }
  }, [store]);

  /* ── Reset ─────────────────────────────────────────────────── */
  const resetChat = useCallback(async () => {
    store.setThinking(true);
    try {
      await resetConversation();
    } catch (err) {
      console.warn('Reset endpoint failed (continuing anyway):', err);
    } finally {
      store.resetMessages();
      isInitialized.current  = false;
      initInProgress.current = false;
      await initializeConversation();
    }
  }, [store, initializeConversation]);

  return { initializeConversation, sendMessage, resetChat };
}
