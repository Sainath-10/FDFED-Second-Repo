import './lib/indiaTime.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App.jsx';
import { store } from './store/store.js';
// Base resets first, then the shared stylesheet so its rules win.
import './index.css';
import './styles/styles.css';
// Canonical shared components last, so they win over per-page copies.
import './styles/system.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);


