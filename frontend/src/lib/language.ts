export const getTranslatedText = (text: string, language: 'en' | 'de'): string => {
  const translations: Record<string, { en: string; de: string }> = {
    'Confronting Fascism: An AI Dialogue': {
    en: 'Confronting Fascism: An AI Dialogue',
    de: 'Konfrontation mit Faschismus: Ein KI-Dialog'
  },
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
    'You:': {
      en: 'You:',
      de: 'Du:'
    },
    'Debate Partner:': {
      en: 'Debate Partner:',
      de: 'Diskussionspartner:'
    },
    'Reset conversation': {
      en: 'Reset conversation',
      de: 'Gespräch zurücksetzen',
    },
    'Type your response...': {
      en: 'Type your response...',
      de: 'Antwort eingeben…',
    }
  };

  return translations[text]?.[language] || text;
};

  