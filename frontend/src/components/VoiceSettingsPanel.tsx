import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Volume2, Check, AlertCircle } from 'lucide-react';
import { voiceService } from '../services/voiceService';
import { browserVoiceService } from '../services/browserVoiceService';

interface VoiceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'en' | 'de';
}

interface ErrorState {
  message: string;
  type: 'error' | 'warning' | 'info';
}

const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  isOpen,
  onClose,
  currentLanguage
}) => {
  const [selectedService, setSelectedService] = useState<'openai' | 'browser'>(
    voiceService.getStatus().preferred
  );
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBrowserVoices();
    }
  }, [isOpen]);

  const loadBrowserVoices = () => {
    try {
      if (!browserVoiceService.isSupported()) {
        setError({
          message: currentLanguage === 'en' 
            ? 'Browser voice synthesis is not supported in this browser' 
            : 'Browser-Sprachsynthese wird in diesem Browser nicht unterstützt',
          type: 'warning'
        });
        return;
      }

      const voices = browserVoiceService.getAvailableVoices();
      
      if (voices.length === 0) {
        setError({
          message: currentLanguage === 'en' 
            ? 'No browser voices available. Please check your browser settings.' 
            : 'Keine Browser-Stimmen verfügbar. Bitte überprüfen Sie Ihre Browser-Einstellungen.',
          type: 'warning'
        });
      }

      setBrowserVoices(voices);
      setAvailableLanguages(browserVoiceService.getAvailableLanguages());
      setError(null);
    } catch (err) {
      console.error('Failed to load browser voices:', err);
      setError({
        message: currentLanguage === 'en' 
          ? 'Failed to load browser voices. Please try again.' 
          : 'Laden der Browser-Stimmen fehlgeschlagen. Bitte versuchen Sie es erneut.',
        type: 'error'
      });
    }
  };

  const handleServiceChange = async (service: 'openai' | 'browser') => {
    try {
      setSelectedService(service);
      await voiceService.setPreferredService(service);
      setError(null);
    } catch (err) {
      console.error('Failed to change voice service:', err);
      setError({
        message: currentLanguage === 'en' 
          ? 'Failed to change voice service. Please try again.' 
          : 'Wechsel des Sprachdienstes fehlgeschlagen. Bitte versuchen Sie es erneut.',
        type: 'error'
      });
    }
  };

  const testVoice = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    const testText = currentLanguage === 'en' 
      ? 'This is a test of the voice system' 
      : 'Dies ist ein Test des Sprachsystems';
    
    try {
      await voiceService.speakText(testText, 'System', currentLanguage);
    } catch (error) {
      console.error('Voice test failed:', error);
      
      let errorMessage = currentLanguage === 'en' 
        ? 'Voice test failed. Please check your settings.' 
        : 'Stimmtest fehlgeschlagen. Bitte überprüfen Sie Ihre Einstellungen.';

      if (error instanceof Error) {
        errorMessage += ` (${error.message})`;
      }

      setError({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  if (!isOpen) return null;

  const status = voiceService.getStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {currentLanguage === 'en' ? 'Voice Settings' : 'Stimme Einstellungen'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className={`mb-4 p-3 rounded-lg flex items-start space-x-2 ${
            error.type === 'error' 
              ? 'bg-red-50 border border-red-200' 
              : error.type === 'warning'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              error.type === 'error' 
                ? 'text-red-500' 
                : error.type === 'warning'
                ? 'text-yellow-500'
                : 'text-blue-500'
            }`} />
            <div className="flex-1">
              <p className="text-sm">{error.message}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearError}
                className="mt-2 text-xs h-6 px-2"
              >
                {currentLanguage === 'en' ? 'Dismiss' : 'Schließen'}
              </Button>
            </div>
          </div>
        )}

        {/* Service Selection */}
        <div className="mb-6">
          <h3 className="font-medium mb-3">
            {currentLanguage === 'en' ? 'Voice Service' : 'Sprachdienst'}
          </h3>
          
          <div className="space-y-2">
            <div
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedService === 'openai' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              } ${!status.openai ? 'opacity-70' : ''}`}
              onClick={() => status.openai && handleServiceChange('openai')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">OpenAI TTS</h4>
                  <p className="text-sm text-gray-600">
                    {currentLanguage === 'en' 
                      ? 'High quality, requires API key' 
                      : 'Hohe Qualität, benötigt API-Schlüssel'}
                  </p>
                </div>
                {selectedService === 'openai' && <Check className="h-5 w-5 text-blue-500" />}
              </div>
              {!status.openai && (
                <p className="text-sm text-orange-600 mt-1">
                  {currentLanguage === 'en' 
                    ? 'API key not configured' 
                    : 'API-Schlüssel nicht konfiguriert'}
                </p>
              )}
            </div>

            <div
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedService === 'browser' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              } ${!status.browser ? 'opacity-70' : ''}`}
              onClick={() => status.browser && handleServiceChange('browser')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">
                    {currentLanguage === 'en' ? 'Browser Voice' : 'Browser-Stimme'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {currentLanguage === 'en' 
                      ? 'Built-in, quality varies by browser' 
                      : 'Eingebaut, Qualität variiert nach Browser'}
                  </p>
                </div>
                {selectedService === 'browser' && <Check className="h-5 w-5 text-blue-500" />}
              </div>
              {!status.browser && (
                <p className="text-sm text-orange-600 mt-1">
                  {currentLanguage === 'en' 
                    ? 'Browser voice not available' 
                    : 'Browser-Stimme nicht verfügbar'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Test Button */}
        <Button 
          onClick={testVoice} 
          className="w-full mb-6"
          disabled={isLoading || (!status.openai && !status.browser)}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Volume2 className="h-4 w-4 mr-2" />
          )}
          {currentLanguage === 'en' ? 'Test Voice' : 'Stimme testen'}
        </Button>

        {/* Browser Voices Info */}
        {selectedService === 'browser' && browserVoices.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">
              {currentLanguage === 'en' ? 'Available Voices' : 'Verfügbare Stimmen'}
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {browserVoices.map((voice) => (
                <div
                  key={voice.name}
                  className="p-2 rounded bg-gray-50 text-sm"
                >
                  <div className="font-medium">{voice.name}</div>
                  <div className="text-gray-600">{voice.lang}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">
            {currentLanguage === 'en' ? 'Current Status' : 'Aktueller Status'}
          </h4>
          <div className="text-sm space-y-1">
            <div className="flex items-center">
              <span className="w-24">OpenAI:</span>
              <span className={status.openai ? 'text-green-600' : 'text-red-600'}>
                {status.openai ? 
                  (currentLanguage === 'en' ? 'Available' : 'Verfügbar') : 
                  (currentLanguage === 'en' ? 'Not available' : 'Nicht verfügbar')}
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-24">Browser:</span>
              <span className={status.browser ? 'text-green-600' : 'text-red-600'}>
                {status.browser ? 
                  (currentLanguage === 'en' ? 'Available' : 'Verfügbar') : 
                  (currentLanguage === 'en' ? 'Not available' : 'Nicht verfügbar')}
              </span>
            </div>
            <div>
              {currentLanguage === 'en' ? 'Selected' : 'Ausgewählt'}: {selectedService}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettingsPanel;