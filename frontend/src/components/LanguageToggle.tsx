interface Props {
  currentLanguage: 'en' | 'de';
  onLanguageChange: (lang: 'en' | 'de') => void;
  isMobile?: boolean;
  isTablet?: boolean;
}

export default function LanguageToggle({ currentLanguage, onLanguageChange }: Props) {
  return (
    <div
      className="flex items-center rounded-lg p-0.5 gap-0.5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      {(['en', 'de'] as const).map(lang => (
        <button
          key={lang}
          onClick={() => onLanguageChange(lang)}
          className="px-2.5 py-1 rounded-md text-fluid-xs font-semibold tracking-wide transition-all"
          style={{
            background: currentLanguage === lang
              ? 'rgba(99,130,255,0.18)'
              : 'transparent',
            color: currentLanguage === lang
              ? 'var(--accent)'
              : 'var(--text-muted)',
            border: currentLanguage === lang
              ? '1px solid rgba(99,130,255,0.3)'
              : '1px solid transparent',
          }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
