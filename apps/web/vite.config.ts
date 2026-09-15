import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ isSsrBuild }) => {
  const siteUrl = process.env.VITE_SITE_URL || process.env.WEB_URL || '';
  const indexingEnabled = process.env.VITE_SEO_INDEXING_ENABLED || process.env.SEO_INDEXING_ENABLED || 'false';
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl),
      'import.meta.env.VITE_SEO_INDEXING_ENABLED': JSON.stringify(indexingEnabled),
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      rollupOptions: isSsrBuild ? undefined : {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'icons-vendor': ['lucide-react'],
          },
        },
      },
    },
    server: {
      port: 5173,
    },
  };
});
