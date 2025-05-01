import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        newtab: path.resolve(__dirname, 'newtab.html'),
        manifest: path.resolve(__dirname, 'manifest.json')
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  publicDir: false
});
