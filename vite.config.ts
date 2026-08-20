/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dois bundles (mesa-estatica-multiplayer-completo.md Parte IV §2): index.html carrega o app
// completo do mestre, jogador.html carrega o PlayerApp reduzido. O Rollup faz tree-shaking por
// entrada — código exclusivo de mestre (ControlPanel, forcarRolagem) não entra no chunk do jogador.
// Caminhos relativos (sem path.resolve/__dirname) — Vite resolve contra `root` sozinho e isso
// evita depender de @types/node, que não é uma dependência instalada neste projeto.
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    // `tests/` (raiz, fora de src/) guarda um spec Playwright avulso (player-app.spec.ts) que
    // nunca foi versionado nem tem playwright.config — sem excluir, o vitest tenta rodar como
    // teste dele mesmo e falha sempre ("Playwright Test did not expect test.describe()...").
    // Precisa repetir o default do vitest aqui porque declarar `exclude` SUBSTITUI o default,
    // não soma — sem isso, node_modules/dist etc. voltariam a ser varridos.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'tests/**',
    ],
  },
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
