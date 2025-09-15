import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface LanguageToggleProps {
  currentLanguage: 'en' | 'de';
  onLanguageChange: (language: 'en' | 'de') => void;
  isMobile?: boolean;
  isTablet?: boolean;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({
  currentLanguage,
  onLanguageChange,
  isMobile = false,
  isTablet = false
}) => {
  return (
    <div className={cn(
      "flex items-center gap-2 bg-gray-100 rounded-full p-1",
      isMobile ? "h-8" : isTablet ? "h-10" : "h-9"
    )}>
      <Button
        variant="ghost"
        size={isTablet ? "lg" : "sm"}
        className={cn(
          "rounded-full font-medium transition-all",
          currentLanguage === 'en' 
            ? "bg-blue-500 text-white shadow-md" 
            : "text-gray-600 hover:text-gray-800",
          isMobile ? "px-3 text-xs" : isTablet ? "px-4 text-base" : "px-3 text-sm"
        )}
        onClick={() => onLanguageChange('en')}
      >
        EN
      </Button>
      
      <Button
        variant="ghost"
        size={isTablet ? "lg" : "sm"}
        className={cn(
          "rounded-full font-medium transition-all",
          currentLanguage === 'de' 
            ? "bg-blue-500 text-white shadow-md" 
            : "text-gray-600 hover:text-gray-800",
          isMobile ? "px-3 text-xs" : isTablet ? "px-4 text-base" : "px-3 text-sm"
        )}
        onClick={() => onLanguageChange('de')}
      >
        DE
      </Button>
    </div>
  );
};

export default LanguageToggle;