// عمداً اولین Import: Reset یک‌باره داده عملیاتی باید پیش از Initialize شدن
// سرویس‌ها اجرا شود، چون آنها در لحظه Import داده را در حافظه می‌خوانند.
import './services/bootstrapReset';

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
