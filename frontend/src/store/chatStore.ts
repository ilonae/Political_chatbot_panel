import { create } from 'zustand';
import { Message, RecommendedAnswer } from '../types/Chat';

interface ChatStore {
  // ── State ──────────────────────────────────────────────────────
  messages: Message[];
  isThinking: boolean;
  currentTopic: string;
  currentLanguage: 'en' | 'de';
  recommendedAnswers: RecommendedAnswer[];
  isGeneratingRecommendations: boolean;
  voiceEnabled: boolean;
  hasUserInteracted: boolean;
  showFirstInteractionPrompt: boolean;

  // ── Actions ────────────────────────────────────────────────────
  addMessage: (message: Message) => void;
  appendToken: (id: string, token: string) => void;
  setThinking: (value: boolean) => void;
  setTopic: (topic: string) => void;
  setLanguage: (language: 'en' | 'de') => void;
  setRecommendedAnswers: (answers: RecommendedAnswer[]) => void;
  setGeneratingRecommendations: (value: boolean) => void;
  toggleVoice: () => void;
  setUserInteracted: () => void;
  dismissFirstInteractionPrompt: () => void;
  resetMessages: () => void;
  getMessage: (id: string) => Message | undefined;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isThinking: false,
  currentTopic: 'Political ideologies and perspectives',
  currentLanguage: 'en',
  recommendedAnswers: [],
  isGeneratingRecommendations: false,
  voiceEnabled: true,
  hasUserInteracted: false,
  showFirstInteractionPrompt: true,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, message: m.message + token } : m
      ),
    })),

  setThinking: (value) => set({ isThinking: value }),

  setTopic: (topic) => set({ currentTopic: topic }),

  setLanguage: (language) => set({ currentLanguage: language }),

  setRecommendedAnswers: (answers) => set({ recommendedAnswers: answers }),

  setGeneratingRecommendations: (value) =>
    set({ isGeneratingRecommendations: value }),

  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

  setUserInteracted: () =>
    set({ hasUserInteracted: true, showFirstInteractionPrompt: false }),

  dismissFirstInteractionPrompt: () =>
    set({ showFirstInteractionPrompt: false, hasUserInteracted: true }),

  resetMessages: () =>
    set({
      messages: [],
      recommendedAnswers: [],
      isThinking: false,
      currentTopic: 'Political ideologies and perspectives',
    }),

  getMessage: (id) => get().messages.find((m) => m.id === id),
}));
