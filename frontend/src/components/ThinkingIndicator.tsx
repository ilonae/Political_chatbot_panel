import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

const ThinkingIndicator: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Thinking
      </Typography>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2
          }}
          style={{ fontSize: '24px' }}
        >
          .
        </motion.span>
      ))}
    </Box>
  );
};

export default ThinkingIndicator;