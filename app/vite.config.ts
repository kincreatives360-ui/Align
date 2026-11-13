import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is a pure static bundle — no backend, no server functions.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
