export const getTranslatedText = (key: string, language: 'en' | 'de'): string => {
    const translations: Record<string, { en: string; de: string }> = {
      'You': { en: 'You', de: 'Du' },
      'Debate Partner': { en: 'Debate Partner', de: 'Debattenpartner' },
      'Philosopher Moderator': { en: 'Philosopher Moderator', de: 'Philosophischer Moderator' },
      'Psychologist Moderator': { en: 'Psychologist Moderator', de: 'Psychologischer Moderator' },
      'System': { en: 'System', de: 'System' },

      'Political ideologies and perspectives': { 
        en: 'Political ideologies and perspectives', 
        de: 'Politische Ideologien und Perspektiven' 
      },
      'Current Debate Topic': { 
        en: 'Current Debate Topic', 
        de: 'Aktuelles Debatten-Thema' 
      },
      'Confronting Fascism: An AI Dialogue': {
        en: 'Confronting Fascism: An AI Dialogue',
        de: 'Konfrontation mit Faschismus: Ein KI-Dialog'
      }
    };
  
    return translations[key]?.[language] || key;
  };
  
  export const getTranslatedSender = (sender: string, language: 'en' | 'de'): string => {
    return getTranslatedText(sender, language);
  };