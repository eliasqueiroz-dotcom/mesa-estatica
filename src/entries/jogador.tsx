import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PlayerApp from '../app/PlayerApp';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/ruido.css';
import '../styles/alerta-sessao.css';

// Bundle do jogador (mesa-estatica-multiplayer-completo.md Parte IV §2) — nunca importa
// App/ControlPanel/forcarRolagem. O Rollup faz tree-shaking por entrada: essa árvore não
// puxa nada exclusivo de mestre.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);
