import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { initPushNotifications } from './utils/pushNotifications';
import './index.css';

if (typeof window !== 'undefined') {
  initPushNotifications().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ThemeProvider>
);
