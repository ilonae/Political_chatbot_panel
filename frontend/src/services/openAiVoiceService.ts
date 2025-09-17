import { generateSpeech } from './api';

export class OpenAIVoiceService {
  private static instance: OpenAIVoiceService;
  private currentAudio: HTMLAudioElement | null = null;

  static getInstance(): OpenAIVoiceService {
    if (!OpenAIVoiceService.instance) {
      OpenAIVoiceService.instance = new OpenAIVoiceService();
    }
    return OpenAIVoiceService.instance;
  }

  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    this.stop();

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        reject(new Error('Not in a browser environment'));
        return;
      }
  
      // Check if document is visible (tab is active)
      if (document.hidden) {
        reject(new Error('Cannot play audio in background tab'));
        return;
      }  
      try {
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        };

        const playPromise = this.currentAudio.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio playback started successfully');
            })
            .catch(error => {
              URL.revokeObjectURL(audioUrl);
              this.currentAudio = null;
              reject(new Error('Audio playback blocked. User interaction required.'));
            });
        }

      } catch (error) {
        this.currentAudio = null;
        reject(error);
      }
    });
  }

  async speakText(text: string, sender: string, language: 'en' | 'de' = 'en'): Promise<void> {
    try {
      const response = await generateSpeech(text, sender, language);
      if (response.audioData) {
        await this.playAudio(response.audioData);
      } else {
        throw new Error('No audio data received');
      }
    } catch (error) {
      console.error('Speech playback error:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isSupported(): boolean {
    return true;
  }
}

export const openaiVoiceService = OpenAIVoiceService.getInstance();