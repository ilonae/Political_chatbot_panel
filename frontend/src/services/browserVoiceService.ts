export interface BrowserVoiceSettings {
    rate?: number;
    pitch?: number;
    volume?: number;
  }
  
  export class BrowserVoiceService {
    private static instance: BrowserVoiceService;
    private synthesis: SpeechSynthesis;
    private isPlaying = false;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
  
    static getInstance(): BrowserVoiceService {
      if (!BrowserVoiceService.instance) {
        BrowserVoiceService.instance = new BrowserVoiceService();
      }
      return BrowserVoiceService.instance;
    }
  
    constructor() {
      this.synthesis = window.speechSynthesis;
    }
  
    getAvailableVoices(): SpeechSynthesisVoice[] {
      return this.synthesis.getVoices();
    }
  
    getVoiceForLanguage(language: 'en' | 'de'): SpeechSynthesisVoice | null {
      const voices = this.getAvailableVoices();
      const langCode = language === 'de' ? 'de-DE' : 'en-US';
      
      // Try to find a native voice for the language
      const nativeVoice = voices.find(voice => 
        voice.lang === langCode && voice.localService
      );
      
      if (nativeVoice) return nativeVoice;
      
      // Fallback to any voice that supports the language
      const fallbackVoice = voices.find(voice => 
        voice.lang.startsWith(language === 'de' ? 'de' : 'en')
      );
      
      return fallbackVoice || null;
    }
  
    async speakText(text: string, language: 'en' | 'de' = 'en'): Promise<void> {
      if (this.isPlaying) {
        this.stop();
      }
  
      return new Promise((resolve, reject) => {
        if (!this.isSupported()) {
          reject(new Error('Browser speech synthesis not supported'));
          return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
          reject(new Error('Cannot play audio in background tab'));
          return;
        }
  
        // Wait for voices to load if needed
        if (this.getAvailableVoices().length === 0) {
          this.synthesis.addEventListener('voiceschanged', () => {
            this.speakText(text, language).then(resolve).catch(reject);
          }, { once: true });
          return;
        }
  
        this.isPlaying = true;
        
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
  
        // Set language
        utterance.lang = language === 'de' ? 'de-DE' : 'en-US';
        
        // Try to get an appropriate voice
        const voice = this.getVoiceForLanguage(language);
        if (voice) {
          utterance.voice = voice;
        }
  
        // Set speech properties for better quality
        utterance.rate = 0.9; // Slightly slower for better comprehension
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
  
        utterance.onend = () => {
          this.isPlaying = false;
          this.currentUtterance = null;
          resolve();
        };
  
        utterance.onerror = (event) => {
          this.isPlaying = false;
          this.currentUtterance = null;
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
  
        this.synthesis.speak(utterance);
      });
    }
  
    stop(): void {
      if (this.synthesis.speaking) {
        this.synthesis.cancel();
      }
      this.isPlaying = false;
      this.currentUtterance = null;
    }
  
    isSupported(): boolean {
      return 'speechSynthesis' in window;
    }
  
    getStatus(): string {
      if (!this.isSupported()) return 'not-supported';
      if (this.isPlaying) return 'playing';
      return 'ready';
    }
  
    // Helper method to check if a specific language is supported
    isLanguageSupported(language: 'en' | 'de'): boolean {
      if (!this.isSupported()) return false;
      
      const voices = this.getAvailableVoices();
      const langPrefix = language === 'de' ? 'de' : 'en';
      return voices.some(voice => voice.lang.startsWith(langPrefix));
    }
  
    // Get available languages
    getAvailableLanguages(): string[] {
      if (!this.isSupported()) return [];
      
      const voices = this.getAvailableVoices();
      const languages = new Set<string>();
      
      voices.forEach(voice => {
        if (voice.lang.startsWith('en')) languages.add('en');
        if (voice.lang.startsWith('de')) languages.add('de');
      });
      
      return Array.from(languages);
    }
  }
  
  export const browserVoiceService = BrowserVoiceService.getInstance();