import { motion } from 'framer-motion';

interface Props {
  language?: 'en' | 'de';
  isMobile?: boolean;
  isTablet?: boolean;
}

export default function ThinkingIndicator({ language = 'en' }: Props) {
  return (
    <motion.div
      className="flex justify-start"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          maxWidth: 'min(75%, 540px)',
        }}
      >
        <span className="text-fluid-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {language === 'de' ? 'Diskussionspartner denkt' : 'Debate Partner is thinking'}
        </span>
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full dot-${i + 1}`}
              style={{ background: 'var(--bot-from)' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
