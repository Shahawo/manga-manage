import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Khi sử dụng CNAME (Custom Domain), base URL phải là gốc '/'
    base: '/',
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://manga-cloudflare-worker.dactam172.workers.dev',
          changeOrigin: true,
        }
      }
    },
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
  };
});
