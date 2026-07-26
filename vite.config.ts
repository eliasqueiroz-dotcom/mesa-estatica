import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dois bundles (mesa-estatica-multiplayer-completo.md Parte IV §2): index.html carrega o app
// completo do mestre, jogador.html carrega o PlayerApp reduzido. O Rollup faz tree-shaking por
// entrada — código exclusivo de mestre (ControlPanel, forcarRolagem) não entra no chunk do jogador.
// Caminhos relativos (sem path.resolve/__dirname) — Vite resolve contra `root` sozinho e isso
// evita depender de @types/node, que não é uma dependência instalada neste projeto.
export default defineConfig({
  base: '/mesa-estatica/',
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        mestre: 'index.html',
        jogador: 'jogador.html',
      },
    },
  },
});
