import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import ChatInterface from './components/ChatInterface';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4a86e8', // User blue
    },
    secondary: {
      main: '#666', // System gray
    },
    warning: {
      main: '#e28743', // Debate partner orange
    },
    success: {
      main: '#57a857', // Moderator green
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh' }}>
        <ChatInterface />
      </Box>
    </ThemeProvider>
  );
}

export default App;