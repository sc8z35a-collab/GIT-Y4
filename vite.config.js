import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: '.build_tmp',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'dev.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});
