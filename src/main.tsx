import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { initPushNotifications } from './utils/pushNotifications';
import './index.css';

if (typeof window !== 'undefined') {
  initPushNotifications().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
