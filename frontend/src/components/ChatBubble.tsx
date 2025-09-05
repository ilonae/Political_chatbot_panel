import React from 'react';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import { Message } from '../types/Chat';
import { 
  User, 
  MessageSquare, 
  Brain, 
  Settings 
} from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  
  const getAvatar = () => {
    switch (message.sender) {
      case 'You':
        return <User size={20} />;
      case 'Debate Partner':
        return <MessageSquare size={20} />;
      case 'Philosopher Moderator':
      case 'Psychologist Moderator':
        return <Brain size={20} />;
      default:
        return <Settings size={20} />;
    }
  };

  const getBubbleStyle = () => {
    switch (message.type) {
      case 'user':
        return {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          alignSelf: 'flex-end'
        };
      case 'partner':
        return {
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          alignSelf: 'flex-start'
        };
      case 'moderator':
        return {
          bgcolor: 'success.main',
          color: 'success.contrastText',
          alignSelf: 'flex-start'
        };
      case 'system':
        return {
          bgcolor: 'grey.300',
          color: 'grey.800',
          alignSelf: 'center'
        };
      default:
        return {
          bgcolor: 'grey.100',
          color: 'text.primary',
          alignSelf: 'flex-start'
        };
    }
  };

  if (isSystem) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
        <Paper
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'grey.100',
            color: 'grey.600',
            textAlign: 'center'
          }}
        >
          <Typography variant="body2">{message.message}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 1,
        mb: 2,
        maxWidth: '80%',
        alignSelf: isUser ? 'flex-end' : 'flex-start'
      }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser ? 'primary.main' : 'grey.400'
        }}
      >
        {getAvatar()}
      </Avatar>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" sx={{ 
          fontWeight: 'bold',
          textAlign: isUser ? 'right' : 'left'
        }}>
          {message.sender}
        </Typography>
        
        <Paper
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2,
            ...getBubbleStyle(),
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              width: 0,
              height: 0,
              [isUser ? 'right' : 'left']: -8,
              top: 0,
              borderStyle: 'solid',
              borderWidth: '0 8px 12px 8px',
              borderColor: `transparent transparent ${
                isUser ? 'primary.main' : 
                message.type === 'partner' ? 'warning.main' :
                message.type === 'moderator' ? 'success.main' : 'grey.300'
              } transparent`
            }
          }}
        >
          <Typography variant="body1">{message.message}</Typography>
        </Paper>
        
        <Typography variant="caption" sx={{ 
          color: 'text.secondary',
          textAlign: isUser ? 'right' : 'left'
        }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatBubble;