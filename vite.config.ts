import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // App is served from domain root — deep links like /join/:id must resolve here.
    base: '/',
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5000,
      allowedHosts: true as true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      // Mirror production SPA fallback so `vite preview` deep links work locally.
      host: '127.0.0.1',
      port: 5000,
    },
  };
});
