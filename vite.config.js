import { defineConfig } from 'vite';

export default defineConfig({
  // Khi sử dụng CNAME (Custom Domain), base URL phải là gốc '/'
  base: '/',
  build: {
    target: 'esnext',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/mixins/')) {
            return 'mixins';
          }
        }
      }
    }
  }
});
