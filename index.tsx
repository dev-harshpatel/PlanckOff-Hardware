import * as React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensureLibrariesLoaded } from './services/libraryLoader';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Attempt to load any missing libraries in the background
ensureLibrariesLoaded().catch(console.warn);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
