import React from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { cn } from '../lib/utils';

interface ThinkingIndicatorProps {
  isMobile?: boolean;
  isTablet?: boolean;
  language?: 'en' | 'de';
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ isMobile = false, isTablet = false, language = 'en' }) => {
  return (
    <motion.div
      className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl mx-4 my-3 shadow-md"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="text-blue-600"
      >
        <Brain className={cn("h-5 w-5", isTablet && "h-6 w-6")} />
      </motion.div>
      
      <span className={cn("font-semibold text-blue-700", isTablet ? "text-xl" : "text-lg")}>
      {language === 'en' ? 'Thinking' : 'Denkt'}
      </span>
      
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2
          }}
          className={cn("text-blue-700 font-bold", isTablet ? "text-xl" : "text-lg")}
        >
          .
        </motion.span>
      ))}
    </motion.div>
  );
};

export default ThinkingIndicator;