import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/mesa-estatica/',
  plugins: [react()],
});
