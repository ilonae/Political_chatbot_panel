export const getTranslatedText = (text: string, language: 'en' | 'de'): string => {
  const translations: Record<string, { en: string; de: string }> = {
    'Generating suggestions...': {
      en: 'Generating suggestions...',
      de: 'Vorschläge werden generiert...'
    },
    'Suggested follow-ups:': {
      en: 'Suggested follow-ups:',
      de: 'Empfohlene Antworten:'
    },
    'Use this suggestion': {
      en: 'Use this suggestion',
      de: 'Diesen Vorschlag verwenden'
    },
    // Add other translations as needed
  };

  return translations[text]?.[language] || text;
};

  
  
  export const getTranslatedSender = (sender: string, language: 'en' | 'de'): string => {
    return getTranslatedText(sender, language);
  };