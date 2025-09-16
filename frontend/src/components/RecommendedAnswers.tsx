import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Sparkles } from 'lucide-react';
import { RecommendedAnswer } from '../types/Chat';
import { getTranslatedText } from '../lib/language';
import { cn } from '../lib/utils';

interface RecommendedAnswersProps {
  answers: RecommendedAnswer[];
  onAnswerSelect: (answer: string) => void;
  isLoading?: boolean;
  language: 'en' | 'de';
  className?: string;
}

const RecommendedAnswers: React.FC<RecommendedAnswersProps> = ({
  answers,
  onAnswerSelect,
  isLoading = false,
  language,
  className,
}) => {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200", className)}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
          <p className="text-sm font-medium text-blue-700">
            {getTranslatedText('Generating suggestions...', language)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 bg-blue-200 rounded-full animate-pulse"
              style={{ width: `${Math.random() * 100 + 100}px` }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!answers || answers.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn("mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 shadow-sm", className)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-medium text-blue-700">
          {getTranslatedText('Suggested follow-ups:', language)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {answers.map((answer) => (
          <motion.button
            key={answer.id}
            onClick={() => onAnswerSelect(answer.text)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-3 py-2 bg-white text-blue-800 border border-blue-300 rounded-full text-sm font-medium hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50 shadow-sm"
            title={getTranslatedText('Use this suggestion', language)}
          >
            {answer.text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default RecommendedAnswers;