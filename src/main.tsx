import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LoginScreen } from './LoginScreen.tsx';
import './index.css';

function Root() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('ods_authenticated') === 'true'
  );

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
