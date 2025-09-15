import { openaiVoiceService } from './openAiVoiceService';
import { browserVoiceService } from './browserVoiceService';

export interface VoiceService {
  speakText(text: string, sender: string, language: 'en' | 'de'): Promise<void>;
  stop(): void;
  isSupported(): boolean;
  getServiceType(): 'openai' | 'browser' | 'none';
  setUserInteracted(): void;
  hasUserInteracted(): boolean; 
  getPendingAudioCount(): number;
  clearPendingAudio(): void;
  canPlayAudio(): boolean;
}

interface PendingAudio {
  text: string;
  sender: string;
  language: 'en' | 'de';
  timestamp: number;
}

class VoiceServiceImplementation implements VoiceService {
  private preferredService: 'openai' | 'browser' = 'openai';
  private userInteractedValue = false;
  private pendingAudio: PendingAudio[] = [];
  private maxPendingAudio = 10;
  private currentPlayback: { stop: () => void } | null = null;

  canPlayAudio(): boolean {
    return this.userInteractedValue && typeof document !== 'undefined';
  }

  setUserInteracted(): void {
    if (this.userInteractedValue) return;
    
    this.userInteractedValue = true;
    console.log('User interaction detected - voice features enabled');
    this.clearPendingAudio();
    setTimeout(() => {
      this.playPendingAudio();
    }, 200);
  }

  hasUserInteracted(): boolean {
    return this.userInteractedValue;
  }

  getPendingAudioCount(): number {
    return this.pendingAudio.length;
  }

  clearPendingAudio(): void {
    this.pendingAudio = [];
  }

  private stopCurrentPlayback(): void {
    if (this.currentPlayback) {
      this.currentPlayback.stop();
      this.currentPlayback = null;
    }
  }

  private async playPendingAudio(): Promise<void> {
    if (!this.userInteractedValue || this.pendingAudio.length === 0) return;

    console.log(`Playing ${this.pendingAudio.length} pending audio messages`);
    
    const audioToPlay = [...this.pendingAudio];
    this.pendingAudio = [];

    for (let i = 0; i < audioToPlay.length; i++) {
      const audio = audioToPlay[i];
      try {

        if (!this.canPlayAudio()) {
          console.log('Skipping audio playback - user has not interacted yet');
          continue;
        }
        await this.playAudioImmediately(audio.text, audio.sender, audio.language);
        
        // Add delay between messages (except for the last one)
        if (i < audioToPlay.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error('Failed to play pending audio:', error);
      }
    }
  }

  private async playAudioImmediately(text: string, sender: string, language: 'en' | 'de'): Promise<void> {
    try {
      if (!this.canPlayAudio()) {
        console.log('Cannot play audio - user has not interacted yet');
        return;
      }

      this.stopCurrentPlayback();

      if (openaiVoiceService.isSupported()) {
        this.currentPlayback = {
          stop: () => openaiVoiceService.stop()
        };
        await openaiVoiceService.speakText(text, sender, language);
      }
      else if (browserVoiceService.isSupported()) {
        this.currentPlayback = {
          stop: () => browserVoiceService.stop()
        };
        return await browserVoiceService.speakText(text, language);
      }else {
        console.warn('No supported voice service available');
      }
    } catch (error) {
      console.error('Voice service error:', error);
      this.currentPlayback = null;
    }
  }

  async speakText(text: string, sender: string, language: 'en' | 'de' = 'en'): Promise<void> {
    if (!text.trim() || 
        text.includes('Language switched') || 
        text.includes('Sprache auf Deutsch')) {
      return;
    }

    if (!this.userInteractedValue) {
      if (this.pendingAudio.length < this.maxPendingAudio) {
        this.pendingAudio.push({
          text,
          sender,
          language,
          timestamp: Date.now()
        });
        console.log('Audio queued (waiting for user interaction). Queued:', this.pendingAudio.length);
      } else {
        console.warn('Audio queue full - dropping message');
      }
      return;
    }

    return this.playAudioImmediately(text, sender, language);
  }

  stop(): void {
    this.stopCurrentPlayback();
    openaiVoiceService.stop();
    browserVoiceService.stop();
    this.clearPendingAudio();
  }

  isSupported(): boolean {
    return true;
  }

  getServiceType(): 'openai' | 'browser' | 'none' {
    if (this.preferredService === 'openai') return 'openai';
    if (browserVoiceService.isSupported()) return 'browser';
    return 'none';
  }

  setPreferredService(service: 'openai' | 'browser'): void {
    this.preferredService = service;
    console.log(`Preferred voice service set to: ${service}`);
  }

  getStatus() {
    return {
      openai: true,
      browser: browserVoiceService.isSupported(),
      preferred: this.preferredService,
      current: this.getServiceType(),
      userInteracted: this.userInteractedValue,
      pendingAudio: this.pendingAudio.length,
      canPlayAudio: this.canPlayAudio()
    };
  }

  getPendingAudioMessages(): PendingAudio[] {
    return [...this.pendingAudio];
  }

  cleanupOldPendingAudio(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.pendingAudio = this.pendingAudio.filter(audio => audio.timestamp > fiveMinutesAgo);
  }
}

export const voiceService = new VoiceServiceImplementation();

setInterval(() => {
  voiceService.cleanupOldPendingAudio();
}, 60 * 1000);