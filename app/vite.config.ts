import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is a pure static bundle — no backend, no server functions.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'templates-catalog': [
            'src/templates/catalog/transitions.ts',
            'src/templates/catalog/carousel.ts',
            'src/templates/catalog/ring.ts',
            'src/templates/catalog/stack.ts',
            'src/templates/catalog/showcase3d.ts',
            'src/templates/catalog/glass.ts',
            'src/templates/catalog/gallery.ts',
            'src/templates/catalog/kinetic.ts',
            'src/templates/catalog/sculpture.ts',
            'src/templates/catalog/signature.ts',
            'src/templates/catalog/choreographyAtoE.ts',
            'src/templates/catalog/choreographyFtoJ.ts',
          ],
          'engine': ['src/engine/buildFrame.ts', 'src/engine/camera.ts', 'src/engine/export.ts', 'src/engine/flare.ts', 'src/engine/layout.ts', 'src/engine/math.ts', 'src/engine/timing.ts'],
          'render': ['src/render/Renderer.ts', 'src/render/placeholder.ts'],
        },
      },
    },
  },
});
