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
  retryCount: number;
}

interface VoiceServiceStatus {
  openai: boolean;
  browser: boolean;
  preferred: 'openai' | 'browser';
  current: 'openai' | 'browser' | 'none';
  userInteracted: boolean;
  pendingAudio: number;
  canPlayAudio: boolean;
  lastError?: string;
  serviceHealth: {
    openai: 'healthy' | 'degraded' | 'unavailable';
    browser: 'healthy' | 'degraded' | 'unavailable';
  };
}

class VoiceServiceImplementation implements VoiceService {
  private preferredService: 'openai' | 'browser' = 'openai';
  private userInteractedValue = false;
  private pendingAudio: PendingAudio[] = [];
  private maxPendingAudio = 10;
  private currentPlayback: { stop: () => void } | null = null;
  private serviceHealth: { openai: 'healthy' | 'degraded' | 'unavailable'; browser: 'healthy' | 'degraded' | 'unavailable' } = {
    openai: 'healthy',
    browser: 'healthy',
  };
  private errorCount = {
    openai: 0,
    browser: 0,
  };
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private isPlaying = false;
  private playbackQueue: PendingAudio[] = [];
  private lastError: string | null = null;

  constructor() {
    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.checkServiceHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async checkServiceHealth(): Promise<void> {
    // Reset error counts periodically for recovery
    if (this.errorCount.openai > 0) {
      this.errorCount.openai = Math.max(0, this.errorCount.openai - 1);
      if (this.errorCount.openai === 0) {
        this.serviceHealth.openai = 'healthy';
      }
    }

    if (this.errorCount.browser > 0) {
      this.errorCount.browser = Math.max(0, this.errorCount.browser - 1);
      if (this.errorCount.browser === 0) {
        this.serviceHealth.browser = 'healthy';
      }
    }
  }

  private updateServiceHealth(service: 'openai' | 'browser', error: boolean): void {
    if (error) {
      this.errorCount[service]++;
      
      if (this.errorCount[service] >= 3) {
        this.serviceHealth[service] = 'unavailable';
      } else if (this.errorCount[service] >= 1) {
        this.serviceHealth[service] = 'degraded';
      }
    } else {
      this.errorCount[service] = 0;
      this.serviceHealth[service] = 'healthy';
    }
  }

  private getBestAvailableService(): 'openai' | 'browser' | 'none' {
    // Prefer the preferred service if healthy
    if (this.preferredService === 'openai' && this.serviceHealth.openai !== 'unavailable' && openaiVoiceService.isSupported()) {
      return 'openai';
    }
    
    if (this.preferredService === 'browser' && this.serviceHealth.browser !== 'unavailable' && browserVoiceService.isSupported()) {
      return 'browser';
    }

    // Fallback to the other service if preferred is unavailable
    if (this.preferredService === 'openai' && this.serviceHealth.browser !== 'unavailable' && browserVoiceService.isSupported()) {
      return 'browser';
    }

    if (this.preferredService === 'browser' && this.serviceHealth.openai !== 'unavailable' && openaiVoiceService.isSupported()) {
      return 'openai';
    }

    return 'none';
  }

  canPlayAudio(): boolean {
    return this.userInteractedValue && typeof document !== 'undefined' && this.getBestAvailableService() !== 'none';
  }

  setUserInteracted(): void {
    if (this.userInteractedValue) return;
    
    this.userInteractedValue = true;
    console.log('User interaction detected - voice features enabled');
    this.clearPendingAudio();
    setTimeout(() => {
      this.processPlaybackQueue();
    }, 200);
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

  private stopCurrentPlayback(): void {
    if (this.currentPlayback) {
      try {
        this.currentPlayback.stop();
      } catch (error) {
        console.warn('Error stopping playback:', error);
      } finally {
        this.currentPlayback = null;
      }
    }
    this.isPlaying = false;
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) return;

    this.isPlaying = true;
    const audioItem = this.playbackQueue.shift()!;

    try {
      await this.playAudioWithRetry(audioItem.text, audioItem.sender, audioItem.language, audioItem.retryCount);
    } catch (error) {
      console.error('Failed to play audio from queue:', error);
    } finally {
      this.isPlaying = false;
      
      // Process next item in queue after a short delay
      if (this.playbackQueue.length > 0) {
        setTimeout(() => this.processPlaybackQueue(), 500);
      }
    }
  }

  private async playAudioWithRetry(
    text: string, 
    sender: string, 
    language: 'en' | 'de', 
    retryCount = 0
  ): Promise<void> {
    try {
      if (!this.canPlayAudio()) {
        throw new Error('Cannot play audio - user has not interacted or no service available');
      }

      this.stopCurrentPlayback();

      const serviceType = this.getBestAvailableService();
      
      if (serviceType === 'openai') {
        this.currentPlayback = { stop: () => openaiVoiceService.stop() };
        await openaiVoiceService.speakText(text, sender, language);
        this.updateServiceHealth('openai', false);
      } else if (serviceType === 'browser') {
        this.currentPlayback = { stop: () => browserVoiceService.stop() };
        await browserVoiceService.speakText(text, language);
        this.updateServiceHealth('browser', false);
      } else {
        throw new Error('No supported voice service available');
      }

    } catch (error) {
      console.error(`Voice service error (attempt ${retryCount + 1}):`, error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';

      // Update service health
      if (this.getBestAvailableService() === 'openai') {
        this.updateServiceHealth('openai', true);
      } else {
        this.updateServiceHealth('browser', true);
      }

      // Retry logic
      if (retryCount < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (retryCount + 1)));
        return this.playAudioWithRetry(text, sender, language, retryCount + 1);
      }

      throw new Error(`Failed to play audio after ${this.MAX_RETRIES} attempts: ${this.lastError}`);
    } finally {
      this.currentPlayback = null;
    }
  }

