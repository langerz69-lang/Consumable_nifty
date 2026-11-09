import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import express from 'express';
import apiRouter from './server/apiRouter.js';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-api-server-plugin',
        configureServer(server) {
          const app = express();
          app.use(express.json());
          app.use('/api', apiRouter);

          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api')) {
              (app as any)(req, res, next);
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
