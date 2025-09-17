import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Volume2, Check } from 'lucide-react';
import { voiceService } from '../services/voiceService';
import { browserVoiceService } from '../services/browserVoiceService';

interface VoiceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'en' | 'de';
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

  useEffect(() => {
    if (isOpen) {
      loadBrowserVoices();
    }
  }, [isOpen]);

  const loadBrowserVoices = () => {
    if (browserVoiceService.isSupported()) {
      const voices = browserVoiceService.getAvailableVoices();
      setBrowserVoices(voices);
      setAvailableLanguages(browserVoiceService.getAvailableLanguages());
    }
  };

  const handleServiceChange = (service: 'openai' | 'browser') => {
    setSelectedService(service);
    voiceService.setPreferredService(service);
  };

  const testVoice = async () => {
    const testText = currentLanguage === 'en' 
      ? 'This is a test of the voice system' 
      : 'Dies ist ein Test des Sprachsystems';
    
    try {
      await voiceService.speakText(testText, 'System', currentLanguage);
    } catch (error) {
      console.error('Test failed:', error);
    }
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
              }`}
              onClick={() => handleServiceChange('openai')}
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
              }`}
              onClick={() => handleServiceChange('browser')}
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
            </div>
          </div>
        </div>

        {/* Test Button */}
        <Button onClick={testVoice} className="w-full mb-6">
          <Volume2 className="h-4 w-4 mr-2" />
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
            <div>OpenAI: {status.openai ? ' Available' : ' Not available'}</div>
            <div>Browser: {status.browser ? ' Available' : ' Not available'}</div>
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