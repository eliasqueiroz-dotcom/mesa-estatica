import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import ControlPanel from './features/controle/ControlPanel';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ruido.css';
import './styles/alerta-sessao.css';

// #controle abre a janela de controle secreta do mestre (rolagem forçada), separada da
// janela principal compartilhada no Discord. Mesma origin → BroadcastChannel conecta as duas.
const ehControle = window.location.hash === '#controle';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{ehControle ? <ControlPanel /> : <App />}</StrictMode>,
);
