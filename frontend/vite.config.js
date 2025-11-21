import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Generate self-signed certificate for HTTPS (required by Tableau Extensions)
// In production, use proper SSL certificates
const httpsConfig = {
  key: fs.readFileSync(path.resolve(__dirname, 'cert/key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, 'cert/cert.pem'))
};

export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsConfig,
    port: 8443,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    'process.env': {}
  }
});
