import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Import service worker registration
//import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (process.env.NODE_ENV === 'production') {
  import('./serviceWorkerRegistration')
    .then(({ register }) => register())
    .catch(console.error);
}
// Register the service worker for PWA offline support
