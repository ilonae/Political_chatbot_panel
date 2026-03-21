// This service is no longer used — TTS is handled by the browser
// Web Speech API via browserVoiceService. Stub kept to satisfy TypeScript.
export const openaiVoiceService = {
  speakText: async () => {},
  stop: () => {},
  isSupported: () => false,
};
