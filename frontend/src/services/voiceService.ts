import { browserVoiceService } from './browserVoiceService';

export interface VoiceService {
  speakText(text: string, sender: string, language: 'en' | 'de'): Promise<void>;
  stop(): void;
  isSupported(): boolean;
  getServiceType(): 'browser' | 'none';
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
  private userInteractedValue = false;
  private pendingAudio: PendingAudio[] = [];
  private readonly maxPendingAudio = 10;
  private isPlaying = false;
  private playbackQueue: PendingAudio[] = [];
  private lastError: string | null = null;
  private browserErrorCount = 0;

  canPlayAudio(): boolean {
    return this.userInteractedValue && typeof document !== 'undefined' && browserVoiceService.isSupported();
  }

  setUserInteracted(): void {
    if (this.userInteractedValue) return;
    this.userInteractedValue = true;
    this.clearPendingAudio();
    setTimeout(() => this.processPlaybackQueue(), 200);
  }

  hasUserInteracted(): boolean {
    return this.userInteractedValue;
  }

  getPendingAudioCount(): number {
    return this.pendingAudio.length + this.playbackQueue.length;
  }

  clearPendingAudio(): void {
    this.pendingAudio = [];
    this.playbackQueue = [];
  }

  getServiceType(): 'browser' | 'none' {
    return browserVoiceService.isSupported() ? 'browser' : 'none';
  }

  isSupported(): boolean {
    return browserVoiceService.isSupported();
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) return;

    this.isPlaying = true;
    const audioItem = this.playbackQueue.shift()!;

    try {
      if (!this.canPlayAudio()) return;
      browserVoiceService.stop();
      await browserVoiceService.speakText(audioItem.text, audioItem.language);
      this.browserErrorCount = 0;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.browserErrorCount++;
      console.error('Voice playback error:', error);
    } finally {
      this.isPlaying = false;
      if (this.playbackQueue.length > 0) {
        setTimeout(() => this.processPlaybackQueue(), 300);
      }
    }
  }

  async speakText(text: string, sender: string, language: 'en' | 'de' = 'en'): Promise<void> {
    if (!text.trim() ||
        text.includes('Language switched') ||
        text.includes('Sprache auf Deutsch')) {
      return;
    }

    const audioItem: PendingAudio = { text, sender, language, timestamp: Date.now() };

    if (!this.userInteractedValue) {
      if (this.pendingAudio.length < this.maxPendingAudio) {
        this.pendingAudio.push(audioItem);
      }
      return;
    }

    // Stop anything currently playing and play this immediately
    this.playbackQueue = [audioItem];
    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  stop(): void {
    browserVoiceService.stop();
    this.clearPendingAudio();
    this.isPlaying = false;
  }

  cleanupOldPendingAudio(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.pendingAudio = this.pendingAudio.filter(a => a.timestamp > fiveMinutesAgo);
    this.playbackQueue = this.playbackQueue.filter(a => a.timestamp > fiveMinutesAgo);
  }
}

export const voiceService = new VoiceServiceImplementation();

// Periodic cleanup of stale queued audio
setInterval(() => {
  voiceService.cleanupOldPendingAudio();
}, 60 * 1000);

// Suppress unhandled voice-related promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('voice')) {
      console.error('Unhandled voice error:', event.reason);
      event.preventDefault();
    }
  });
}
