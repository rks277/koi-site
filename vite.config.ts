import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dev: resolve(__dirname, 'dev.html')
      }
    }
  }
});
