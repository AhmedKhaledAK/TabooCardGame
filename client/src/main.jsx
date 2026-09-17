import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundled rather than fetched: the Discord Activity CSP blocks font CDNs.
// Every subset is declared with a unicode-range, so the browser only
// downloads the Arabic file when Arabic text is on screen.
import '@fontsource/lalezar';
import '@fontsource-variable/cairo';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