  async speakText(text: string, sender: string, language: 'en' | 'de' = 'en'): Promise<void> {
    if (!text.trim() || 
        text.includes('Language switched') || 
        text.includes('Sprache auf Deutsch')) {
      return;
    }

    const audioItem: PendingAudio = {
      text,
      sender,
      language,
      timestamp: Date.now(),
      retryCount: 0
    };

    if (!this.userInteractedValue) {
      if (this.pendingAudio.length < this.maxPendingAudio) {
        this.pendingAudio.push(audioItem);
        console.log('Audio queued (waiting for user interaction). Queued:', this.pendingAudio.length);
      } else {
        console.warn('Audio queue full - dropping message');
      }
      return;
    }

    // Add to playback queue and process
    this.playbackQueue.push(audioItem);
    if (!this.isPlaying) {
      this.processPlaybackQueue();
    }
  }

  stop(): void {
    this.stopCurrentPlayback();
    openaiVoiceService.stop();
    browserVoiceService.stop();
    this.clearPendingAudio();
    this.playbackQueue = [];
  }

  isSupported(): boolean {
    return openaiVoiceService.isSupported() || browserVoiceService.isSupported();
  }

  getServiceType(): 'openai' | 'browser' | 'none' {
    return this.getBestAvailableService();
  }

  setPreferredService(service: 'openai' | 'browser'): void {
    this.preferredService = service;
    console.log(`Preferred voice service set to: ${service}`);
  }

  getStatus(): VoiceServiceStatus {
    return {
      openai: openaiVoiceService.isSupported(),
      browser: browserVoiceService.isSupported(),
      preferred: this.preferredService,
      current: this.getServiceType(),
      userInteracted: this.userInteractedValue,
      pendingAudio: this.getPendingAudioCount(),
      canPlayAudio: this.canPlayAudio(),
      lastError: this.lastError || undefined,
      serviceHealth: { ...this.serviceHealth }
    };
  }

  getPendingAudioMessages(): PendingAudio[] {
    return [...this.pendingAudio, ...this.playbackQueue];
  }

  cleanupOldPendingAudio(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.pendingAudio = this.pendingAudio.filter(audio => audio.timestamp > fiveMinutesAgo);
    this.playbackQueue = this.playbackQueue.filter(audio => audio.timestamp > fiveMinutesAgo);
  }

  // Emergency recovery method
  async resetServices(): Promise<void> {
    this.stop();
    this.errorCount.openai = 0;
    this.errorCount.browser = 0;
    this.serviceHealth.openai = 'healthy';
    this.serviceHealth.browser = 'healthy';
    this.lastError = null;
    console.log('Voice services reset');
  }
}

export const voiceService = new VoiceServiceImplementation();

// Cleanup and health monitoring
setInterval(() => {
  voiceService.cleanupOldPendingAudio();
}, 60 * 1000);

// Global error handler for uncaught voice errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('voice')) {
      console.error('Unhandled voice error:', event.reason);
      event.preventDefault();
    }
  });
}