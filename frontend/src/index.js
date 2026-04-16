import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));

// FIX: wrap the entire app in an ErrorBoundary so uncaught render errors
// show a recovery UI instead of a blank white screen.
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
