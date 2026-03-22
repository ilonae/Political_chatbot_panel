import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { RecommendedAnswer } from '../types/Chat';
import { getTranslatedText } from '../lib/language';

interface Props {
  answers: RecommendedAnswer[];
  onAnswerSelect: (text: string) => void;
  isLoading?: boolean;
  language: 'en' | 'de';
  className?: string;
}

export default function RecommendedAnswers({ answers, onAnswerSelect, isLoading, language }: Props) {
  return (
    <AnimatePresence>
      {(isLoading || answers.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5 px-1">
            <Sparkles
              className="w-3 h-3"
              style={{ color: isLoading ? 'var(--text-muted)' : 'var(--accent)' }}
            />
            <span className="text-fluid-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {getTranslatedText('Suggested follow-ups:', language)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {isLoading
              ? [120, 160, 140].map((w, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-full animate-pulse"
                    style={{ width: w, background: 'var(--bg-elevated)' }}
                  />
                ))
              : answers.map(a => (
                  <button
                    key={a.id}
                    onClick={() => onAnswerSelect(a.text)}
                    className="chip px-3 py-1.5 rounded-full text-fluid-xs font-medium"
                  >
                    {a.text}
                  </button>
                ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
